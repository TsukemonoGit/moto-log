<script lang="ts">
  import {
    vehicleStore,
    records,
    auth,
    pagination,
  } from "$lib/stores/app.svelte";
  import { QUICK_ACTION_LABELS, SHOP_CATEGORY_LABELS } from "$lib/constants";
  import { loadMoreData } from "$lib/nostr/subscribe";
  import { toastStore } from "$lib/stores/toast.svelte";
  import type { TimelineItem } from "$lib/models/types";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");
  const timeline = $derived(records.getTimeline(vehicleId));

  // --- フィルター ---
  type FilterType = "all" | "refuel" | "quick" | "inspection" | "shop";
  let activeFilter = $state<FilterType>("all");
  let quickSubFilter = $state<string | null>(null);

  const filterTabs: { key: FilterType; icon: string; label: string }[] = [
    { key: "all", icon: "📋", label: "全て" },
    { key: "refuel", icon: "⛽", label: "給油" },
    { key: "quick", icon: "🔧", label: "整備" },
    { key: "inspection", icon: "📋", label: "点検" },
    { key: "shop", icon: "🏭", label: "ショップ" },
  ];

  const filtered = $derived(() => {
    let items = timeline;
    if (activeFilter !== "all") {
      if (activeFilter === "quick") {
        // quick には odometer も含める
        items = items.filter(
          (i) => i.type === "quick" || i.type === "odometer",
        );
      } else {
        items = items.filter((i) => i.type === activeFilter);
      }
    }
    if (activeFilter === "quick" && quickSubFilter) {
      items = items.filter(
        (i) =>
          i.type === "odometer" ||
          (i.type === "quick" && i.record.action === quickSubFilter),
      );
    }
    return items;
  });

  // 整備サブフィルタ用: 使われているアクション一覧
  const usedQuickActions = $derived(() => {
    const actions = new Set<string>();
    for (const r of records.quickRecords.filter(
      (r) => r.vehicleId === vehicleId,
    )) {
      actions.add(r.action);
    }
    return [...actions];
  });

  // --- 月別グルーピング ---
  type MonthGroup = {
    month: string; // "2026-02"
    label: string; // "2026年2月"
    items: typeof timeline;
    summary: { count: number; fuelCost: number; shopCost: number };
  };

  const monthGroups = $derived((): MonthGroup[] => {
    const items = filtered();
    const map = new Map<string, (typeof timeline)[number][]>();

    for (const item of items) {
      const month = item.date.slice(0, 7);
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(item);
    }

    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, items]) => {
        const [y, m] = month.split("-");
        let fuelCost = 0;
        let shopCost = 0;
        for (const item of items) {
          if (item.type === "refuel") fuelCost += item.record.totalCost ?? 0;
          if (item.type === "shop") shopCost += item.record.totalCost ?? 0;
        }
        return {
          month,
          label: `${y}年${parseInt(m)}月`,
          items,
          summary: { count: items.length, fuelCost, shopCost },
        };
      });
  });

  // --- 経過日数 ---
  function daysAgo(dateStr: string): number {
    const now = new Date();
    const d = new Date(dateStr);
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  }

  // --- 給油間の走行距離 ---
  function getPrevRefuelOdo(currentItem: TimelineItem): number | null {
    if (currentItem.type !== "refuel") return null;
    const r = currentItem.record;
    if (r.odometer == null) return null;
    const refuels = records.refuels
      .filter((x) => x.vehicleId === vehicleId && x.odometer != null)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    const idx = refuels.findIndex((x) => x.id === r.id);
    if (idx < 0 || idx >= refuels.length - 1) return null;
    return refuels[idx + 1].odometer!;
  }

  function getIcon(type: string): string {
    const icons: Record<string, string> = {
      refuel: "⛽",
      quick: "🔧",
      inspection: "📋",
      shop: "🏭",
      odometer: "📏",
    };
    return icons[type] || "📝";
  }

  async function handleLoadMore() {
    if (!auth.pubkey || !pagination.hasMore) return;
    pagination.setLoadingMore(true);
    try {
      const data = await loadMoreData(auth.pubkey, pagination.cursor);
      records.appendAll(data);
      pagination.setCursor(data.cursor, data.hasMore);
      if (!data.hasMore) {
        toastStore.show("すべてのデータを読み込みました");
      }
    } catch (e) {
      console.error("Load more failed:", e);
      toastStore.show("追加データの取得に失敗しました");
    } finally {
      pagination.setLoadingMore(false);
    }
  }
</script>

<div class="space-y-3">
  <h2 class="text-xl font-bold">📋 履歴</h2>

  <!-- フィルタータブ -->
  <div class="flex gap-1 overflow-x-auto pb-1">
    {#each filterTabs as tab}
      <button
        onclick={() => {
          activeFilter = tab.key;
          quickSubFilter = null;
        }}
        class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors {activeFilter ===
        tab.key
          ? 'bg-primary text-white'
          : 'bg-surface text-text-muted hover:bg-surface-light'}"
      >
        {tab.icon}
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- 整備サブフィルタ -->
  {#if activeFilter === "quick" && usedQuickActions().length > 0}
    <div class="flex flex-wrap gap-1">
      <button
        onclick={() => (quickSubFilter = null)}
        class="rounded-full px-2.5 py-1 text-xs transition-colors {quickSubFilter ===
        null
          ? 'bg-blue-600 text-white'
          : 'bg-surface-light text-text-muted'}"
      >
        全て
      </button>
      {#each usedQuickActions() as action}
        <button
          onclick={() =>
            (quickSubFilter = quickSubFilter === action ? null : action)}
          class="rounded-full px-2.5 py-1 text-xs transition-colors {quickSubFilter ===
          action
            ? 'bg-blue-600 text-white'
            : 'bg-surface-light text-text-muted'}"
        >
          {#if action === "custom"}
            {@const customNames = records.quickRecords
              .filter(
                (r) =>
                  r.vehicleId === vehicleId &&
                  r.action === "custom" &&
                  r.customName,
              )
              .map((r) => r.customName)}
            {customNames.length > 0
              ? `📝 ${[...new Set(customNames)].join("/")}`
              : (QUICK_ACTION_LABELS[action] ?? action)}
          {:else}
            {QUICK_ACTION_LABELS[action] ?? action}
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if filtered().length === 0}
    <div class="bg-surface rounded-xl p-8 text-center">
      <p class="text-text-muted text-4xl">📝</p>
      <p class="text-text-muted mt-2">
        {activeFilter === "all"
          ? "まだ記録がありません"
          : "この種類の記録はまだありません"}
      </p>
      <a
        href="/log"
        class="text-primary mt-2 inline-block text-sm hover:underline"
        >記録を始める →</a
      >
    </div>
  {:else}
    <!-- 月別グループ -->
    {#each monthGroups() as group}
      <div>
        <!-- 月ヘッダー -->
        <div class="flex items-center justify-between py-2">
          <h3 class="text-sm font-bold">{group.label}</h3>
          <div class="text-text-muted flex gap-3 text-xs">
            <span>{group.summary.count}件</span>
            {#if group.summary.fuelCost > 0}
              <span>⛽ ¥{group.summary.fuelCost.toLocaleString()}</span>
            {/if}
            {#if group.summary.shopCost > 0}
              <span>🏭 ¥{group.summary.shopCost.toLocaleString()}</span>
            {/if}
          </div>
        </div>

        <!-- カード一覧 -->
        <div class="space-y-2">
          {#each group.items as item}
            <a
              href="/edit?id={encodeURIComponent(item.record.id)}"
              class="bg-surface block rounded-xl p-3 transition-colors hover:bg-surface-light"
            >
              <!-- 給油カード -->
              {#if item.type === "refuel"}
                {@const r = item.record}
                {@const prevOdo = getPrevRefuelOdo(item)}
                <div class="flex items-start gap-3">
                  <span class="mt-0.5 text-xl">⛽</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium">
                        {#if r.fuelAmount != null}
                          給油 {r.fuelAmount}L {r.isFullTank ? "(満タン)" : ""}
                        {:else}
                          {r.isFullTank ? "満タン給油" : "給油"}
                        {/if}
                      </span>
                      <span class="text-text-muted text-xs"
                        >{item.date.slice(5)}</span
                      >
                    </div>
                    <div
                      class="text-text-muted mt-0.5 flex flex-wrap gap-x-3 text-xs"
                    >
                      {#if r.totalCost}
                        <span>¥{r.totalCost.toLocaleString()}</span>
                      {/if}
                      {#if r.pricePerLiter}
                        <span>@{r.pricePerLiter}円/L</span>
                      {/if}
                      {#if r.odometer}
                        <span>{r.odometer.toLocaleString()} km</span>
                      {/if}
                    </div>
                    {#if prevOdo != null && r.odometer}
                      <div class="text-text-muted mt-0.5 text-xs">
                        前回から {(r.odometer - prevOdo).toLocaleString()} km
                        {#if r.fuelAmount && r.odometer - prevOdo > 0}
                          · 燃費 {Math.round(
                            ((r.odometer - prevOdo) / r.fuelAmount) * 100,
                          ) / 100} km/L
                        {/if}
                      </div>
                    {/if}
                    {#if r.station}
                      <div class="text-text-muted mt-0.5 text-xs">
                        🏭 {r.station}
                      </div>
                    {/if}
                    {#if r.notes}
                      <div class="text-text-muted mt-0.5 text-xs">
                        📝 {r.notes}
                      </div>
                    {/if}
                  </div>
                  <span class="text-text-muted text-xs">✏️</span>
                </div>

                <!-- クイック整備カード -->
              {:else if item.type === "quick"}
                {@const r = item.record}
                {@const lastSame = (() => {
                  const same = records.quickRecords
                    .filter(
                      (x) =>
                        x.vehicleId === vehicleId &&
                        x.action === r.action &&
                        x.date < item.date,
                    )
                    .sort((a, b) => (a.date > b.date ? -1 : 1));
                  return same[0]?.date ?? null;
                })()}
                <div class="flex items-start gap-3">
                  <span class="mt-0.5 text-xl">{getIcon(item.type)}</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium">
                        {#if r.action === "custom" && r.customName}
                          📝 {r.customName}
                        {:else}
                          {QUICK_ACTION_LABELS[r.action] ?? "整備"}
                        {/if}
                      </span>
                      <span class="text-text-muted text-xs"
                        >{item.date.slice(5)}</span
                      >
                    </div>
                    {#if r.notes}
                      <div class="text-text-muted mt-0.5 text-xs">
                        {r.notes}
                      </div>
                    {/if}
                    {#if lastSame}
                      <div class="text-text-muted mt-0.5 text-xs">
                        前回: {daysAgo(lastSame)}日前 ({lastSame.slice(5)})
                      </div>
                    {/if}
                  </div>
                  <span class="text-text-muted text-xs">✏️</span>
                </div>

                <!-- 点検カード -->
              {:else if item.type === "inspection"}
                {@const r = item.record}
                <div class="flex items-start gap-3">
                  <span class="mt-0.5 text-xl">📋</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium">
                        {{ daily: "日常", weekly: "週間", monthly: "月間" }[
                          r.type
                        ] ?? ""}点検
                        <span
                          class="ml-1 rounded px-1.5 py-0.5 text-xs {r.allOk
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-red-900/30 text-red-400'}"
                        >
                          {r.allOk ? "ALL OK" : "要確認"}
                        </span>
                      </span>
                      <span class="text-text-muted text-xs"
                        >{item.date.slice(5)}</span
                      >
                    </div>
                    {#if !r.allOk && r.issues?.length}
                      <div
                        class="text-text-muted mt-0.5 flex flex-wrap gap-1 text-xs"
                      >
                        {#each r.issues as issue}
                          <span
                            class="inline-flex items-center gap-0.5 {issue.status ===
                            'ng'
                              ? 'text-red-400'
                              : issue.status === 'warning'
                                ? 'text-yellow-400'
                                : 'text-text-muted'}"
                          >
                            {issue.status === "ng"
                              ? "❌"
                              : issue.status === "warning"
                                ? "⚠️"
                                : "❓"}{issue.item}
                          </span>
                        {/each}
                      </div>
                    {/if}
                    {#if r.notes}
                      <div class="text-text-muted mt-0.5 text-xs">
                        {r.notes}
                      </div>
                    {/if}
                  </div>
                  <span class="text-text-muted text-xs">✏️</span>
                </div>

                <!-- ショップ整備カード -->
              {:else if item.type === "shop"}
                {@const r = item.record}
                <div class="flex items-start gap-3">
                  <span class="mt-0.5 text-xl">🏭</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium">
                        ショップ整備
                        {#if r.shopName}
                          <span class="text-text-muted font-normal"
                            >@{r.shopName}</span
                          >
                        {/if}
                        {#if r.category}
                          <span
                            class="bg-surface-light text-text-muted ml-1 rounded px-1.5 py-0.5 text-xs"
                          >
                            {SHOP_CATEGORY_LABELS[r.category] ?? r.category}
                          </span>
                        {/if}
                      </span>
                      <span class="text-text-muted text-xs"
                        >{item.date.slice(5)}</span
                      >
                    </div>
                    {#if r.workDone?.length}
                      <div class="text-text-muted mt-0.5 text-xs">
                        {r.workDone.join(" / ")}
                      </div>
                    {/if}
                    <div
                      class="text-text-muted mt-0.5 flex flex-wrap gap-x-3 text-xs"
                    >
                      {#if r.totalCost}
                        <span>¥{r.totalCost.toLocaleString()}</span>
                      {/if}
                      {#if r.odometer}
                        <span>{r.odometer.toLocaleString()} km</span>
                      {/if}
                      {#if r.nextDate}
                        <span>次回: {r.nextDate}</span>
                      {/if}
                    </div>
                    {#if r.notes}
                      <div class="text-text-muted mt-0.5 text-xs">
                        📝 {r.notes}
                      </div>
                    {/if}
                  </div>
                  <span class="text-text-muted text-xs">✏️</span>
                </div>

                <!-- ODO カード -->
              {:else if item.type === "odometer"}
                <div class="flex items-start gap-3">
                  <span class="mt-0.5 text-xl">📏</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium">
                        走行距離 {item.record.odometer.toLocaleString()} km
                      </span>
                      <span class="text-text-muted text-xs"
                        >{item.date.slice(5)}</span
                      >
                    </div>
                  </div>
                  <span class="text-text-muted text-xs">✏️</span>
                </div>
              {/if}
            </a>
          {/each}
        </div>
      </div>
    {/each}
  {/if}

  <!-- もっと読む -->
  {#if pagination.hasMore}
    <button
      onclick={handleLoadMore}
      disabled={pagination.loadingMore}
      class="w-full rounded-lg bg-card hover:bg-white/10 px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40"
    >
      {#if pagination.loadingMore}
        ⏳ 読み込み中...
      {:else}
        📜 もっと読む
      {/if}
    </button>
  {/if}
</div>
