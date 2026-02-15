<script lang="ts">
  import { goto } from "$app/navigation";
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import { publishEvent } from "$lib/nostr/publish";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");

  let date = $state(new Date().toISOString().slice(0, 10));
  let category = $state<"regular" | "repair" | "shaken" | "custom">("regular");
  let shopName = $state("");
  let odometer = $state("");
  let totalCost = $state("");
  let nextDate = $state("");
  let nextOdometer = $state("");
  let notes = $state("");
  let saving = $state(false);
  let error = $state("");

  const workOptions = [
    { key: "oilChange", label: "オイル交換" },
    { key: "oilFilterChange", label: "オイルフィルター交換" },
    { key: "airFilterChange", label: "エアフィルター交換" },
    { key: "sparkPlugChange", label: "スパークプラグ交換" },
    { key: "brakeFluidChange", label: "ブレーキフルード交換" },
    { key: "coolantChange", label: "クーラント交換" },
    { key: "chainAdjust", label: "チェーン調整" },
    { key: "brakePadReplace", label: "ブレーキパッド交換" },
    { key: "tireReplaceFront", label: "前タイヤ交換" },
    { key: "tireReplaceRear", label: "後タイヤ交換" },
    { key: "batteryReplace", label: "バッテリー交換" },
    { key: "forkOilChange", label: "フォークオイル交換" },
  ];

  let selectedWork = $state<Set<string>>(new Set());

  function toggleWork(key: string) {
    const next = new Set(selectedWork);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selectedWork = next;
  }

  async function save() {
    saving = true;
    error = "";

    try {
      const now = Math.floor(Date.now() / 1000);
      const dTag = `shop:${vehicleId}:${now}`;

      const content: Record<string, unknown> = {
        v: 1,
        vehicleId,
        date,
        category,
        workDone: [...selectedWork],
      };

      if (shopName.trim()) content.shopName = shopName.trim();
      if (odometer) content.odometer = parseFloat(odometer);
      if (totalCost) content.totalCost = parseInt(totalCost);
      if (nextDate) content.nextDate = nextDate;
      if (nextOdometer) content.nextOdometer = parseFloat(nextOdometer);
      if (notes.trim()) content.notes = notes.trim();

      await publishEvent(dTag, "shop", content);

      records.addShop({
        id: dTag,
        vehicleId,
        date,
        category,
        shopName: shopName.trim() || undefined,
        odometer: odometer ? parseFloat(odometer) : undefined,
        workDone: [...selectedWork],
        totalCost: totalCost ? parseInt(totalCost) : undefined,
        nextDate: nextDate || undefined,
        nextOdometer: nextOdometer ? parseFloat(nextOdometer) : undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
      });

      goto("/home");
    } catch (e: any) {
      error = e.message || "保存に失敗しました";
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-4">
  <div class="flex items-center gap-3">
    <a href="/log" class="text-text-muted hover:text-text">←</a>
    <h2 class="text-xl font-bold">🏭 ショップ整備</h2>
  </div>

  <!-- 注意書き -->
  <div
    class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400"
  >
    ⚠️ 店舗名は公開情報です。生活圏が特定されない範囲で記載してください。
  </div>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      save();
    }}
    class="space-y-4"
  >
    <!-- 日付 -->
    <div>
      <label for="date" class="text-text-muted mb-1 block text-sm">作業日</label
      >
      <input
        id="date"
        type="date"
        bind:value={date}
        max={new Date().toISOString().slice(0, 10)}
        class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- カテゴリ -->
    <div class="bg-surface flex rounded-lg p-1">
      {#each [["regular", "定期"], ["repair", "修理"], ["shaken", "車検"], ["custom", "カスタム"]] as [key, label]}
        <button
          type="button"
          onclick={() => {
            category = key as typeof category;
          }}
          class="flex-1 rounded-md py-2 text-xs font-medium transition-colors {category ===
          key
            ? 'bg-primary text-white'
            : 'text-text-muted'}"
        >
          {label}
        </button>
      {/each}
    </div>

    <!-- やった作業 -->
    <div>
      <p class="text-text-muted mb-2 text-sm">
        やってもらった作業 (該当をタップ):
      </p>
      <div class="flex flex-wrap gap-2">
        {#each workOptions as opt}
          <button
            type="button"
            onclick={() => toggleWork(opt.key)}
            class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors {selectedWork.has(
              opt.key,
            )
              ? 'bg-primary text-white'
              : 'bg-surface-light text-text-muted'}"
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- 任意項目 -->
    <details>
      <summary
        class="text-text-muted flex cursor-pointer items-center gap-1 text-sm select-none"
      >
        ▶ 詳細 (任意)
      </summary>
      <div class="mt-3 space-y-3">
        <div>
          <label for="shopName" class="text-text-muted mb-1 block text-sm"
            >店舗名</label
          >
          <input
            id="shopName"
            type="text"
            bind:value={shopName}
            placeholder="※公開されます"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="odometer" class="text-text-muted mb-1 block text-sm"
              >ODO (km)</label
            >
            <input
              id="odometer"
              type="number"
              bind:value={odometer}
              inputmode="numeric"
              placeholder="10000"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="totalCost" class="text-text-muted mb-1 block text-sm"
              >費用 (¥)</label
            >
            <input
              id="totalCost"
              type="number"
              bind:value={totalCost}
              inputmode="numeric"
              placeholder="15000"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="nextDate" class="text-text-muted mb-1 block text-sm"
              >次回予定日</label
            >
            <input
              id="nextDate"
              type="date"
              bind:value={nextDate}
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="nextOdometer" class="text-text-muted mb-1 block text-sm"
              >次回 ODO 目安</label
            >
            <input
              id="nextOdometer"
              type="number"
              bind:value={nextOdometer}
              inputmode="numeric"
              placeholder="16000"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label for="notes" class="text-text-muted mb-1 block text-sm"
            >メモ</label
          >
          <textarea
            id="notes"
            bind:value={notes}
            rows="2"
            placeholder="メモ (公開されます)"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>
      </div>
    </details>

    {#if error}
      <p class="text-sm text-red-400">{error}</p>
    {/if}

    <button
      type="submit"
      disabled={saving}
      class="bg-primary hover:bg-primary-dark w-full rounded-lg py-3 font-bold text-white transition-colors disabled:opacity-50"
    >
      {saving ? "保存中..." : "🏭 記録する"}
    </button>
  </form>
</div>
