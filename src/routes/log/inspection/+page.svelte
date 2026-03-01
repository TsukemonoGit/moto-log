<script lang="ts">
  import { goto } from "$app/navigation";
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import { publishEvent } from "$lib/nostr/publish";
  import { toastStore } from "$lib/stores/toast.svelte";
  import type { InspectionType } from "$lib/models/types";

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");
  const latestOdo = $derived(records.getLatestOdometer(vehicleId));

  let activeTab = $state<InspectionType>("daily");
  let date = $state(new Date().toISOString().slice(0, 10));
  let odometer = $state("");
  let notes = $state("");
  let saving = $state(false);

  const dailyCategories = [
    { key: "brake", label: "ブレーキ" },
    { key: "tire", label: "タイヤ" },
    { key: "lights", label: "灯火類" },
    { key: "chain", label: "チェーン" },
    { key: "engine", label: "エンジン周り" },
    { key: "controls", label: "操作系" },
  ];

  const weeklyItems = [
    { key: "tirePressure", label: "タイヤ空気圧" },
    { key: "chainLube", label: "チェーン注油" },
    { key: "chainTension", label: "チェーンたるみ" },
    { key: "brakePad", label: "ブレーキパッド" },
    { key: "leakCheck", label: "液漏れチェック" },
  ];

  const monthlyItems = [
    { key: "oil", label: "エンジンオイル状態" },
    { key: "coolant", label: "冷却水" },
    { key: "brakeFluid", label: "ブレーキフルード" },
    { key: "chainWear", label: "チェーン摩耗" },
    { key: "bolts", label: "ボルト類" },
    { key: "electrical", label: "電装系" },
  ];

  let issueItems = $state<Record<string, "ok" | "warning" | "ng">>({});

  // タブ切替時にリセット
  $effect(() => {
    activeTab; // track
    issueItems = {};
  });

  async function saveAllOk() {
    saving = true;
    try {
      const now = Math.floor(Date.now() / 1000);
      const dTag = `inspection:${vehicleId}:${activeTab}:${now}`;

      await publishEvent(dTag, "inspection", {
        v: 1,
        vehicleId,
        date,
        type: activeTab,
        allOk: true,
        issues: [],
        ...(odometer ? { odometer: parseFloat(odometer) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      records.addInspection({
        id: dTag,
        vehicleId,
        date,
        type: activeTab,
        allOk: true,
        issues: [],
        odometer: odometer ? parseFloat(odometer) : undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
      });

      // ODO 入力があればオドメーター記録も作成
      if (odometer) {
        const odoTag = `odo:${vehicleId}:${now}`;
        await publishEvent(odoTag, "odometer", {
          v: 1,
          vehicleId,
          date,
          odometer: parseFloat(odometer),
        });
        records.addOdometer({
          id: odoTag,
          vehicleId,
          date,
          odometer: parseFloat(odometer),
          createdAt: now,
        });
      }

      toastStore.show("全部OK! 記録しました ✅");
      setTimeout(() => goto("/home"), 1200);
    } catch {
      toastStore.show("保存に失敗しました 😢");
    } finally {
      saving = false;
    }
  }

  async function saveWithIssues() {
    const issues = Object.entries(issueItems)
      .filter(([, status]) => status !== "ok")
      .map(([item, status]) => ({ item, status: status as "warning" | "ng" }));

    saving = true;
    try {
      const now = Math.floor(Date.now() / 1000);
      const dTag = `inspection:${vehicleId}:${activeTab}:${now}`;

      await publishEvent(dTag, "inspection", {
        v: 1,
        vehicleId,
        date,
        type: activeTab,
        allOk: issues.length === 0,
        issues,
        ...(odometer ? { odometer: parseFloat(odometer) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      records.addInspection({
        id: dTag,
        vehicleId,
        date,
        type: activeTab,
        allOk: issues.length === 0,
        issues,
        odometer: odometer ? parseFloat(odometer) : undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
      });

      // ODO 入力があればオドメーター記録も作成
      if (odometer) {
        const odoTag = `odo:${vehicleId}:${now}`;
        await publishEvent(odoTag, "odometer", {
          v: 1,
          vehicleId,
          date,
          odometer: parseFloat(odometer),
        });
        records.addOdometer({
          id: odoTag,
          vehicleId,
          date,
          odometer: parseFloat(odometer),
          createdAt: now,
        });
      }

      toastStore.show("点検記録を保存しました ✅");
      issueItems = {};
      setTimeout(() => goto("/home"), 1200);
    } catch {
      toastStore.show("保存に失敗しました 😢");
    } finally {
      saving = false;
    }
  }

  function getItems() {
    if (activeTab === "daily") return dailyCategories;
    if (activeTab === "weekly") return weeklyItems;
    return monthlyItems;
  }
</script>

<div class="space-y-4">
  <div class="flex items-center gap-3">
    <a href="/log" class="text-text-muted hover:text-text">←</a>
    <h2 class="text-xl font-bold">📋 点検</h2>
  </div>

  <!-- タブ -->
  <div class="bg-surface flex rounded-lg p-1">
    {#each [["daily", "日常"], ["weekly", "週間"], ["monthly", "月間"]] as [key, label]}
      <button
        onclick={() => {
          activeTab = key as InspectionType;
        }}
        class="flex-1 rounded-md py-2 text-sm font-medium transition-colors {activeTab ===
        key
          ? 'bg-primary text-white'
          : 'text-text-muted hover:text-text'}"
      >
        {label}
      </button>
    {/each}
  </div>

  <!-- 日付 -->
  <div>
    <label for="date" class="text-text-muted mb-1 block text-sm">日付</label>
    <input
      id="date"
      type="date"
      bind:value={date}
      max={new Date().toISOString().slice(0, 10)}
      class="bg-surface w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>

  <!-- ODO + メモ -->
  <details>
    <summary
      class="text-text-muted flex cursor-pointer items-center gap-1 text-sm select-none"
    >
      <span class="transition-transform group-open:rotate-90">▶</span>
      📏 ODO / メモ
    </summary>
    <div class="mt-2 space-y-3">
      <div>
        <label for="odo" class="text-text-muted mb-1 block text-sm"
          >ODO (km)</label
        >
        <input
          id="odo"
          type="number"
          bind:value={odometer}
          placeholder="例: 5000"
          inputmode="numeric"
          class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
        />
        {#if odometer && latestOdo != null && parseFloat(odometer) < latestOdo}
          <p class="mt-1 text-xs text-amber-400">
            ⚠️ 前回の記録 ({latestOdo.toLocaleString()} km) より小さい値です
          </p>
        {/if}
      </div>
      <div>
        <label for="notes" class="text-text-muted mb-1 block text-sm"
          >メモ</label
        >
        <textarea
          id="notes"
          bind:value={notes}
          rows="2"
          placeholder="気づいたことなど (公開されます)"
          class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>
    </div>
  </details>

  <!-- 全部OK ボタン -->
  <button
    onclick={saveAllOk}
    disabled={saving}
    class="w-full rounded-xl border-2 border-green-500 bg-green-500/10 py-4 text-lg font-bold text-green-400 transition-colors hover:bg-green-500/20 active:scale-[0.98] disabled:opacity-50"
  >
    ✅ 全部 OK!
  </button>

  <!-- 個別チェック -->
  <div>
    <p class="text-text-muted mb-3 text-sm">
      気になるところがあれば個別にチェック:
    </p>
    <div class="space-y-2">
      {#each getItems() as item}
        <div
          class="bg-surface flex items-center justify-between rounded-lg p-3"
        >
          <span class="text-sm">{item.label}</span>
          <div class="flex gap-1">
            {#each [["ok", "OK", "bg-green-600"], ["warning", "⚠️", "bg-amber-600"], ["ng", "NG", "bg-red-600"]] as [status, label, bgColor]}
              <button
                onclick={() => {
                  issueItems = {
                    ...issueItems,
                    [item.key]: status as "ok" | "warning" | "ng",
                  };
                }}
                class="rounded-md px-3 py-1 text-xs font-medium transition-colors {issueItems[
                  item.key
                ] === status
                  ? bgColor + ' text-white'
                  : 'bg-surface-light text-text-muted'}"
              >
                {label}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  {#if Object.keys(issueItems).length > 0}
    <button
      onclick={saveWithIssues}
      disabled={saving}
      class="bg-primary hover:bg-primary-dark w-full rounded-lg py-3 font-bold text-white transition-colors disabled:opacity-50"
    >
      {saving ? "保存中..." : "点検結果を保存する"}
    </button>
  {/if}
</div>
