<script lang="ts">
  import {
    vehicleStore,
    records,
    maintenanceSettings,
  } from "$lib/stores/app.svelte";
  import type { QuickActionType } from "$lib/models/types";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");

  const maintenanceItems: {
    action: QuickActionType;
    icon: string;
    label: string;
  }[] = [
    { action: "chain-lube", icon: "🔗", label: "チェーン注油" },
    { action: "tire-pressure", icon: "💨", label: "空気圧チェック" },
    { action: "wash", icon: "🚿", label: "洗車" },
    { action: "chain-clean", icon: "🔗", label: "チェーン清掃" },
    { action: "oil-check", icon: "🛢", label: "オイル確認" },
    { action: "coolant-check", icon: "💧", label: "冷却水確認" },
    { action: "battery-charge", icon: "🔋", label: "バッテリー充電" },
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
      const threshold = maintenanceSettings.thresholds[item.action];
      let status: "ok" | "warn" | "danger" | "none" = "none";
      if (days != null && threshold) {
        if (days >= threshold.dangerDays) status = "danger";
        else if (days >= threshold.warnDays) status = "warn";
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

    // カスタム整備: customName ごとにグルーピングして追跡
    const customRecs = quickRecs.filter(
      (r) => r.action === "custom" && r.customName,
    );
    const customNames = [...new Set(customRecs.map((r) => r.customName!))];
    for (const name of customNames) {
      const latest = customRecs
        .filter((r) => r.customName === name)
        .sort((a, b) => (a.date > b.date ? -1 : 1))[0];
      const days = latest ? daysAgo(latest.date) : null;
      const thresholdKey = `custom:${name}`;
      const threshold = maintenanceSettings.thresholds[thresholdKey] ?? {
        warnDays: 30,
        dangerDays: 60,
      };
      let status: "ok" | "warn" | "danger" | "none" = "none";
      if (days != null) {
        if (days >= threshold.dangerDays) status = "danger";
        else if (days >= threshold.warnDays) status = "warn";
        else status = "ok";
      }
      result.push({
        action: thresholdKey,
        icon: "📝",
        label: name,
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
        const oilThreshold = maintenanceSettings.thresholds["oil-check"];
        result[oilIdx] = {
          ...result[oilIdx],
          date: shopOilChange.date,
          days,
          label: "オイル交換",
          status:
            days >= (oilThreshold?.dangerDays ?? 60)
              ? "danger"
              : days >= (oilThreshold?.warnDays ?? 30)
                ? "warn"
                : "ok",
        };
      }
    }

    return result;
  });

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

    const shopRecs = records.shopRecords
      .filter((r) => r.vehicleId === vehicleId)
      .sort((a, b) => (a.date > b.date ? -1 : 1));

    const allOdo: number[] = [];
    for (const r of records.refuels) {
      if (r.vehicleId === vehicleId && r.odometer != null)
        allOdo.push(r.odometer);
    }
    for (const r of records.odometerRecords) {
      if (r.vehicleId === vehicleId) allOdo.push(r.odometer);
    }
    const latestOdo = allOdo.length > 0 ? Math.max(...allOdo) : null;

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

    reminders.sort((a, b) => {
      const aUrgency = a.status === "danger" ? 0 : a.status === "warn" ? 1 : 2;
      const bUrgency = b.status === "danger" ? 0 : b.status === "warn" ? 1 : 2;
      return aUrgency - bUrgency;
    });

    return reminders;
  });
</script>

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
