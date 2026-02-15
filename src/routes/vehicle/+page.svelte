<script lang="ts">
  import { goto } from "$app/navigation";
  import { vehicleStore } from "$lib/stores/app.svelte";
  import { publishEvent } from "$lib/nostr/publish";

  let name = $state("");
  let maker = $state("");
  let year = $state("");
  let displacement = $state("");
  let fuelTankCapacity = $state("");
  let fuelType = $state<"regular" | "premium" | "diesel">("regular");
  let saving = $state(false);
  let error = $state("");

  const existingVehicle = $derived(vehicleStore.activeVehicle);

  // 既存車両があれば初期値をセット
  $effect(() => {
    if (existingVehicle) {
      name = existingVehicle.name;
      maker = existingVehicle.maker ?? "";
      year = existingVehicle.year?.toString() ?? "";
      displacement = existingVehicle.displacement?.toString() ?? "";
      fuelTankCapacity = existingVehicle.fuelTankCapacity?.toString() ?? "";
      fuelType = existingVehicle.fuelType ?? "regular";
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
      const vehicleId = existingVehicle?.id ?? slugify(name);
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
      });

      goto("/home");
    } catch (e: any) {
      error = e.message || "保存に失敗しました";
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-6">
  <h2 class="text-xl font-bold">
    {existingVehicle ? "車両を編集" : "🏍️ バイクを登録"}
  </h2>

  {#if !existingVehicle}
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
      {saving ? "保存中..." : existingVehicle ? "更新する" : "登録する"}
    </button>
  </form>
</div>
