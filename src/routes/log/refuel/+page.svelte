<script lang="ts">
  import { goto } from "$app/navigation";
  import { vehicleStore, records } from "$lib/stores/app.svelte";
  import { publishEvent } from "$lib/nostr/publish";
  import { getFuelTypeLabel } from "$lib/constants";
  import { toastStore } from "$lib/stores/toast.svelte";

  const activeVehicle = $derived(vehicleStore.activeVehicle);
  const fuelTypeLabel = $derived(getFuelTypeLabel(activeVehicle?.fuelType));

  const vehicleId = $derived(vehicleStore.activeVehicleId ?? "");
  const lastRefuel = $derived(
    records.refuels.filter((r) => r.vehicleId === vehicleId)[0],
  );
  const latestOdo = $derived(records.getLatestOdometer(vehicleId));

  let date = $state(new Date().toISOString().slice(0, 10));
  let fuelAmount = $state("");
  let isFullTank = $state(true);
  let totalCost = $state("");
  // 前回の単価を自動プリフィル
  let pricePerLiter = $state(lastRefuel?.pricePerLiter?.toString() ?? "");
  let odometer = $state("");
  // 前回のスタンドを自動プリフィル
  let station = $state(lastRefuel?.station ?? "");
  let notes = $state("");
  let saving = $state(false);
  let error = $state("");

  // 合計金額と単価の自動計算
  $effect(() => {
    if (fuelAmount && pricePerLiter && !totalCost) {
      const calc = parseFloat(fuelAmount) * parseFloat(pricePerLiter);
      if (!isNaN(calc)) totalCost = Math.round(calc).toString();
    }
  });

  /** 満タンにした！ワンタップ保存 */
  async function quickFullTank() {
    saving = true;
    error = "";
    try {
      const now = Math.floor(Date.now() / 1000);
      const dTag = `refuel:${vehicleId}:${now}`;

      const content: Record<string, unknown> = {
        v: 1,
        vehicleId,
        date,
        isFullTank: true,
      };

      if (odometer) content.odometer = parseFloat(odometer);

      await publishEvent(dTag, "refuel", content);

      records.addRefuel({
        id: dTag,
        vehicleId,
        date,
        isFullTank: true,
        odometer: odometer ? parseFloat(odometer) : undefined,
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

      toastStore.show("給油を記録しました! ⛽");
      setTimeout(() => goto("/home"), 1200);
    } catch (e: any) {
      error = e.message || "保存に失敗しました";
    } finally {
      saving = false;
    }
  }

  async function save() {
    saving = true;
    error = "";

    try {
      const now = Math.floor(Date.now() / 1000);
      const dTag = `refuel:${vehicleId}:${now}`;

      const amount = fuelAmount ? parseFloat(fuelAmount) : undefined;
      if (fuelAmount && (isNaN(amount!) || amount! <= 0)) {
        error = "給油量の値が不正です";
        saving = false;
        return;
      }

      const content: Record<string, unknown> = {
        v: 1,
        vehicleId,
        date,
        isFullTank,
      };

      if (amount != null) content.fuelAmount = amount;
      if (odometer) content.odometer = parseFloat(odometer);
      if (pricePerLiter) content.pricePerLiter = parseFloat(pricePerLiter);
      if (totalCost) content.totalCost = parseInt(totalCost);
      if (station.trim()) content.station = station.trim();
      if (notes.trim()) content.notes = notes.trim();

      await publishEvent(dTag, "refuel", content);

      records.addRefuel({
        id: dTag,
        vehicleId,
        date,
        fuelAmount: amount,
        isFullTank,
        odometer: odometer ? parseFloat(odometer) : undefined,
        pricePerLiter: pricePerLiter ? parseFloat(pricePerLiter) : undefined,
        totalCost: totalCost ? parseInt(totalCost) : undefined,
        station: station.trim() || undefined,
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

      toastStore.show("給油を記録しました! ⛽");
      setTimeout(() => goto("/home"), 1200);
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
    <h2 class="text-xl font-bold">⛽ 給油記録</h2>
  </div>

  {#if fuelTypeLabel}
    <div class="bg-surface rounded-lg px-3 py-2 text-sm">
      ⛽ この車両は <span class="text-primary font-bold">{fuelTypeLabel}</span> です
    </div>
  {/if}

  <!-- ワンタップ: 満タンにした！ -->
  <button
    type="button"
    onclick={quickFullTank}
    disabled={saving}
    class="bg-primary hover:bg-primary-dark flex w-full items-center justify-center gap-3 rounded-xl py-5 text-lg font-bold text-white shadow-lg transition-colors disabled:opacity-50"
  >
    <span class="text-3xl">⛽</span>
    <span>{saving ? "保存中..." : "満タンにした！"}</span>
  </button>
  <p class="text-text-muted text-center text-xs">
    量がわからなくても OK。タップだけで給油を記録
  </p>

  <!-- 区切り線 -->
  <div class="flex items-center gap-3">
    <div class="h-px flex-1 bg-white/10"></div>
    <span class="text-text-muted text-xs">詳しく記録する場合</span>
    <div class="h-px flex-1 bg-white/10"></div>
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
      <label for="date" class="text-text-muted mb-1 block text-sm">日付</label>
      <input
        id="date"
        type="date"
        bind:value={date}
        max={new Date().toISOString().slice(0, 10)}
        class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- 給油量 (任意) -->
    <div>
      <label for="fuelAmount" class="text-text-muted mb-1 block text-sm"
        >給油量 (L)</label
      >
      <input
        id="fuelAmount"
        type="number"
        bind:value={fuelAmount}
        step="0.01"
        min="0"
        placeholder="わからなければ空欄で OK"
        inputmode="decimal"
        class="bg-surface-light w-full rounded-lg px-4 py-3 text-lg text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- 満タン -->
    <label class="flex items-center justify-between">
      <span class="text-sm">満タン</span>
      <button
        type="button"
        onclick={() => {
          isFullTank = !isFullTank;
        }}
        class="relative h-7 w-12 rounded-full transition-colors {isFullTank
          ? 'bg-primary'
          : 'bg-surface-light'}"
      >
        <span
          class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform {isFullTank
            ? 'left-5.5'
            : 'left-0.5'}"
        ></span>
      </button>
    </label>
    <p class="text-xs text-text-muted mt-1">
      <span class="font-bold">※ 満タンチェックについて</span><br />
      給油量と走行距離を両方入力していれば、満タンかどうかに関係なく燃費計算されます。<br
      />
      満タンチェックは「区間のリセット」や「量不明時の区切り」用途です。<br />
      毎回fuelAmountとODOを入れている場合は、どちらでもOKです。
    </p>

    <!-- 金額セクション (任意・折りたたみ) -->
    <details>
      <summary
        class="text-text-muted flex cursor-pointer items-center gap-1 text-sm select-none"
      >
        <span class="transition-transform group-open:rotate-90">▶</span>
        💰 金額
      </summary>
      <div class="mt-3 space-y-3">
        <div>
          <label for="totalCost" class="text-text-muted mb-1 block text-sm"
            >合計金額 (¥)</label
          >
          <input
            id="totalCost"
            type="number"
            bind:value={totalCost}
            placeholder="1838"
            inputmode="numeric"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="pricePerLiter" class="text-text-muted mb-1 block text-sm">
            単価 (¥/L)
            {#if lastRefuel?.pricePerLiter}
              <span class="text-text-muted"
                >前回: ¥{lastRefuel.pricePerLiter}</span
              >
            {/if}
          </label>
          <input
            id="pricePerLiter"
            type="number"
            bind:value={pricePerLiter}
            placeholder={lastRefuel?.pricePerLiter?.toString() ?? "175"}
            inputmode="numeric"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </details>

    <!-- 走行距離 (任意・折りたたみ) -->
    <details>
      <summary
        class="text-text-muted flex cursor-pointer items-center gap-1 text-sm select-none"
      >
        <span class="transition-transform group-open:rotate-90">▶</span>
        📏 走行距離
      </summary>
      <div class="mt-3">
        <label for="odometer" class="text-text-muted mb-1 block text-sm">
          ODO (km)
          {#if lastRefuel?.odometer}
            <span class="text-text-muted"
              >前回: {lastRefuel.odometer.toLocaleString()} km</span
            >
          {/if}
        </label>
        <input
          id="odometer"
          type="number"
          bind:value={odometer}
          placeholder={lastRefuel?.odometer
            ? (lastRefuel.odometer + 200).toString()
            : "5000"}
          inputmode="numeric"
          class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="text-text-muted mt-1 text-xs">
          💡 入力すると燃費が計算されます
        </p>
        {#if odometer && latestOdo != null && parseFloat(odometer) < latestOdo}
          <p class="mt-1 text-xs text-amber-400">
            ⚠️ 前回の記録 ({latestOdo.toLocaleString()} km) より小さい値です
          </p>
        {/if}
      </div>
    </details>

    <!-- その他 (任意・折りたたみ) -->
    <details>
      <summary
        class="text-text-muted flex cursor-pointer items-center gap-1 text-sm select-none"
      >
        <span class="transition-transform group-open:rotate-90">▶</span>
        📝 その他
      </summary>
      <div class="mt-3 space-y-3">
        <div>
          <label for="station" class="text-text-muted mb-1 block text-sm"
            >ガソリンスタンド</label
          >
          <input
            id="station"
            type="text"
            bind:value={station}
            placeholder="※公開されます。特定されない名前で"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-amber-400">
            ⚠️ 自宅近くの店舗名は入力しないでください
          </p>
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
      class="bg-surface-light hover:bg-surface w-full rounded-lg py-3 font-bold text-white transition-colors disabled:opacity-50"
    >
      {saving ? "保存中..." : "📝 詳細を記録する"}
    </button>
  </form>
</div>
