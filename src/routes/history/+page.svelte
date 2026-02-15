<script lang="ts">
  import { vehicleStore, records } from "$lib/stores/app.svelte";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");
  const timeline = $derived(records.getTimeline(vehicleId));

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

  function getDescription(item: (typeof timeline)[number]): string {
    if (item.type === "refuel") {
      const r = item.record as any;
      let desc = `給油 ${r.fuelAmount}L`;
      if (r.totalCost) desc += ` ¥${r.totalCost.toLocaleString()}`;
      if (r.odometer) desc += ` (${r.odometer.toLocaleString()} km)`;
      return desc;
    }
    if (item.type === "quick") {
      const labels: Record<string, string> = {
        "tire-pressure": "空気圧チェック",
        "chain-lube": "チェーン注油",
        "chain-clean": "チェーン清掃",
        "chain-adjust": "チェーン調整",
        wash: "洗車",
        "oil-check": "オイル確認",
        "coolant-check": "冷却水確認",
        "battery-charge": "バッテリー充電",
        custom: "その他整備",
      };
      return labels[(item.record as any).action] || "整備";
    }
    if (item.type === "inspection") {
      const r = item.record as any;
      const typeLabels: Record<string, string> = {
        daily: "日常",
        weekly: "週間",
        monthly: "月間",
      };
      return `${typeLabels[r.type] || ""}点検 ${r.allOk ? "ALL OK" : "要確認あり"}`;
    }
    if (item.type === "shop") {
      const r = item.record as any;
      let desc = "ショップ整備";
      if (r.workDone?.length) desc += ` (${r.workDone.length}項目)`;
      if (r.totalCost) desc += ` ¥${r.totalCost.toLocaleString()}`;
      return desc;
    }
    if (item.type === "odometer") {
      return `走行距離 ${(item.record as any).odometer.toLocaleString()} km`;
    }
    return "";
  }
</script>

<div class="space-y-4">
  <h2 class="text-xl font-bold">📋 履歴</h2>

  {#if timeline.length === 0}
    <div class="bg-surface rounded-xl p-8 text-center">
      <p class="text-text-muted text-4xl">📝</p>
      <p class="text-text-muted mt-2">まだ記録がありません</p>
      <a
        href="/log"
        class="text-primary mt-2 inline-block text-sm hover:underline"
        >記録を始める →</a
      >
    </div>
  {:else}
    <div class="space-y-2">
      {#each timeline as item}
        <a
          href="/edit?id={encodeURIComponent(item.record.id)}"
          class="bg-surface block rounded-lg p-3 transition-colors hover:bg-surface-light"
        >
          <div class="flex items-start gap-3">
            <span class="mt-0.5 text-xl">{getIcon(item.type)}</span>
            <div class="min-w-0 flex-1">
              <div class="text-sm">{getDescription(item)}</div>
              <div class="text-text-muted text-xs">{item.date}</div>
            </div>
            <span class="text-text-muted text-sm">✏️</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
