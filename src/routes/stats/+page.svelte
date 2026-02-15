<script lang="ts">
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import {
    calculateFuelEfficiency,
    getAverageFuelEfficiency,
    getLatestFuelEfficiency,
    getBestWorstFuelEfficiency,
    getTotalFuelCost,
    getTotalDistance,
  } from "$lib/services/fuel-calc";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");
  const vehicleRefuels = $derived(
    records.refuels.filter((r) => r.vehicleId === vehicleId),
  );
  const vehicle = $derived(vehicleStore.activeVehicle);

  const efficiencies = $derived(calculateFuelEfficiency(vehicleRefuels));
  const avgFuel = $derived(getAverageFuelEfficiency(efficiencies));
  const latestFuel = $derived(getLatestFuelEfficiency(efficiencies));
  const bestWorst = $derived(getBestWorstFuelEfficiency(efficiencies));
  const totalCost = $derived(getTotalFuelCost(vehicleRefuels));
  const totalDistance = $derived(getTotalDistance(vehicleRefuels));
  const costPerKm = $derived(
    totalDistance && totalCost
      ? Math.round((totalCost / totalDistance) * 100) / 100
      : null,
  );

  // 月別ガソリン代
  const monthlyCosts = $derived(() => {
    const map = new Map<string, number>();
    for (const r of vehicleRefuels) {
      const month = r.date.slice(0, 7); // YYYY-MM
      map.set(month, (map.get(month) ?? 0) + (r.totalCost ?? 0));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  // 総給油量
  const totalFuel = $derived(
    vehicleRefuels.reduce((sum, r) => sum + r.fuelAmount, 0),
  );

  // 給油回数
  const refuelCount = $derived(vehicleRefuels.length);
</script>

<div class="space-y-4">
  <h2 class="text-xl font-bold">📊 統計</h2>

  {#if vehicleRefuels.length === 0}
    <div class="bg-surface rounded-xl p-8 text-center">
      <p class="text-4xl">📈</p>
      <p class="text-text-muted mt-2">給油記録が増えると統計が表示されます</p>
      <a
        href="/log/refuel"
        class="text-primary mt-2 inline-block text-sm hover:underline"
        >給油を記録する →</a
      >
    </div>
  {:else}
    <!-- 燃費 -->
    <div class="bg-surface rounded-xl p-4">
      <h3 class="text-text-muted mb-3 text-sm font-medium">⛽ 燃費</h3>
      {#if efficiencies.length > 0}
        <div class="grid grid-cols-2 gap-4">
          <div class="text-center">
            <div class="text-text-muted text-xs">直近</div>
            <div class="text-2xl font-bold text-blue-400">{latestFuel}</div>
            <div class="text-text-muted text-xs">km/L</div>
          </div>
          <div class="text-center">
            <div class="text-text-muted text-xs">平均</div>
            <div class="text-2xl font-bold text-green-400">{avgFuel}</div>
            <div class="text-text-muted text-xs">km/L</div>
          </div>
          <div class="text-center">
            <div class="text-text-muted text-xs">最高</div>
            <div class="text-lg font-bold text-amber-400">{bestWorst.best}</div>
            <div class="text-text-muted text-xs">km/L</div>
          </div>
          <div class="text-center">
            <div class="text-text-muted text-xs">最低</div>
            <div class="text-lg font-bold text-red-400">{bestWorst.worst}</div>
            <div class="text-text-muted text-xs">km/L</div>
          </div>
        </div>

        <!-- 燃費推移 (テキストベースの簡易グラフ) -->
        <div class="mt-4">
          <p class="text-text-muted mb-2 text-xs">燃費推移 (直近10回)</p>
          <div class="space-y-1">
            {#each efficiencies.slice(-10) as eff}
              {@const maxKmpl = bestWorst.best ?? 40}
              {@const width = Math.min((eff.kmPerLiter / maxKmpl) * 100, 100)}
              <div class="flex items-center gap-2 text-xs">
                <span class="text-text-muted w-12">{eff.date.slice(5)}</span>
                <div
                  class="h-4 flex-1 overflow-hidden rounded-full bg-slate-700"
                >
                  <div
                    class="h-full rounded-full bg-blue-500 transition-all"
                    style="width: {width}%"
                  ></div>
                </div>
                <span class="w-16 text-right">{eff.kmPerLiter} km/L</span>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <p class="text-text-muted text-sm">
          ODO を入力した満タン給油が2回以上で燃費が計算されます
        </p>
      {/if}
    </div>

    <!-- コスト -->
    <div class="bg-surface rounded-xl p-4">
      <h3 class="text-text-muted mb-3 text-sm font-medium">💰 コスト</h3>
      <div class="grid grid-cols-2 gap-4">
        <div class="text-center">
          <div class="text-text-muted text-xs">累計ガソリン代</div>
          <div class="text-lg font-bold">¥{totalCost.toLocaleString()}</div>
        </div>
        <div class="text-center">
          <div class="text-text-muted text-xs">給油回数</div>
          <div class="text-lg font-bold">{refuelCount} 回</div>
        </div>
        {#if costPerKm}
          <div class="text-center">
            <div class="text-text-muted text-xs">1km あたりコスト</div>
            <div class="text-lg font-bold">¥{costPerKm}</div>
          </div>
        {/if}
        <div class="text-center">
          <div class="text-text-muted text-xs">総給油量</div>
          <div class="text-lg font-bold">
            {Math.round(totalFuel * 10) / 10} L
          </div>
        </div>
      </div>
    </div>

    <!-- 走行距離 -->
    {#if totalDistance}
      <div class="bg-surface rounded-xl p-4">
        <h3 class="text-text-muted mb-3 text-sm font-medium">🛣️ 走行距離</h3>
        <div class="text-center">
          <div class="text-3xl font-bold">{totalDistance.toLocaleString()}</div>
          <div class="text-text-muted text-sm">km (記録期間の総走行距離)</div>
        </div>
      </div>
    {/if}

    <!-- 航続距離予測 -->
    {#if avgFuel && vehicle?.fuelTankCapacity}
      <div class="bg-surface rounded-xl p-4">
        <h3 class="text-text-muted mb-3 text-sm font-medium">
          🔮 航続距離予測
        </h3>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-400">
            {Math.round(avgFuel * vehicle.fuelTankCapacity)} km
          </div>
          <div class="text-text-muted text-xs">
            平均燃費 {avgFuel} km/L × タンク {vehicle.fuelTankCapacity}L
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
