<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { records } from "$lib/stores/app.svelte";
  import { publishEvent, deleteEvent } from "$lib/nostr/publish";
  import {
    SHOP_WORK_OPTIONS,
    QUICK_ACTION_TEXT_LABELS,
    SHOP_CATEGORY_TABS,
  } from "$lib/constants";
  import type {
    RefuelRecord,
    QuickRecord,
    InspectionRecord,
    ShopRecord,
    RecordType,
    QuickActionType,
  } from "$lib/models/types";

  const recordId = $derived(page.url.searchParams.get("id") ?? "");
  const found = $derived(records.findById(recordId));
  const recordType = $derived(found?.type);
  const recordData = $derived(found?.record);

  let saving = $state(false);
  let deleting = $state(false);
  let error = $state("");

  // --- 給油記録用の状態 ---
  let refuelDate = $state("");
  let refuelAmount = $state("");
  let refuelFullTank = $state(true);
  let refuelTotalCost = $state("");
  let refuelPricePerLiter = $state("");
  let refuelOdometer = $state("");
  let refuelStation = $state("");
  let refuelNotes = $state("");

  // --- クイック記録用の状態 ---
  let quickDate = $state("");
  let quickAction = $state<QuickActionType>("tire-pressure");
  let quickCustomName = $state("");
  let quickOdometer = $state("");
  let quickNotes = $state("");

  // --- 点検記録用の状態 ---
  let inspDate = $state("");
  let inspAllOk = $state(true);
  let inspOdometer = $state("");
  let inspIssues = $state<{ item: string; status: "warning" | "ng" }[]>([]);
  let inspNotes = $state("");

  // --- ショップ記録用の状態 ---
  let shopDate = $state("");
  let shopCategory = $state<"regular" | "repair" | "shaken" | "custom">(
    "regular",
  );
  let shopName = $state("");
  let shopOdometer = $state("");
  let shopTotalCost = $state("");
  let shopNextDate = $state("");
  let shopNextOdometer = $state("");
  let shopNotes = $state("");
  let shopSelectedWork = $state<Set<string>>(new Set());

  // recordData が変わったらフォーム状態を初期化
  $effect(() => {
    if (!recordData || !recordType) return;

    if (recordType === "refuel") {
      const r = recordData as RefuelRecord;
      refuelDate = r.date;
      refuelAmount = r.fuelAmount?.toString() ?? "";
      refuelFullTank = r.isFullTank;
      refuelTotalCost = r.totalCost?.toString() ?? "";
      refuelPricePerLiter = r.pricePerLiter?.toString() ?? "";
      refuelOdometer = r.odometer?.toString() ?? "";
      refuelStation = r.station ?? "";
      refuelNotes = r.notes ?? "";
    } else if (recordType === "quick") {
      const r = recordData as QuickRecord;
      quickDate = r.date;
      quickAction = r.action;
      quickCustomName = r.customName ?? "";
      quickOdometer = r.odometer?.toString() ?? "";
      quickNotes = r.notes ?? "";
    } else if (recordType === "inspection") {
      const r = recordData as InspectionRecord;
      inspDate = r.date;
      inspAllOk = r.allOk;
      inspOdometer = r.odometer?.toString() ?? "";
      inspIssues = r.issues ? [...r.issues] : [];
      inspNotes = r.notes ?? "";
    } else if (recordType === "shop") {
      const r = recordData as ShopRecord;
      shopDate = r.date;
      shopCategory = r.category ?? "regular";
      shopName = r.shopName ?? "";
      shopOdometer = r.odometer?.toString() ?? "";
      shopTotalCost = r.totalCost?.toString() ?? "";
      shopNextDate = r.nextDate ?? "";
      shopNextOdometer = r.nextOdometer?.toString() ?? "";
      shopNotes = r.notes ?? "";
      shopSelectedWork = new Set(r.workDone);
    }
  });

  function toggleShopWork(key: string) {
    const next = new Set(shopSelectedWork);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    shopSelectedWork = next;
  }

  async function saveRefuel() {
    const r = recordData as RefuelRecord;
    const amount = refuelAmount ? parseFloat(refuelAmount) : undefined;
    if (refuelAmount && (isNaN(amount!) || amount! <= 0)) {
      error = "給油量の値が不正です";
      return;
    }
    saving = true;
    error = "";
    try {
      const content: Record<string, unknown> = {
        v: 1,
        vehicleId: r.vehicleId,
        date: refuelDate,
        isFullTank: refuelFullTank,
      };
      if (amount != null) content.fuelAmount = amount;
      if (refuelOdometer) content.odometer = parseFloat(refuelOdometer);
      if (refuelPricePerLiter)
        content.pricePerLiter = parseFloat(refuelPricePerLiter);
      if (refuelTotalCost) content.totalCost = parseInt(refuelTotalCost);
      if (refuelStation.trim()) content.station = refuelStation.trim();
      if (refuelNotes.trim()) content.notes = refuelNotes.trim();

      // 同じ d-tag で再 publish → Parameterized Replaceable で上書き
      await publishEvent(r.id, "refuel", content);

      records.updateRefuel({
        ...r,
        date: refuelDate,
        fuelAmount: amount,
        isFullTank: refuelFullTank,
        odometer: refuelOdometer ? parseFloat(refuelOdometer) : undefined,
        pricePerLiter: refuelPricePerLiter
          ? parseFloat(refuelPricePerLiter)
          : undefined,
        totalCost: refuelTotalCost ? parseInt(refuelTotalCost) : undefined,
        station: refuelStation.trim() || undefined,
        notes: refuelNotes.trim() || undefined,
      });
      goto("/history");
    } catch (e: any) {
      error = e.message || "保存に失敗しました";
    } finally {
      saving = false;
    }
  }

  async function saveQuick() {
    const r = recordData as QuickRecord;
    saving = true;
    error = "";
    try {
      const content: Record<string, unknown> = {
        v: 1,
        vehicleId: r.vehicleId,
        date: quickDate,
        action: quickAction,
      };
      if (quickOdometer) content.odometer = parseFloat(quickOdometer);
      if (quickNotes.trim()) content.notes = quickNotes.trim();
      if (quickAction === "custom" && quickCustomName.trim()) {
        content.customName = quickCustomName.trim();
      }

      await publishEvent(r.id, "quick", content);
      records.updateQuick({
        ...r,
        date: quickDate,
        action: quickAction,
        customName:
          quickAction === "custom" && quickCustomName.trim()
            ? quickCustomName.trim()
            : undefined,
        odometer: quickOdometer ? parseFloat(quickOdometer) : undefined,
        notes: quickNotes.trim() || undefined,
      });
      goto("/history");
    } catch (e: any) {
      error = e.message || "保存に失敗しました";
    } finally {
      saving = false;
    }
  }

  async function saveInspection() {
    const r = recordData as InspectionRecord;
    saving = true;
    error = "";
    try {
      const issues = inspAllOk ? [] : inspIssues;
      const content: Record<string, unknown> = {
        v: 1,
        vehicleId: r.vehicleId,
        date: inspDate,
        type: r.type,
        allOk: inspAllOk,
        issues,
      };
      if (inspOdometer) content.odometer = parseFloat(inspOdometer);
      if (inspNotes.trim()) content.notes = inspNotes.trim();

      await publishEvent(r.id, "inspection", content);
      records.updateInspection({
        ...r,
        date: inspDate,
        allOk: inspAllOk,
        issues,
        odometer: inspOdometer ? parseFloat(inspOdometer) : undefined,
        notes: inspNotes.trim() || undefined,
      });
      goto("/history");
    } catch (e: any) {
      error = e.message || "保存に失敗しました";
    } finally {
      saving = false;
    }
  }

  async function saveShop() {
    const r = recordData as ShopRecord;
    saving = true;
    error = "";
    try {
      const content: Record<string, unknown> = {
        v: 1,
        vehicleId: r.vehicleId,
        date: shopDate,
        category: shopCategory,
        workDone: [...shopSelectedWork],
      };
      if (shopName.trim()) content.shopName = shopName.trim();
      if (shopOdometer) content.odometer = parseFloat(shopOdometer);
      if (shopTotalCost) content.totalCost = parseInt(shopTotalCost);
      if (shopNextDate) content.nextDate = shopNextDate;
      if (shopNextOdometer) content.nextOdometer = parseFloat(shopNextOdometer);
      if (shopNotes.trim()) content.notes = shopNotes.trim();

      await publishEvent(r.id, "shop", content);
      records.updateShop({
        ...r,
        date: shopDate,
        category: shopCategory,
        shopName: shopName.trim() || undefined,
        odometer: shopOdometer ? parseFloat(shopOdometer) : undefined,
        workDone: [...shopSelectedWork],
        totalCost: shopTotalCost ? parseInt(shopTotalCost) : undefined,
        nextDate: shopNextDate || undefined,
        nextOdometer: shopNextOdometer
          ? parseFloat(shopNextOdometer)
          : undefined,
        notes: shopNotes.trim() || undefined,
      });
      goto("/history");
    } catch (e: any) {
      error = e.message || "保存に失敗しました";
    } finally {
      saving = false;
    }
  }

  async function handleSave() {
    if (recordType === "refuel") await saveRefuel();
    else if (recordType === "quick") await saveQuick();
    else if (recordType === "inspection") await saveInspection();
    else if (recordType === "shop") await saveShop();
  }

  async function handleDelete() {
    if (
      !confirm(
        "この記録を削除しますか？\nNostr上のデータも削除リクエストが送信されます。",
      )
    )
      return;
    deleting = true;
    try {
      // kind 5 で削除
      await deleteEvent(recordId);

      // ローカルストアから削除
      if (recordType === "refuel") records.removeRefuel(recordId);
      else if (recordType === "quick") records.removeQuick(recordId);
      else if (recordType === "inspection") records.removeInspection(recordId);
      else if (recordType === "shop") records.removeShop(recordId);
      else if (recordType === "odometer") records.removeOdometer(recordId);

      goto("/history");
    } catch (e: any) {
      error = e.message || "削除に失敗しました";
    } finally {
      deleting = false;
    }
  }

  function getTypeLabel(type: RecordType | undefined): string {
    const labels: Record<string, string> = {
      refuel: "⛽ 給油記録",
      quick: "🔧 クイック整備",
      inspection: "📋 点検記録",
      shop: "🏭 ショップ整備",
      odometer: "📏 走行距離",
    };
    return labels[type ?? ""] ?? "記録";
  }
</script>

<div class="space-y-4">
  <div class="flex items-center gap-3">
    <a href="/history" class="text-text-muted hover:text-text">←</a>
    <h2 class="text-xl font-bold">{getTypeLabel(recordType)} を編集</h2>
  </div>

  {#if !recordData}
    <div class="bg-surface rounded-xl p-8 text-center">
      <p class="text-text-muted">記録が見つかりません</p>
      <a
        href="/history"
        class="text-primary mt-2 inline-block text-sm hover:underline"
        >履歴に戻る →</a
      >
    </div>
  {:else}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      class="space-y-4"
    >
      <!-- ===== 給油記録フォーム ===== -->
      {#if recordType === "refuel"}
        <div>
          <label for="refuelDate" class="text-text-muted mb-1 block text-sm"
            >日付</label
          >
          <input
            id="refuelDate"
            type="date"
            bind:value={refuelDate}
            max={new Date().toISOString().slice(0, 10)}
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="refuelAmount" class="text-text-muted mb-1 block text-sm"
            >給油量 (L)</label
          >
          <input
            id="refuelAmount"
            type="number"
            bind:value={refuelAmount}
            step="0.01"
            min="0"
            placeholder="わからなければ空欄で OK"
            inputmode="decimal"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-lg text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label class="flex items-center justify-between">
          <span class="text-sm">満タン</span>
          <button
            type="button"
            onclick={() => {
              refuelFullTank = !refuelFullTank;
            }}
            class="relative h-7 w-12 rounded-full transition-colors {refuelFullTank
              ? 'bg-primary'
              : 'bg-surface-light'}"
          >
            <span
              class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform {refuelFullTank
                ? 'left-5.5'
                : 'left-0.5'}"
            ></span>
          </button>
        </label>
        <div>
          <label
            for="refuelTotalCost"
            class="text-text-muted mb-1 block text-sm">合計金額 (¥)</label
          >
          <input
            id="refuelTotalCost"
            type="number"
            bind:value={refuelTotalCost}
            inputmode="numeric"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            for="refuelPricePerLiter"
            class="text-text-muted mb-1 block text-sm">単価 (¥/L)</label
          >
          <input
            id="refuelPricePerLiter"
            type="number"
            bind:value={refuelPricePerLiter}
            inputmode="numeric"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="refuelOdometer" class="text-text-muted mb-1 block text-sm"
            >ODO (km)</label
          >
          <input
            id="refuelOdometer"
            type="number"
            bind:value={refuelOdometer}
            inputmode="numeric"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="refuelStation" class="text-text-muted mb-1 block text-sm"
            >ガソリンスタンド</label
          >
          <input
            id="refuelStation"
            type="text"
            bind:value={refuelStation}
            placeholder="※公開されます"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-amber-400">
            ⚠️ 自宅近くの店舗名は入力しないでください
          </p>
        </div>
        <div>
          <label for="refuelNotes" class="text-text-muted mb-1 block text-sm"
            >メモ</label
          >
          <textarea
            id="refuelNotes"
            bind:value={refuelNotes}
            rows="2"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <!-- ===== クイック整備フォーム ===== -->
      {:else if recordType === "quick"}
        <div>
          <label for="quickDate" class="text-text-muted mb-1 block text-sm"
            >日付</label
          >
          <input
            id="quickDate"
            type="date"
            bind:value={quickDate}
            max={new Date().toISOString().slice(0, 10)}
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="text-text-muted mb-2 block text-sm">種類</label>
          <div class="flex flex-wrap gap-2">
            {#each Object.entries(QUICK_ACTION_TEXT_LABELS) as [key, label]}
              <button
                type="button"
                onclick={() => {
                  quickAction = key as QuickActionType;
                }}
                class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors {quickAction ===
                key
                  ? 'bg-primary text-white'
                  : 'bg-surface-light text-text-muted'}"
              >
                {label}
              </button>
            {/each}
          </div>
        </div>
        {#if quickAction === "custom"}
          <div>
            <label
              for="quickCustomName"
              class="text-text-muted mb-1 block text-sm">整備内容</label
            >
            <input
              id="quickCustomName"
              type="text"
              bind:value={quickCustomName}
              placeholder="例: ヘルメット撥水処理"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        {/if}
        <div>
          <label for="quickOdometer" class="text-text-muted mb-1 block text-sm"
            >走行距離 (km)</label
          >
          <input
            id="quickOdometer"
            type="number"
            bind:value={quickOdometer}
            placeholder="12345"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="quickNotes" class="text-text-muted mb-1 block text-sm"
            >メモ</label
          >
          <textarea
            id="quickNotes"
            bind:value={quickNotes}
            rows="2"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <!-- ===== 点検記録フォーム ===== -->
      {:else if recordType === "inspection"}
        <div>
          <label for="inspDate" class="text-text-muted mb-1 block text-sm"
            >日付</label
          >
          <input
            id="inspDate"
            type="date"
            bind:value={inspDate}
            max={new Date().toISOString().slice(0, 10)}
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="bg-surface rounded-lg p-3">
          <span class="text-text-muted text-sm"
            >点検タイプ: {(recordData as InspectionRecord).type === "daily"
              ? "日常"
              : (recordData as InspectionRecord).type === "weekly"
                ? "週間"
                : "月間"}</span
          >
        </div>
        <label class="flex items-center justify-between">
          <span class="text-sm">全部 OK</span>
          <button
            type="button"
            onclick={() => {
              inspAllOk = !inspAllOk;
            }}
            class="relative h-7 w-12 rounded-full transition-colors {inspAllOk
              ? 'bg-green-500'
              : 'bg-surface-light'}"
          >
            <span
              class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform {inspAllOk
                ? 'left-5.5'
                : 'left-0.5'}"
            ></span>
          </button>
        </label>

        {#if !inspAllOk && inspIssues.length > 0}
          <div>
            <label class="text-text-muted mb-2 block text-sm">指摘項目</label>
            {#each inspIssues as issue, i}
              <div
                class="bg-surface-light mb-2 flex items-center gap-2 rounded-lg px-3 py-2"
              >
                <span class="flex-1 text-sm">{issue.item}</span>
                <select
                  value={issue.status}
                  onchange={(e) => {
                    inspIssues = inspIssues.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            status: (e.target as HTMLSelectElement).value as
                              | "warning"
                              | "ng",
                          }
                        : x,
                    );
                  }}
                  class="bg-surface rounded px-2 py-1 text-xs text-white"
                >
                  <option value="warning">⚠️ 注意</option>
                  <option value="ng">❌ NG</option>
                </select>
                <button
                  type="button"
                  onclick={() => {
                    inspIssues = inspIssues.filter((_, j) => j !== i);
                  }}
                  class="text-text-muted hover:text-red-400 text-xs">🗑</button
                >
              </div>
            {/each}
          </div>
        {/if}

        <div>
          <label for="inspOdometer" class="text-text-muted mb-1 block text-sm"
            >走行距離 (km)</label
          >
          <input
            id="inspOdometer"
            type="number"
            bind:value={inspOdometer}
            placeholder="12345"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="inspNotes" class="text-text-muted mb-1 block text-sm"
            >メモ</label
          >
          <textarea
            id="inspNotes"
            bind:value={inspNotes}
            rows="2"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <!-- ===== ショップ整備フォーム ===== -->
      {:else if recordType === "shop"}
        <div>
          <label for="shopDate" class="text-text-muted mb-1 block text-sm"
            >作業日</label
          >
          <input
            id="shopDate"
            type="date"
            bind:value={shopDate}
            max={new Date().toISOString().slice(0, 10)}
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="bg-surface flex rounded-lg p-1">
          {#each SHOP_CATEGORY_TABS as [key, label]}
            <button
              type="button"
              onclick={() => {
                shopCategory = key as typeof shopCategory;
              }}
              class="flex-1 rounded-md py-2 text-xs font-medium transition-colors {shopCategory ===
              key
                ? 'bg-primary text-white'
                : 'text-text-muted'}"
            >
              {label}
            </button>
          {/each}
        </div>
        <div>
          <p class="text-text-muted mb-2 text-sm">やった作業:</p>
          <div class="flex flex-wrap gap-2">
            {#each SHOP_WORK_OPTIONS as opt}
              <button
                type="button"
                onclick={() => toggleShopWork(opt.key)}
                class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors {shopSelectedWork.has(
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
          <p class="mt-1 text-xs text-amber-400">
            ⚠️ 生活圏が特定されない範囲で
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="shopOdometer" class="text-text-muted mb-1 block text-sm"
              >ODO (km)</label
            >
            <input
              id="shopOdometer"
              type="number"
              bind:value={shopOdometer}
              inputmode="numeric"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              for="shopTotalCost"
              class="text-text-muted mb-1 block text-sm">費用 (¥)</label
            >
            <input
              id="shopTotalCost"
              type="number"
              bind:value={shopTotalCost}
              inputmode="numeric"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="shopNextDate" class="text-text-muted mb-1 block text-sm"
              >次回予定日</label
            >
            <input
              id="shopNextDate"
              type="date"
              bind:value={shopNextDate}
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              for="shopNextOdometer"
              class="text-text-muted mb-1 block text-sm">次回 ODO 目安</label
            >
            <input
              id="shopNextOdometer"
              type="number"
              bind:value={shopNextOdometer}
              inputmode="numeric"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label for="shopNotes" class="text-text-muted mb-1 block text-sm"
            >メモ</label
          >
          <textarea
            id="shopNotes"
            bind:value={shopNotes}
            rows="2"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <!-- ===== ODO (表示のみ、将来対応) ===== -->
      {:else if recordType === "odometer"}
        <div class="bg-surface rounded-xl p-4 text-center">
          <p class="text-text-muted text-sm">
            走行距離記録の編集は今後対応予定です
          </p>
        </div>
      {/if}

      {#if error}
        <p class="text-sm text-red-400">{error}</p>
      {/if}

      {#if recordType !== "odometer"}
        <button
          type="submit"
          disabled={saving}
          class="bg-primary hover:bg-primary-dark w-full rounded-lg py-3 font-bold text-white transition-colors disabled:opacity-50"
        >
          {saving ? "保存中..." : "✏️ 更新する"}
        </button>
      {/if}
    </form>

    <!-- 削除ボタン -->
    <div class="border-t border-white/10 pt-4">
      <button
        onclick={handleDelete}
        disabled={deleting}
        class="w-full rounded-lg bg-red-900/30 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/50 disabled:opacity-50"
      >
        {deleting ? "削除中..." : "🗑️ この記録を削除する"}
      </button>
      <p class="text-text-muted mt-2 text-center text-xs">
        ※
        Nostr上のデータには削除リクエストが送信されますが、リレーによっては残る場合があります
      </p>
    </div>
  {/if}
</div>
