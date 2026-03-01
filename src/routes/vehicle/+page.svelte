<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { vehicleStore } from "$lib/stores/app.svelte";
  import { publishEvent, deleteEvent } from "$lib/nostr/publish";
  import { toastStore } from "$lib/stores/toast.svelte";

  let name = $state("");
  let maker = $state("");
  let year = $state("");
  let displacement = $state("");
  let fuelTankCapacity = $state("");
  let fuelType = $state<"regular" | "premium" | "diesel">("regular");
  let tirePressureFront = $state("");
  let tirePressureRear = $state("");
  let saving = $state(false);
  let deleting = $state(false);
  let error = $state("");

  // ?id=xxx で特定車両の編集、?new=1 で新規追加、それ以外は activeVehicle の編集
  const isNewMode = $derived(page.url.searchParams.get("new") === "1");

  const editTarget = $derived(() => {
    if (isNewMode) return undefined;
    const id = page.url.searchParams.get("id");
    if (id) return vehicleStore.vehicles.find((v) => v.id === id);
    return vehicleStore.activeVehicle;
  });

  // 編集対象があればフォームにセット
  $effect(() => {
    const v = editTarget();
    if (v) {
      name = v.name;
      maker = v.maker ?? "";
      year = v.year?.toString() ?? "";
      displacement = v.displacement?.toString() ?? "";
      fuelTankCapacity = v.fuelTankCapacity?.toString() ?? "";
      fuelType = v.fuelType ?? "regular";
      tirePressureFront = v.recommendedTirePressureFront?.toString() ?? "";
      tirePressureRear = v.recommendedTirePressureRear?.toString() ?? "";
    }
  });

  function slugify(text: string): string {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9\u3000-\u9fff]+/g, "-")
        .replace(/^-|-$/g, "") || `vehicle-${Date.now()}`
    );
  }

  async function save() {
    if (!name.trim()) {
      error = "車両名を入力してください";
      return;
    }

    saving = true;
    error = "";

    try {
      const vehicleId = editTarget()?.id ?? slugify(name);
      const content: Record<string, unknown> = {
        v: 1,
        name: name.trim(),
      };
      if (maker.trim()) content.maker = maker.trim();
      if (year) content.year = parseInt(year);
      if (displacement) content.displacement = parseInt(displacement);
      if (fuelTankCapacity)
        content.fuelTankCapacity = parseFloat(fuelTankCapacity);
      content.fuelType = fuelType;
      if (tirePressureFront)
        content.recommendedTirePressureFront = parseInt(tirePressureFront);
      if (tirePressureRear)
        content.recommendedTirePressureRear = parseInt(tirePressureRear);

      await publishEvent(`vehicle:${vehicleId}`, "vehicle", content);

      vehicleStore.addVehicle({
        id: vehicleId,
        name: name.trim(),
        maker: maker.trim() || undefined,
        year: year ? parseInt(year) : undefined,
        displacement: displacement ? parseInt(displacement) : undefined,
        fuelTankCapacity: fuelTankCapacity
          ? parseFloat(fuelTankCapacity)
          : undefined,
        fuelType,
        recommendedTirePressureFront: tirePressureFront
          ? parseInt(tirePressureFront)
          : undefined,
        recommendedTirePressureRear: tirePressureRear
          ? parseInt(tirePressureRear)
          : undefined,
      });

      // 新規追加時はその車両をアクティブに
      if (isNewMode) vehicleStore.setActive(vehicleId);
      goto("/settings");
    } catch (e: any) {
      error = e.message || "保存に失敗しました";
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    const target = editTarget();
    if (!target) return;
    if (
      !confirm(
        `「${target.name}」を削除しますか？\nNostr上のデータも削除されます。`,
      )
    )
      return;

    deleting = true;
    error = "";

    try {
      await deleteEvent(`vehicle:${target.id}`);
      vehicleStore.removeVehicle(target.id);
      toastStore.show("車両を削除しました");
      goto("/settings");
    } catch (e: any) {
      error = e.message || "削除に失敗しました";
    } finally {
      deleting = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <a href="/settings" class="text-text-muted hover:text-text">←</a>
    <h2 class="text-xl font-bold">
      {editTarget() ? "車両を編集" : "🏍️ バイクを登録"}
    </h2>
  </div>

  {#if !editTarget()}
    <p class="text-text-muted text-sm">
      まずはバイクの名前だけでOK! 詳細は後からいつでも追加できます。
    </p>
  {/if}

  <!-- 注意書き -->
  <div
    class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
  >
    <p class="text-amber-400">
      ⚠️
      ここで入力した情報は公開されます。ナンバープレートや個人を特定できる情報は入力しないでください。
    </p>
  </div>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      save();
    }}
    class="space-y-4"
  >
    <!-- 名前 (必須) -->
    <div>
      <label for="name" class="text-text-muted mb-1 block text-sm"
        >車両名 *</label
      >
      <input
        id="name"
        type="text"
        bind:value={name}
        placeholder="例: Ninja 400"
        required
        class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- 任意項目 (折りたたみ) -->
    <details class="group">
      <summary
        class="text-text-muted flex cursor-pointer items-center gap-1 text-sm select-none"
      >
        <span class="transition-transform group-open:rotate-90">▶</span>
        詳細情報 (任意)
      </summary>
      <div class="mt-3 space-y-4">
        <div>
          <label for="maker" class="text-text-muted mb-1 block text-sm"
            >メーカー</label
          >
          <input
            id="maker"
            type="text"
            bind:value={maker}
            placeholder="例: Kawasaki"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="year" class="text-text-muted mb-1 block text-sm"
              >年式</label
            >
            <input
              id="year"
              type="number"
              bind:value={year}
              placeholder="2024"
              inputmode="numeric"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="displacement" class="text-text-muted mb-1 block text-sm"
              >排気量 (cc)</label
            >
            <input
              id="displacement"
              type="number"
              bind:value={displacement}
              placeholder="400"
              inputmode="numeric"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label
            for="fuelTankCapacity"
            class="text-text-muted mb-1 block text-sm">タンク容量 (L)</label
          >
          <input
            id="fuelTankCapacity"
            type="number"
            bind:value={fuelTankCapacity}
            step="0.1"
            placeholder="14"
            inputmode="decimal"
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <!-- タイヤ空気圧 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label
              for="tirePressureFront"
              class="text-text-muted mb-1 block text-sm">前輪空気圧 (kPa)</label
            >
            <input
              id="tirePressureFront"
              type="number"
              bind:value={tirePressureFront}
              placeholder="225"
              inputmode="numeric"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              for="tirePressureRear"
              class="text-text-muted mb-1 block text-sm">後輪空気圧 (kPa)</label
            >
            <input
              id="tirePressureRear"
              type="number"
              bind:value={tirePressureRear}
              placeholder="250"
              inputmode="numeric"
              class="bg-surface-light w-full rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <p class="text-text-muted -mt-2 text-xs">
          💡 設定すると空気圧入れる時に表示されます
        </p>

        <div>
          <label for="fuelType" class="text-text-muted mb-1 block text-sm"
            >燃料種別</label
          >
          <select
            id="fuelType"
            bind:value={fuelType}
            class="bg-surface-light w-full rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="regular">レギュラー</option>
            <option value="premium">ハイオク</option>
            <option value="diesel">軽油</option>
          </select>
        </div>
      </div>
    </details>

    {#if error}
      <p class="text-sm text-red-400">{error}</p>
    {/if}

    <button
      type="submit"
      disabled={saving || !name.trim()}
      class="bg-primary hover:bg-primary-dark w-full rounded-lg py-3 font-bold text-white transition-colors disabled:opacity-50"
    >
      {saving ? "保存中..." : editTarget() ? "更新する" : "登録する"}
    </button>
  </form>

  {#if editTarget()}
    <div class="border-t border-white/10 pt-4">
      <button
        type="button"
        onclick={handleDelete}
        disabled={deleting}
        class="w-full rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400 hover:bg-red-900/50 disabled:opacity-50"
      >
        {deleting ? "削除中..." : "🗑️ この車両を削除"}
      </button>
    </div>
  {/if}
</div>
