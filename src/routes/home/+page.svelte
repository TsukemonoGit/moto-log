<script lang="ts">
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import { QUICK_ACTION_LABELS } from "$lib/constants";
  import {
    calculateFuelEfficiency,
    getAverageFuelEfficiency,
    getLatestFuelEfficiency,
    getBestWorstFuelEfficiency,
    getTotalFuelCost,
    getTotalDistance,
    estimateRemainingFuel,
  } from "$lib/services/fuel-calc";
  import type { QuickActionType } from "$lib/models/types";

  const vehicle = $derived(vehicleStore.activeVehicle);
  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");
  const vehicleRefuels = $derived(
    records.refuels.filter((r) => r.vehicleId === vehicleId),
  );

  const efficiencies = $derived(calculateFuelEfficiency(vehicleRefuels));
  const avgFuel = $derived(getAverageFuelEfficiency(efficiencies));
  const latestFuel = $derived(getLatestFuelEfficiency(efficiencies));
  const bestWorst = $derived(getBestWorstFuelEfficiency(efficiencies));
  const totalCost = $derived(getTotalFuelCost(vehicleRefuels));
  const totalDistance = $derived(getTotalDistance(vehicleRefuels));

  // 推定残燃料
  const remainingFuel = $derived(
    vehicle?.fuelTankCapacity
      ? estimateRemainingFuel(vehicleRefuels, vehicle.fuelTankCapacity, avgFuel)
      : null,
  );

  const timeline = $derived(records.getTimeline(vehicleId).slice(0, 5));

  // --- 最終メンテ一覧 ---
  const maintenanceItems: {
    action: QuickActionType;
    icon: string;
    label: string;
    warnDays: number;
    dangerDays: number;
  }[] = [
    {
      action: "chain-lube",
      icon: "🔗",
      label: "チェーン注油",
      warnDays: 7,
      dangerDays: 14,
    },
    {
      action: "tire-pressure",
      icon: "💨",
      label: "空気圧チェック",
      warnDays: 14,
      dangerDays: 30,
    },
    { action: "wash", icon: "🚿", label: "洗車", warnDays: 14, dangerDays: 30 },
    {
      action: "chain-clean",
      icon: "🔗",
      label: "チェーン清掃",
      warnDays: 14,
      dangerDays: 30,
    },
    {
      action: "oil-check",
      icon: "🛢",
      label: "オイル確認",
      warnDays: 30,
      dangerDays: 60,
    },
    {
      action: "coolant-check",
      icon: "💧",
      label: "冷却水確認",
      warnDays: 30,
      dangerDays: 90,
    },
    {
      action: "battery-charge",
      icon: "🔋",
      label: "バッテリー充電",
      warnDays: 30,
      dangerDays: 60,
    },
  ];

  function daysAgo(dateStr: string): number {
    const now = new Date();
    const d = new Date(dateStr);
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  }

  const lastMaintenanceDates = $derived(() => {
    const quickRecs = records.quickRecords.filter(
      (r) => r.vehicleId === vehicleId,
    );
    const result: {
      action: string;
      icon: string;
      label: string;
      date: string | null;
      days: number | null;
      status: "ok" | "warn" | "danger" | "none";
      link: string;
    }[] = [];

    for (const item of maintenanceItems) {
      const latest = quickRecs
        .filter((r) => r.action === item.action)
        .sort((a, b) => (a.date > b.date ? -1 : 1))[0];

      const days = latest ? daysAgo(latest.date) : null;
      let status: "ok" | "warn" | "danger" | "none" = "none";
      if (days != null) {
        if (days >= item.dangerDays) status = "danger";
        else if (days >= item.warnDays) status = "warn";
        else status = "ok";
      }

      result.push({
        action: item.action,
        icon: item.icon,
        label: item.label,
        date: latest?.date ?? null,
        days,
        status,
        link: "/log",
      });
    }

    // ショップ記録からオイル交換の最終日も探す
    const shopOilChange = records.shopRecords
      .filter(
        (r) =>
          r.vehicleId === vehicleId &&
          r.workDone.some(
            (w) => w.toLowerCase().includes("oil") || w.includes("オイル"),
          ),
      )
      .sort((a, b) => (a.date > b.date ? -1 : 1))[0];

    if (shopOilChange) {
      const oilIdx = result.findIndex((r) => r.action === "oil-check");
      if (
        oilIdx >= 0 &&
        (!result[oilIdx].date || shopOilChange.date > result[oilIdx].date!)
      ) {
        const days = daysAgo(shopOilChange.date);
        result[oilIdx] = {
          ...result[oilIdx],
          date: shopOilChange.date,
          days,
          label: "オイル交換",
          status: days >= 60 ? "danger" : days >= 30 ? "warn" : "ok",
        };
      }
    }

    return result;
  });

  // 記録があるメンテだけ表示 + 未記録も1つまとめて表示
  const hasAnyMaintenance = $derived(
    lastMaintenanceDates().some((m) => m.date != null),
  );

  // --- 次回予定リマインダー ---
  const upcomingReminders = $derived(() => {
    const today = new Date().toISOString().slice(0, 10);
    const reminders: {
      label: string;
      type: "date" | "odo";
      value: string;
      daysLeft?: number;
      kmLeft?: number;
      status: "ok" | "warn" | "danger";
    }[] = [];

    // ショップ記録の nextDate / nextOdometer
    const shopRecs = records.shopRecords
      .filter((r) => r.vehicleId === vehicleId)
      .sort((a, b) => (a.date > b.date ? -1 : 1));

    // 最新 ODO を取得
    const allOdo = [
      ...records.refuels.filter(
        (r) => r.vehicleId === vehicleId && r.odometer != null,
      ),
      ...records.odometerRecords.filter((r) => r.vehicleId === vehicleId),
    ];
    const latestOdo =
      allOdo.length > 0
        ? Math.max(...allOdo.map((r) => (r as any).odometer ?? 0))
        : null;

    for (const shop of shopRecs) {
      if (shop.nextDate) {
        const daysLeft = Math.ceil(
          (new Date(shop.nextDate).getTime() - new Date(today).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const workLabel =
          shop.workDone.length > 0 ? shop.workDone[0] : "ショップ整備";
        reminders.push({
          label: workLabel,
          type: "date",
          value: shop.nextDate,
          daysLeft,
          status: daysLeft <= 0 ? "danger" : daysLeft <= 14 ? "warn" : "ok",
        });
      }
      if (shop.nextOdometer && latestOdo != null) {
        const kmLeft = shop.nextOdometer - latestOdo;
        const workLabel =
          shop.workDone.length > 0 ? shop.workDone[0] : "ショップ整備";
        if (kmLeft > -5000) {
          // 過ぎてても5000km以内なら表示
          reminders.push({
            label: workLabel,
            type: "odo",
            value: `${shop.nextOdometer.toLocaleString()} km`,
            kmLeft,
            status: kmLeft <= 0 ? "danger" : kmLeft <= 500 ? "warn" : "ok",
          });
        }
      }
    }

    // 日付順ソート
    reminders.sort((a, b) => {
      const aUrgency = a.status === "danger" ? 0 : a.status === "warn" ? 1 : 2;
      const bUrgency = b.status === "danger" ? 0 : b.status === "warn" ? 1 : 2;
      return aUrgency - bUrgency;
    });

    return reminders;
  });

  function formatRecordLine(item: (typeof timeline)[number]): string {
    if (item.type === "refuel") {
      const r = item.record as any;
      if (r.fuelAmount != null) {
        let line = `⛽ ${r.fuelAmount}L`;
        if (r.totalCost) line += ` ¥${r.totalCost.toLocaleString()}`;
        return line;
      }
      return r.isFullTank ? "⛽ 満タン給油" : "⛽ 給油";
    }
    if (item.type === "quick") {
      return QUICK_ACTION_LABELS[(item.record as any).action] || "🔧 整備";
    }
    if (item.type === "inspection") {
      const r = item.record as any;
      const typeLabel =
        { daily: "日常", weekly: "週間", monthly: "月間" }[r.type as string] ||
        "";
      return `📋 ${typeLabel}点検 ${r.allOk ? "ALL OK" : "要確認あり"}`;
    }
    if (item.type === "shop") {
      return `🏭 ショップ整備${(item.record as any).totalCost ? ` ¥${(item.record as any).totalCost.toLocaleString()}` : ""}`;
    }
    if (item.type === "odometer") {
      return `📏 ${(item.record as any).odometer.toLocaleString()} km`;
    }
    return "";
  }
</script>

<div class="space-y-4">
  <!-- 車両名 -->
  {#if vehicle}
    <div class="text-text-muted text-sm">
      {vehicle.name}
      {#if vehicle.maker}
        · {vehicle.maker}{/if}
    </div>
  {/if}

  <!-- 燃費サマリー -->
  <div class="bg-surface rounded-xl p-4">
    <h2 class="text-text-muted mb-3 text-sm font-medium">⛽ 燃費</h2>
    {#if efficiencies.length > 0}
      <div class="grid grid-cols-3 gap-3 text-center">
        <div>
          <div class="text-text-muted text-xs">直近</div>
          <div class="text-xl font-bold text-blue-400">{latestFuel ?? "—"}</div>
          <div class="text-text-muted text-xs">km/L</div>
        </div>
        <div>
          <div class="text-text-muted text-xs">平均</div>
          <div class="text-xl font-bold text-green-400">{avgFuel ?? "—"}</div>
          <div class="text-text-muted text-xs">km/L</div>
        </div>
        <div>
          <div class="text-text-muted text-xs">最高</div>
          <div class="text-xl font-bold text-amber-400">
            {bestWorst.best ?? "—"}
          </div>
          <div class="text-text-muted text-xs">km/L</div>
        </div>
      </div>
    {:else}
      <p class="text-text-muted text-sm">
        給油記録が増えると燃費が表示されます 📈
      </p>
    {/if}
  </div>

  <!-- 推定残燃料 -->
  {#if remainingFuel}
    <div class="bg-surface rounded-xl p-4">
      <h2 class="text-text-muted mb-3 text-sm font-medium">🔋 推定残燃料</h2>
      <div class="text-center">
        <div
          class="text-2xl font-bold {remainingFuel.percentage <= 20
            ? 'text-red-400'
            : remainingFuel.percentage <= 40
              ? 'text-amber-400'
              : 'text-green-400'}"
        >
          {remainingFuel.remaining} L
        </div>
        <div class="text-text-muted text-xs">
          / {vehicle?.fuelTankCapacity} L ({remainingFuel.percentage}%)
        </div>
      </div>
      <div class="mt-3 h-3 overflow-hidden rounded-full bg-slate-700">
        <div
          class="h-full rounded-full transition-all {remainingFuel.percentage <=
          20
            ? 'bg-red-500'
            : remainingFuel.percentage <= 40
              ? 'bg-amber-500'
              : 'bg-green-500'}"
          style="width: {remainingFuel.percentage}%"
        ></div>
      </div>
      {#if avgFuel}
        <div class="text-text-muted mt-2 text-center text-xs">
          航続可能: 約 {Math.round(remainingFuel.remaining * avgFuel)} km
        </div>
      {/if}
      <p class="text-text-muted mt-1 text-center text-xs opacity-60">
        ※ 平均燃費からの推定値です
      </p>
    </div>
  {/if}

  <!-- 距離・コスト -->
  {#if totalDistance != null || totalCost > 0}
    <div class="bg-surface grid grid-cols-2 gap-3 rounded-xl p-4">
      {#if totalDistance != null}
        <div class="text-center">
          <div class="text-text-muted text-xs">総走行距離</div>
          <div class="text-lg font-bold">
            {totalDistance.toLocaleString()} km
          </div>
        </div>
      {/if}
      {#if totalCost > 0}
        <div class="text-center">
          <div class="text-text-muted text-xs">累計ガソリン代</div>
          <div class="text-lg font-bold">¥{totalCost.toLocaleString()}</div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ODO 未入力へのナッジ -->
  {#if vehicleRefuels.length > 0 && vehicleRefuels.some((r) => r.odometer == null)}
    <div
      class="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm"
    >
      💡 給油時に走行距離 (ODO) を入力すると、より正確な燃費がわかります
    </div>
  {/if}

  <!-- 次回予定リマインダー -->
  {#if upcomingReminders().length > 0}
    <div class="bg-surface rounded-xl p-4">
      <h2 class="text-text-muted mb-3 text-sm font-medium">⏰ 次回予定</h2>
      <div class="space-y-2">
        {#each upcomingReminders() as reminder}
          <div class="flex items-center justify-between text-sm">
            <span>{reminder.label}</span>
            <span
              class="text-xs {reminder.status === 'danger'
                ? 'text-red-400 font-bold'
                : reminder.status === 'warn'
                  ? 'text-amber-400'
                  : 'text-text-muted'}"
            >
              {#if reminder.type === "date"}
                {reminder.value.slice(5)}
                {#if reminder.daysLeft != null}
                  ({reminder.daysLeft <= 0
                    ? `${Math.abs(reminder.daysLeft)}日超過`
                    : `あと${reminder.daysLeft}日`})
                {/if}
              {:else}
                {reminder.value}
                {#if reminder.kmLeft != null}
                  ({reminder.kmLeft <= 0
                    ? `${Math.abs(reminder.kmLeft).toLocaleString()}km超過`
                    : `あと${reminder.kmLeft.toLocaleString()}km`})
                {/if}
              {/if}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- 最終メンテ一覧 -->
  {#if hasAnyMaintenance}
    <div class="bg-surface rounded-xl p-4">
      <h2 class="text-text-muted mb-3 text-sm font-medium">
        🔧 最終メンテナンス
      </h2>
      <div class="space-y-1.5">
        {#each lastMaintenanceDates() as m}
          {#if m.date != null}
            <a
              href={m.link}
              class="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-light"
            >
              <span class="flex items-center gap-2">
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </span>
              <span
                class="text-xs {m.status === 'danger'
                  ? 'font-bold text-red-400'
                  : m.status === 'warn'
                    ? 'text-amber-400'
                    : 'text-text-muted'}"
              >
                {m.days}日前
                <span class="text-text-muted ml-1 font-normal"
                  >({m.date?.slice(5)})</span
                >
              </span>
            </a>
          {/if}
        {/each}
        {#if lastMaintenanceDates().some((m) => m.date == null)}
          <div class="text-text-muted mt-1 text-xs opacity-60">
            未記録: {lastMaintenanceDates()
              .filter((m) => m.date == null)
              .map((m) => m.label)
              .join(", ")}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- 直近の記録 -->
  <div class="bg-surface rounded-xl p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-text-muted text-sm font-medium">📝 最近の記録</h2>
      {#if timeline.length > 0}
        <a href="/history" class="text-primary text-xs hover:underline"
          >すべて見る →</a
        >
      {/if}
    </div>
    {#if timeline.length > 0}
      <div class="space-y-2">
        {#each timeline as item}
          <div
            class="text-text-muted flex items-center justify-between text-sm"
          >
            <span>{formatRecordLine(item)}</span>
            <span class="text-xs">{item.date.slice(5)}</span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-text-muted text-sm">
        まだ記録がありません。記録タブから始めましょう!
      </p>
    {/if}
  </div>

  <!-- クイックアクション -->
  <div class="grid grid-cols-2 gap-3">
    <a
      href="/log/refuel"
      class="bg-surface hover:bg-surface-light flex items-center justify-center gap-2 rounded-xl py-4 text-center transition-colors"
    >
      <span class="text-2xl">⛽</span>
      <span class="font-medium">給油した</span>
    </a>
    <a
      href="/log"
      class="bg-surface hover:bg-surface-light flex items-center justify-center gap-2 rounded-xl py-4 text-center transition-colors"
    >
      <span class="text-2xl">🔧</span>
      <span class="font-medium">整備した</span>
    </a>
  </div>
</div>
