<script lang="ts">
  import {
    auth,
    rawEventStore,
    vehicleStore,
    records,
  } from "$lib/stores/app.svelte";
  import { refetchRawEvents } from "$lib/nostr/subscribe";
  import { toastStore } from "$lib/stores/toast.svelte";
  import type { NostrEvent } from "nostr-tools";

  type EventCategory =
    | "all"
    | "vehicle"
    | "refuel"
    | "quick"
    | "inspection"
    | "shop"
    | "odometer"
    | "unknown";

  const filterTabs: { key: EventCategory; icon: string; label: string }[] = [
    { key: "all", icon: "📋", label: "全て" },
    { key: "vehicle", icon: "🏍️", label: "車両" },
    { key: "refuel", icon: "⛽", label: "給油" },
    { key: "quick", icon: "🔧", label: "整備" },
    { key: "inspection", icon: "📋", label: "点検" },
    { key: "shop", icon: "🏭", label: "ショップ" },
    { key: "odometer", icon: "📏", label: "走行距離" },
  ];

  let activeFilter = $state<EventCategory>("all");
  let expandedIds = $state<Set<string>>(new Set());
  let refetching = $state(false);
  let refetchedEvents = $state<NostrEvent[] | null>(null);

  /** d-tag からカテゴリを判定 */
  function categorize(dTag: string): EventCategory {
    if (dTag.startsWith("vehicle:")) return "vehicle";
    if (dTag.startsWith("refuel:")) return "refuel";
    if (dTag.startsWith("quick:")) return "quick";
    if (dTag.startsWith("inspection:")) return "inspection";
    if (dTag.startsWith("shop:")) return "shop";
    if (dTag.startsWith("odometer:")) return "odometer";
    return "unknown";
  }

  /** ストアに保持している全イベントをリスト化 */
  const allEvents = $derived(
    (): { dTag: string; event: NostrEvent; category: EventCategory }[] => {
      const items: {
        dTag: string;
        event: NostrEvent;
        category: EventCategory;
      }[] = [];
      for (const [dTag, event] of rawEventStore.events) {
        items.push({ dTag, event, category: categorize(dTag) });
      }
      items.sort((a, b) => b.event.created_at - a.event.created_at);
      return items;
    },
  );

  const filteredEvents = $derived(
    (): { dTag: string; event: NostrEvent; category: EventCategory }[] => {
      const items = allEvents();
      if (activeFilter === "all") return items;
      return items.filter((i) => i.category === activeFilter);
    },
  );

  const categoryCount = $derived((): Record<EventCategory, number> => {
    const counts: Record<EventCategory, number> = {
      all: 0,
      vehicle: 0,
      refuel: 0,
      quick: 0,
      inspection: 0,
      shop: 0,
      odometer: 0,
      unknown: 0,
    };
    for (const item of allEvents()) {
      counts[item.category]++;
      counts.all++;
    }
    return counts;
  });

  function categoryIcon(cat: EventCategory): string {
    const icons: Record<EventCategory, string> = {
      all: "📋",
      vehicle: "🏍️",
      refuel: "⛽",
      quick: "🔧",
      inspection: "📋",
      shop: "🏭",
      odometer: "📏",
      unknown: "❓",
    };
    return icons[cat];
  }

  function categoryLabel(cat: EventCategory): string {
    const labels: Record<EventCategory, string> = {
      all: "全て",
      vehicle: "車両",
      refuel: "給油",
      quick: "整備",
      inspection: "点検",
      shop: "ショップ",
      odometer: "走行距離",
      unknown: "不明",
    };
    return labels[cat];
  }

  function toggleExpand(eventId: string) {
    const next = new Set(expandedIds);
    if (next.has(eventId)) {
      next.delete(eventId);
    } else {
      next.add(eventId);
    }
    expandedIds = next;
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString("ja-JP");
  }

  function truncateId(id: string, len = 16): string {
    if (id.length <= len) return id;
    return id.slice(0, len / 2) + "..." + id.slice(-len / 2);
  }

  /** 個別イベントのJSONをコピー */
  async function copyEventJson(event: NostrEvent) {
    const json = JSON.stringify(event, null, 2);
    await navigator.clipboard.writeText(json);
    toastStore.show("JSONをコピーしました");
  }

  /** パース済みcontentを取得 */
  function parseContent(content: string): string {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }

  /** 全イベントJSONをコピー */
  async function copyAllEventsJson() {
    const events = filteredEvents().map((i) => i.event);
    const json = JSON.stringify(events, null, 2);
    await navigator.clipboard.writeText(json);
    toastStore.show(`${events.length}件のイベントJSONをコピーしました`);
  }

  /** リレーから再取得 */
  async function handleRefetch() {
    if (!auth.pubkey) return;
    refetching = true;
    refetchedEvents = null;
    try {
      const events = await refetchRawEvents(auth.pubkey);
      refetchedEvents = events;
      toastStore.show(`リレーから${events.length}件取得しました`);
    } catch (e) {
      toastStore.show("再取得に失敗しました");
      console.error(e);
    } finally {
      refetching = false;
    }
  }

  /** 再取得結果のJSONをコピー */
  async function copyRefetchedJson() {
    if (!refetchedEvents) return;
    const json = JSON.stringify(refetchedEvents, null, 2);
    await navigator.clipboard.writeText(json);
    toastStore.show(
      `${refetchedEvents.length}件のイベントJSONをコピーしました`,
    );
  }
</script>

<div class="space-y-4">
  <!-- ヘッダー -->
  <div class="flex items-center gap-3">
    <a
      href="/settings"
      class="text-text-muted hover:text-white transition-colors">←</a
    >
    <h2 class="text-xl font-bold">🛠️ 開発者情報</h2>
  </div>

  <div
    class="rounded-lg bg-yellow-900/30 border border-yellow-700/50 p-3 text-sm text-yellow-200"
  >
    ⚠️ この画面はNostrイベントの生データを表示します。
    Nostrの特性上、削除リクエスト(kind
    5)を送ってもリレー上にデータが残る場合があります。
  </div>

  <!-- 保持イベント数 -->
  <div class="rounded-lg bg-card p-3">
    <div class="text-sm text-text-muted mb-1">保持イベント数</div>
    <div class="text-2xl font-bold">
      {categoryCount().all}<span class="text-sm text-text-muted ml-1">件</span>
    </div>
  </div>

  <!-- フィルタータブ -->
  <div class="flex gap-1 overflow-x-auto pb-1">
    {#each filterTabs as tab}
      <button
        onclick={() => (activeFilter = tab.key)}
        class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors
          {activeFilter === tab.key
          ? 'bg-primary text-white'
          : 'bg-card text-text-muted hover:text-white'}"
      >
        {tab.icon}
        {tab.label}
        <span class="ml-0.5 opacity-70">({categoryCount()[tab.key]})</span>
      </button>
    {/each}
  </div>

  <!-- イベント一覧 -->
  <div class="space-y-2">
    {#each filteredEvents() as { dTag, event, category } (event.id)}
      <div class="rounded-lg bg-card border border-white/5 overflow-hidden">
        <!-- カードヘッダー -->
        <button
          onclick={() => toggleExpand(event.id)}
          class="w-full text-left p-3 hover:bg-white/5 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-lg">{categoryIcon(category)}</span>
              <div class="min-w-0">
                <div class="text-sm font-medium truncate">{dTag}</div>
                <div class="text-xs text-text-muted">
                  {formatTimestamp(event.created_at)}
                </div>
              </div>
            </div>
            <span class="text-text-muted text-sm shrink-0 ml-2">
              {expandedIds.has(event.id) ? "▲" : "▼"}
            </span>
          </div>
          <div class="mt-1 text-xs text-text-muted font-mono truncate">
            ID: {truncateId(event.id)}
          </div>
        </button>

        <!-- 展開コンテンツ -->
        {#if expandedIds.has(event.id)}
          <div class="border-t border-white/5 p-3 space-y-3">
            <!-- メタ情報 -->
            <div class="space-y-1 text-xs">
              <div class="flex gap-2">
                <span class="text-text-muted w-20 shrink-0">Event ID</span>
                <span class="font-mono break-all">{event.id}</span>
              </div>
              <div class="flex gap-2">
                <span class="text-text-muted w-20 shrink-0">Pubkey</span>
                <span class="font-mono break-all">{event.pubkey}</span>
              </div>
              <div class="flex gap-2">
                <span class="text-text-muted w-20 shrink-0">Kind</span>
                <span class="font-mono">{event.kind}</span>
              </div>
              <div class="flex gap-2">
                <span class="text-text-muted w-20 shrink-0">d-tag</span>
                <span class="font-mono break-all">{dTag}</span>
              </div>
              <div class="flex gap-2">
                <span class="text-text-muted w-20 shrink-0">Created</span>
                <span class="font-mono"
                  >{event.created_at} ({formatTimestamp(
                    event.created_at,
                  )})</span
                >
              </div>
            </div>

            <!-- 生JSON -->
            <div>
              <div class="text-xs text-text-muted mb-1 font-medium">
                生イベント JSON
              </div>
              <pre
                class="rounded bg-black/40 p-2 text-xs font-mono overflow-x-auto text-green-300 max-h-64 overflow-y-auto">{JSON.stringify(
                  event,
                  null,
                  2,
                )}</pre>
            </div>

            <!-- パース済み content -->
            <div>
              <div class="text-xs text-text-muted mb-1 font-medium">
                Content（パース済み）
              </div>
              <pre
                class="rounded bg-black/40 p-2 text-xs font-mono overflow-x-auto text-blue-300 max-h-48 overflow-y-auto">{parseContent(
                  event.content,
                )}</pre>
            </div>

            <!-- Tags -->
            <div>
              <div class="text-xs text-text-muted mb-1 font-medium">Tags</div>
              <div
                class="rounded bg-black/40 p-2 text-xs font-mono space-y-0.5 max-h-32 overflow-y-auto"
              >
                {#each event.tags as tag}
                  <div class="text-amber-300">
                    [{tag.map((t: string) => `"${t}"`).join(", ")}]
                  </div>
                {/each}
              </div>
            </div>

            <button
              onclick={() => copyEventJson(event)}
              class="w-full rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-medium transition-colors"
            >
              📋 JSONをコピー
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="text-center text-text-muted py-8 text-sm">
        イベントがありません
      </div>
    {/each}
  </div>

  <!-- アクション -->
  <div class="space-y-2 pt-2">
    <button
      onclick={copyAllEventsJson}
      disabled={filteredEvents().length === 0}
      class="w-full rounded-lg bg-card hover:bg-white/10 px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40"
    >
      📋 {activeFilter === "all"
        ? "全"
        : categoryLabel(activeFilter)}イベントJSON をコピー ({filteredEvents()
        .length}件)
    </button>

    <button
      onclick={handleRefetch}
      disabled={refetching || !auth.pubkey}
      class="w-full rounded-lg bg-primary/20 hover:bg-primary/30 text-primary px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40"
    >
      {#if refetching}
        ⏳ リレーから取得中...
      {:else}
        🔄 リレーから再取得
      {/if}
    </button>
  </div>

  <!-- リレー再取得結果 -->
  {#if refetchedEvents}
    <div class="rounded-lg bg-card border border-white/5 p-3 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-medium text-sm">🔄 リレー再取得結果</h3>
        <span class="text-xs text-text-muted">{refetchedEvents.length}件</span>
      </div>

      <div class="text-xs text-text-muted">
        ストア保持: {categoryCount().all}件 → リレー上: {refetchedEvents.length}件
        {#if refetchedEvents.length > categoryCount().all}
          <span class="text-yellow-400 ml-1"
            >⚠️ リレーに多い（削除済みイベントが残存の可能性）</span
          >
        {:else if refetchedEvents.length < categoryCount().all}
          <span class="text-blue-400 ml-1">ℹ️ リレーの方が少ない</span>
        {:else}
          <span class="text-green-400 ml-1">✓ 一致</span>
        {/if}
      </div>

      <!-- 再取得イベント一覧 -->
      <div class="space-y-1 max-h-64 overflow-y-auto">
        {#each refetchedEvents as event (event.id)}
          {@const dTag =
            event.tags.find((t: string[]) => t[0] === "d")?.[1] || "(no d-tag)"}
          <div
            class="flex items-center gap-2 text-xs rounded bg-black/20 px-2 py-1.5"
          >
            <span>{categoryIcon(categorize(dTag))}</span>
            <span class="font-mono truncate flex-1">{dTag}</span>
            <span class="text-text-muted shrink-0"
              >{formatTimestamp(event.created_at)}</span
            >
          </div>
        {/each}
      </div>

      <button
        onclick={copyRefetchedJson}
        class="w-full rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-medium transition-colors"
      >
        📋 再取得結果のJSONをコピー ({refetchedEvents.length}件)
      </button>
    </div>
  {/if}
</div>
