<script lang="ts">
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import {
    calculateFuelEfficiency,
    getAverageFuelEfficiency,
    getLatestFuelEfficiency,
    getBestWorstFuelEfficiency,
    getTotalFuelCost,
    getTotalDistance,
    estimateRemainingFuel,
  } from "$lib/services/fuel-calc";

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
      const actionLabels: Record<string, string> = {
        "tire-pressure": "💨 空気圧チェック",
        "chain-lube": "🔗 チェーン注油",
        "chain-clean": "🔗 チェーン清掃",
        "chain-adjust": "🔗 チェーン調整",
        wash: "🚿 洗車",
        "oil-check": "🛢 オイル確認",
        "coolant-check": "💧 冷却水確認",
        "battery-charge": "🔋 バッテリー充電",
        custom: "📝 メンテナンス",
      };
      return actionLabels[(item.record as any).action] || "🔧 整備";
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

  <!-- 直近の記録 -->
  <div class="bg-surface rounded-xl p-4">
    <h2 class="text-text-muted mb-3 text-sm font-medium">📝 最近の記録</h2>
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
