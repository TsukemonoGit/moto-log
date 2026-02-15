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
      const month = r.date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + (r.totalCost ?? 0));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  // 総給油量 (fuelAmount が記録されているもの)
  const totalFuel = $derived(
    vehicleRefuels.reduce((sum, r) => sum + (r.fuelAmount ?? 0), 0),
  );

  // 給油回数
  const refuelCount = $derived(vehicleRefuels.length);

  // --- 整備統計 ---
  const vehicleQuicks = $derived(
    records.quickRecords.filter((r) => r.vehicleId === vehicleId),
  );
  const vehicleShops = $derived(
    records.shopRecords.filter((r) => r.vehicleId === vehicleId),
  );
  const vehicleInspections = $derived(
    records.inspections.filter((r) => r.vehicleId === vehicleId),
  );

  // 今月の整備回数 (actionごと)
  const thisMonth = $derived(new Date().toISOString().slice(0, 7));
  const monthlyQuickCounts = $derived(() => {
    const map = new Map<string, number>();
    for (const r of vehicleQuicks) {
      if (r.date.startsWith(thisMonth)) {
        map.set(r.action, (map.get(r.action) ?? 0) + 1);
      }
    }
    return map;
  });

  // 年間の整備コスト (ショップ + 給油)
  const thisYear = $derived(new Date().getFullYear().toString());
  const yearlyShopCost = $derived(
    vehicleShops
      .filter((r) => r.date.startsWith(thisYear))
      .reduce((sum, r) => sum + (r.totalCost ?? 0), 0),
  );
  const yearlyFuelCost = $derived(
    vehicleRefuels
      .filter((r) => r.date.startsWith(thisYear))
      .reduce((sum, r) => sum + (r.totalCost ?? 0), 0),
  );

  // 月別コスト (給油＋ショップ) グラフ用
  const monthlyTotalCosts = $derived(() => {
    const map = new Map<string, { fuel: number; shop: number }>();
    for (const r of vehicleRefuels) {
      const month = r.date.slice(0, 7);
      const entry = map.get(month) ?? { fuel: 0, shop: 0 };
      entry.fuel += r.totalCost ?? 0;
      map.set(month, entry);
    }
    for (const r of vehicleShops) {
      const month = r.date.slice(0, 7);
      const entry = map.get(month) ?? { fuel: 0, shop: 0 };
      entry.shop += r.totalCost ?? 0;
      map.set(month, entry);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);
  });

  // ガソリン単価推移
  const priceHistory = $derived(
    vehicleRefuels
      .filter((r) => r.pricePerLiter != null)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-10)
      .map((r) => ({ date: r.date, price: r.pricePerLiter! })),
  );

  // 点検 ALL OK 率
  const inspOkRate = $derived(() => {
    if (vehicleInspections.length === 0) return null;
    const recent = vehicleInspections.slice(0, 10);
    const okCount = recent.filter((r) => r.allOk).length;
    return Math.round((okCount / recent.length) * 100);
  });

  // タブ
  type StatsTab = "fuel" | "maintenance" | "cost";
  let activeTab = $state<StatsTab>("fuel");

  const hasAnyData = $derived(
    vehicleRefuels.length > 0 ||
      vehicleQuicks.length > 0 ||
      vehicleShops.length > 0 ||
      vehicleInspections.length > 0,
  );
</script>

<div class="space-y-4">
  <h2 class="text-xl font-bold">📊 統計</h2>

  {#if !hasAnyData}
    <div class="bg-surface rounded-xl p-8 text-center">
      <p class="text-4xl">📈</p>
      <p class="text-text-muted mt-2">記録が増えると統計が表示されます</p>
      <a
        href="/log"
        class="text-primary mt-2 inline-block text-sm hover:underline"
        >記録を始める →</a
      >
    </div>
  {:else}
    <!-- タブ -->
    <div class="flex gap-1">
      {#each [["fuel", "⛽ 燃費"], ["maintenance", "🔧 整備"], ["cost", "💰 コスト"]] as [key, label]}
        <button
          onclick={() => (activeTab = key as StatsTab)}
          class="flex-1 rounded-lg py-2 text-xs font-medium transition-colors {activeTab ===
          key
            ? 'bg-primary text-white'
            : 'bg-surface text-text-muted hover:bg-surface-light'}"
        >
          {label}
        </button>
      {/each}
    </div>

    <!-- ===== 燃費タブ ===== -->
    {#if activeTab === "fuel"}
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
              <div class="text-lg font-bold text-amber-400">
                {bestWorst.best}
              </div>
              <div class="text-text-muted text-xs">km/L</div>
            </div>
            <div class="text-center">
              <div class="text-text-muted text-xs">最低</div>
              <div class="text-lg font-bold text-red-400">
                {bestWorst.worst}
              </div>
              <div class="text-text-muted text-xs">km/L</div>
            </div>
          </div>

          <!-- 燃費推移グラフ -->
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

      <!-- ガソリン単価推移 -->
      {#if priceHistory.length > 0}
        <div class="bg-surface rounded-xl p-4">
          <h3 class="text-text-muted mb-3 text-sm font-medium">
            💹 ガソリン単価推移
          </h3>
          <div class="space-y-1">
            {#each priceHistory as p}
              {@const maxPrice = Math.max(
                ...priceHistory.map((pp) => pp.price),
              )}
              {@const width = Math.min((p.price / maxPrice) * 100, 100)}
              <div class="flex items-center gap-2 text-xs">
                <span class="text-text-muted w-12">{p.date.slice(5)}</span>
                <div
                  class="h-4 flex-1 overflow-hidden rounded-full bg-slate-700"
                >
                  <div
                    class="h-full rounded-full bg-amber-500 transition-all"
                    style="width: {width}%"
                  ></div>
                </div>
                <span class="w-16 text-right">¥{p.price}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 給油サマリー -->
      <div class="bg-surface rounded-xl p-4">
        <h3 class="text-text-muted mb-3 text-sm font-medium">
          📊 給油サマリー
        </h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="text-center">
            <div class="text-text-muted text-xs">給油回数</div>
            <div class="text-lg font-bold">{refuelCount} 回</div>
          </div>
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
            <div class="text-3xl font-bold">
              {totalDistance.toLocaleString()}
            </div>
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

      <!-- ===== 整備タブ ===== -->
    {:else if activeTab === "maintenance"}
      <!-- 今月の整備 -->
      <div class="bg-surface rounded-xl p-4">
        <h3 class="text-text-muted mb-3 text-sm font-medium">🔧 今月の整備</h3>
        {#if monthlyQuickCounts().size > 0}
          <div class="flex flex-wrap gap-2">
            {#each [...monthlyQuickCounts().entries()] as [action, count]}
              <div class="bg-bg rounded-lg px-3 py-2 text-center">
                <div class="text-xs">
                  {QUICK_ACTION_LABELS[action] ?? action}
                </div>
                <div class="text-lg font-bold">{count}回</div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-text-muted text-sm">今月の整備記録はまだありません</p>
        {/if}
      </div>

      <!-- 全期間の整備回数 -->
      {#if vehicleQuicks.length > 0}
        {@const allCounts = (() => {
          const map = new Map<string, number>();
          for (const r of vehicleQuicks) {
            map.set(r.action, (map.get(r.action) ?? 0) + 1);
          }
          return [...map.entries()].sort((a, b) => b[1] - a[1]);
        })()}
        <div class="bg-surface rounded-xl p-4">
          <h3 class="text-text-muted mb-3 text-sm font-medium">
            📋 整備回数 (累計)
          </h3>
          <div class="space-y-2">
            {#each allCounts as [action, count]}
              {@const maxCount = allCounts[0][1]}
              {@const width = Math.min((count / maxCount) * 100, 100)}
              <div class="flex items-center gap-2 text-xs">
                <span class="w-24 truncate"
                  >{QUICK_ACTION_LABELS[action] ?? action}</span
                >
                <div
                  class="h-4 flex-1 overflow-hidden rounded-full bg-slate-700"
                >
                  <div
                    class="h-full rounded-full bg-green-500 transition-all"
                    style="width: {width}%"
                  ></div>
                </div>
                <span class="w-8 text-right font-bold">{count}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 点検 ALL OK 率 -->
      {#if inspOkRate() != null}
        <div class="bg-surface rounded-xl p-4">
          <h3 class="text-text-muted mb-3 text-sm font-medium">
            📋 点検 ALL OK 率
          </h3>
          <div class="text-center">
            <div
              class="text-3xl font-bold {inspOkRate()! >= 80
                ? 'text-green-400'
                : inspOkRate()! >= 50
                  ? 'text-amber-400'
                  : 'text-red-400'}"
            >
              {inspOkRate()}%
            </div>
            <div class="text-text-muted text-xs">
              直近{Math.min(vehicleInspections.length, 10)}回の点検
            </div>
          </div>
          <div class="mt-3 h-3 overflow-hidden rounded-full bg-slate-700">
            <div
              class="h-full rounded-full transition-all {inspOkRate()! >= 80
                ? 'bg-green-500'
                : inspOkRate()! >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'}"
              style="width: {inspOkRate()}%"
            ></div>
          </div>
        </div>
      {/if}

      <!-- ショップ整備サマリー -->
      {#if vehicleShops.length > 0}
        {@const workCounts = (() => {
          const map = new Map<string, number>();
          for (const r of vehicleShops) {
            for (const w of r.workDone) {
              map.set(w, (map.get(w) ?? 0) + 1);
            }
          }
          return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        })()}
        <div class="bg-surface rounded-xl p-4">
          <h3 class="text-text-muted mb-3 text-sm font-medium">
            🏭 ショップ整備
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center">
              <div class="text-text-muted text-xs">回数</div>
              <div class="text-lg font-bold">{vehicleShops.length} 回</div>
            </div>
            <div class="text-center">
              <div class="text-text-muted text-xs">累計費用</div>
              <div class="text-lg font-bold">
                ¥{vehicleShops
                  .reduce((s, r) => s + (r.totalCost ?? 0), 0)
                  .toLocaleString()}
              </div>
            </div>
          </div>
          {#if workCounts.length > 0}
            <div class="mt-3 flex flex-wrap gap-1.5">
              {#each workCounts as [work, count]}
                <span class="bg-bg rounded-full px-2.5 py-1 text-xs">
                  {work} ×{count}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- ===== コストタブ ===== -->
    {:else if activeTab === "cost"}
      <!-- 年間コスト -->
      <div class="bg-surface rounded-xl p-4">
        <h3 class="text-text-muted mb-3 text-sm font-medium">
          💰 {thisYear}年 コスト
        </h3>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div>
            <div class="text-text-muted text-xs">ガソリン代</div>
            <div class="text-lg font-bold">
              ¥{yearlyFuelCost.toLocaleString()}
            </div>
          </div>
          <div>
            <div class="text-text-muted text-xs">整備費</div>
            <div class="text-lg font-bold">
              ¥{yearlyShopCost.toLocaleString()}
            </div>
          </div>
          <div>
            <div class="text-text-muted text-xs">合計</div>
            <div class="text-lg font-bold text-amber-400">
              ¥{(yearlyFuelCost + yearlyShopCost).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <!-- 累計コスト -->
      <div class="bg-surface rounded-xl p-4">
        <h3 class="text-text-muted mb-3 text-sm font-medium">📊 累計</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="text-center">
            <div class="text-text-muted text-xs">累計ガソリン代</div>
            <div class="text-lg font-bold">¥{totalCost.toLocaleString()}</div>
          </div>
          <div class="text-center">
            <div class="text-text-muted text-xs">累計整備費</div>
            <div class="text-lg font-bold">
              ¥{vehicleShops
                .reduce((s, r) => s + (r.totalCost ?? 0), 0)
                .toLocaleString()}
            </div>
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

      <!-- 月別コスト推移 -->
      {#if monthlyTotalCosts().length > 0}
        {@const maxTotal = Math.max(
          ...monthlyTotalCosts().map(([, v]) => v.fuel + v.shop),
        )}
        <div class="bg-surface rounded-xl p-4">
          <h3 class="text-text-muted mb-3 text-sm font-medium">
            📈 月別コスト推移 (直近6ヶ月)
          </h3>
          <div class="space-y-1.5">
            {#each monthlyTotalCosts() as [month, costs]}
              {@const total = costs.fuel + costs.shop}
              {@const width =
                maxTotal > 0 ? Math.min((total / maxTotal) * 100, 100) : 0}
              {@const fuelRatio = total > 0 ? (costs.fuel / total) * 100 : 0}
              <div class="flex items-center gap-2 text-xs">
                <span class="text-text-muted w-10">{month.slice(5)}月</span>
                <div
                  class="h-5 flex-1 overflow-hidden rounded-full bg-slate-700"
                >
                  <div class="flex h-full" style="width: {width}%">
                    <div
                      class="h-full bg-blue-500"
                      style="width: {fuelRatio}%"
                    ></div>
                    <div
                      class="h-full bg-amber-500"
                      style="width: {100 - fuelRatio}%"
                    ></div>
                  </div>
                </div>
                <span class="w-16 text-right">¥{total.toLocaleString()}</span>
              </div>
            {/each}
          </div>
          <div class="text-text-muted mt-2 flex gap-4 text-xs">
            <span class="flex items-center gap-1">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-blue-500"
              ></span> 燃料
            </span>
            <span class="flex items-center gap-1">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"
              ></span> 整備
            </span>
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</div>
