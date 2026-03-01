<script lang="ts">
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import { QUICK_ACTION_LABELS } from "$lib/constants";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");
  const timeline = $derived(records.getTimeline(vehicleId).slice(0, 5));

  function formatRecordLine(item: (typeof timeline)[number]): string {
    if (item.type === "refuel") {
      const r = item.record;
      if (r.fuelAmount != null) {
        let line = `⛽ ${r.fuelAmount}L`;
        if (r.totalCost) line += ` ¥${r.totalCost.toLocaleString()}`;
        return line;
      }
      return r.isFullTank ? "⛽ 満タン給油" : "⛽ 給油";
    }
    if (item.type === "quick") {
      return QUICK_ACTION_LABELS[item.record.action] || "🔧 整備";
    }
    if (item.type === "inspection") {
      const r = item.record;
      const typeLabel =
        { daily: "日常", weekly: "週間", monthly: "月間" }[r.type] || "";
      return `📋 ${typeLabel}点検 ${r.allOk ? "ALL OK" : "要確認あり"}`;
    }
    if (item.type === "shop") {
      return `🏭 ショップ整備${item.record.totalCost ? ` ¥${item.record.totalCost.toLocaleString()}` : ""}`;
    }
    if (item.type === "odometer") {
      return `📏 ${item.record.odometer.toLocaleString()} km`;
    }
    return "";
  }
</script>

<!-- 直近の記録 -->
<div class="bg-surface rounded-xl p-4">
  <div class="mb-3 flex items-center justify-between">
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
        <div class="text-text-muted flex items-center justify-between text-sm">
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
