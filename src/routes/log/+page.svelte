<script lang="ts">
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import { publishEvent } from "$lib/nostr/publish";
  import type { QuickActionType } from "$lib/models/types";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");

  let date = $state(new Date().toISOString().slice(0, 10));
  let toast = $state("");
  let toastTimeout: ReturnType<typeof setTimeout>;

  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast = "";
    }, 2000);
  }

  const quickActions: {
    action: QuickActionType;
    icon: string;
    label: string;
  }[] = [
    { action: "tire-pressure", icon: "💨", label: "空気圧\n入れた" },
    { action: "chain-lube", icon: "🧴", label: "チェーン\n注油" },
    { action: "chain-clean", icon: "🔗", label: "チェーン\n清掃" },
    { action: "chain-adjust", icon: "⛓️", label: "チェーン\n調整" },
    { action: "wash", icon: "🚿", label: "洗車\nした" },
    { action: "oil-check", icon: "🛢️", label: "オイル\n確認" },
    { action: "coolant-check", icon: "💧", label: "冷却水\n確認" },
    { action: "battery-charge", icon: "🔋", label: "バッテリー\n充電" },
  ];

  async function recordQuickAction(action: QuickActionType) {
    const now = Math.floor(Date.now() / 1000);
    const dTag = `quick:${vehicleId}:${now}`;

    const content = {
      v: 1,
      vehicleId,
      date,
      action,
    };

    try {
      await publishEvent(dTag, "quick", content);
      records.addQuick({
        id: dTag,
        vehicleId,
        date,
        action,
        createdAt: now,
      });
      showToast("記録しました! ✅");
    } catch {
      showToast("保存に失敗しました 😢");
    }
  }
</script>

<div class="space-y-4">
  <h2 class="text-xl font-bold">✏️ 記録する</h2>

  <!-- 日付 -->
  <div>
    <label for="date" class="text-text-muted mb-1 block text-sm"
      >日付 (ワンタップ整備に適用)</label
    >
    <input
      id="date"
      type="date"
      bind:value={date}
      max={new Date().toISOString().slice(0, 10)}
      class="bg-surface w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>

  <!-- 給油 -->
  <a
    href="/log/refuel"
    class="bg-surface hover:bg-surface-light flex w-full items-center justify-between rounded-xl p-4 transition-colors"
  >
    <div class="flex items-center gap-3">
      <span class="text-3xl">⛽</span>
      <span class="text-lg font-medium">給油した</span>
    </div>
    <span class="text-text-muted">→</span>
  </a>

  <!-- ワンタップ整備 -->
  <div>
    <h3 class="text-text-muted mb-3 text-sm font-medium">
      ワンタップ整備 (タップで即記録!)
    </h3>
    <div class="grid grid-cols-4 gap-2">
      {#each quickActions as qa}
        <button
          onclick={() => recordQuickAction(qa.action)}
          class="bg-surface hover:bg-surface-light flex flex-col items-center justify-center rounded-xl p-3 transition-colors active:scale-95"
        >
          <span class="text-2xl">{qa.icon}</span>
          <span
            class="mt-1 text-center text-xs leading-tight whitespace-pre-line"
            >{qa.label}</span
          >
        </button>
      {/each}
    </div>
  </div>

  <!-- 点検 -->
  <a
    href="/log/inspection"
    class="bg-surface hover:bg-surface-light flex w-full items-center justify-between rounded-xl p-4 transition-colors"
  >
    <div class="flex items-center gap-3">
      <span class="text-3xl">📋</span>
      <span class="font-medium">点検する (日常/週間/月間)</span>
    </div>
    <span class="text-text-muted">→</span>
  </a>

  <!-- ショップ -->
  <a
    href="/log/shop"
    class="bg-surface hover:bg-surface-light flex w-full items-center justify-between rounded-xl p-4 transition-colors"
  >
    <div class="flex items-center gap-3">
      <span class="text-3xl">🏭</span>
      <span class="font-medium">バイク屋の整備を記録</span>
    </div>
    <span class="text-text-muted">→</span>
  </a>
</div>

<!-- トースト通知 -->
{#if toast}
  <div
    class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white shadow-lg"
  >
    {toast}
  </div>
{/if}
