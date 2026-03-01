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

  const remainingFuel = $derived(
    vehicle?.fuelTankCapacity
      ? estimateRemainingFuel(vehicleRefuels, vehicle.fuelTankCapacity, avgFuel)
      : null,
  );
</script>

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
  <div class="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm">
    💡 給油時に走行距離 (ODO) を入力すると、より正確な燃費がわかります
  </div>
{/if}
