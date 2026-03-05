<script lang="ts">
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import { goto } from "$app/navigation";
  import { publishEvent } from "$lib/nostr/publish";
  import { toastStore } from "$lib/stores/toast.svelte";
  import type { QuickActionType } from "$lib/models/types";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");
  const vehicle = $derived(vehicleStore.activeVehicle);
  const latestOdo = $derived(records.getLatestOdometer(vehicleId));

  let date = $state(new Date().toISOString().slice(0, 10));
  let quickOdometer = $state("");
  let quickNotes = $state("");
  let showExtraInput = $state(false);
  let customActionName = $state("");
  let showCustomInput = $state(false);

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

    const content: Record<string, unknown> = {
      v: 1,
      vehicleId,
      date,
      action,
    };
    if (quickOdometer) content.odometer = parseFloat(quickOdometer);
    if (quickNotes.trim()) content.notes = quickNotes.trim();
    if (action === "custom" && customActionName.trim()) {
      content.customName = customActionName.trim();
    }

    try {
      await publishEvent(dTag, "quick", content);
      records.addQuick({
        id: dTag,
        vehicleId,
        date,
        action,
        customName:
          action === "custom" && customActionName.trim()
            ? customActionName.trim()
            : undefined,
        odometer: quickOdometer ? parseFloat(quickOdometer) : undefined,
        notes: quickNotes.trim() || undefined,
        createdAt: now,
      });

      // ODO 入力があればオドメーター記録も作成
      if (quickOdometer) {
        const odoTag = `odo:${vehicleId}:${now}`;
        const odoContent = {
          v: 1,
          vehicleId,
          date,
          odometer: parseFloat(quickOdometer),
        };
        await publishEvent(odoTag, "odometer", odoContent);
        records.addOdometer({
          id: odoTag,
          vehicleId,
          date,
          odometer: parseFloat(quickOdometer),
          createdAt: now,
        });
      }

      toastStore.show("記録しました! ✅");
      setTimeout(() => goto("/home"), 1200);
    } catch {
      toastStore.show("保存に失敗しました 😢");
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

    <!-- ODO / メモ入力トグル -->
    <div class="mb-2">
      <button
        type="button"
        onclick={() => (showExtraInput = !showExtraInput)}
        class="text-text-muted hover:text-text text-xs transition-colors"
      >
        📏 ODO / メモも残す {showExtraInput ? "▲" : "▼"}
      </button>
      {#if showExtraInput}
        <div class="mt-1 space-y-2">
          <p class="text-text-muted text-xs">
            入力してからボタンをタップすると、ODO / メモも一緒に記録されます
          </p>
          <input
            type="number"
            bind:value={quickOdometer}
            placeholder="ODO (km)"
            inputmode="numeric"
            class="bg-surface-light w-full rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {#if quickOdometer && latestOdo != null && parseFloat(quickOdometer) < latestOdo}
            <p class="text-xs text-amber-400">
              ⚠️ 前回の記録 ({latestOdo.toLocaleString()} km) より小さい値です
            </p>
          {/if}
          <input
            type="text"
            bind:value={quickNotes}
            placeholder="メモ (公開されます)"
            class="bg-surface-light w-full rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      {/if}
    </div>

    <!-- タイヤ空気圧リマインダー -->
    {#if vehicle?.recommendedTirePressureFront || vehicle?.recommendedTirePressureRear}
      <div
        class="bg-surface mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-xs"
      >
        <span>💨</span>
        <span class="text-text-muted">推奨空気圧:</span>
        {#if vehicle.recommendedTirePressureFront}
          <span
            >前 <strong class="text-white"
              >{vehicle.recommendedTirePressureFront}</strong
            > kPa</span
          >
        {/if}
        {#if vehicle.recommendedTirePressureRear}
          <span
            >後 <strong class="text-white"
              >{vehicle.recommendedTirePressureRear}</strong
            > kPa</span
          >
        {/if}
      </div>
    {/if}

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
      <!-- カスタムアクション -->
      <button
        onclick={() => (showCustomInput = !showCustomInput)}
        class="bg-surface hover:bg-surface-light flex flex-col items-center justify-center rounded-xl p-3 transition-colors active:scale-95 {showCustomInput
          ? 'ring-2 ring-blue-500'
          : ''}"
      >
        <span class="text-2xl">📝</span>
        <span class="mt-1 text-center text-xs leading-tight">その他</span>
      </button>
    </div>
    {#if showCustomInput}
      <div class="mt-2 flex gap-2">
        <input
          type="text"
          bind:value={customActionName}
          placeholder="整備内容を入力"
          class="bg-surface-light flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onclick={() => {
            if (customActionName.trim()) recordQuickAction("custom");
          }}
          disabled={!customActionName.trim()}
          class="bg-primary hover:bg-primary-dark rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          記録
        </button>
      </div>
    {/if}
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
