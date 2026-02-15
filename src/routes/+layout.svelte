<script lang="ts">
  import "../app.css";
  import { auth, vehicleStore } from "$lib/stores/app.svelte";
  import { page } from "$app/state";

  let { children } = $props();
  let showVehicleMenu = $state(false);

  const navItems = [
    { href: "/home", label: "ホーム", icon: "🏠" },
    { href: "/log", label: "記録", icon: "✏️" },
    { href: "/history", label: "履歴", icon: "📋" },
    { href: "/stats", label: "統計", icon: "📊" },
  ];
</script>

{#if !auth.loggedIn}
  {@render children()}
{:else}
  <div class="min-h-screen pb-20">
    <!-- Header -->
    <header
      class="bg-surface sticky top-0 z-50 border-b border-white/10 px-4 py-3"
    >
      <div class="mx-auto flex max-w-lg items-center justify-between">
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-bold">🏍️ Moto Log</h1>
          {#if vehicleStore.vehicles.length > 1}
            <div class="relative">
              <button
                type="button"
                onclick={() => (showVehicleMenu = !showVehicleMenu)}
                class="bg-surface-light rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/10"
              >
                {vehicleStore.activeVehicle?.name ?? "車両"} ▼
              </button>
              {#if showVehicleMenu}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="bg-surface absolute top-full left-0 z-50 mt-1 min-w-[140px] rounded-lg border border-white/10 py-1 shadow-xl"
                  onmouseleave={() => (showVehicleMenu = false)}
                >
                  {#each vehicleStore.vehicles as v}
                    <button
                      type="button"
                      onclick={() => {
                        vehicleStore.setActive(v.id);
                        showVehicleMenu = false;
                      }}
                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 {v.id ===
                      vehicleStore.activeVehicleId
                        ? 'text-primary font-medium'
                        : 'text-text-muted'}"
                    >
                      {v.id === vehicleStore.activeVehicleId ? "✓" : ""}
                      {v.name}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {:else if vehicleStore.activeVehicle}
            <span class="text-text-muted text-xs"
              >{vehicleStore.activeVehicle.name}</span
            >
          {/if}
        </div>
        <a href="/settings" class="text-text-muted hover:text-text text-xl"
          >⚙️</a
        >
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto max-w-lg px-4 py-4">
      {@render children()}
    </main>

    <!-- Bottom Navigation -->
    <nav
      class="bg-surface fixed bottom-0 left-0 right-0 z-50 border-t border-white/10"
    >
      <div class="mx-auto flex max-w-lg">
        {#each navItems as item}
          <a
            href={item.href}
            class="flex flex-1 flex-col items-center py-2 text-xs transition-colors {page
              .url.pathname === item.href ||
            page.url.pathname.startsWith(item.href + '/')
              ? 'text-primary'
              : 'text-text-muted hover:text-text'}"
          >
            <span class="text-xl">{item.icon}</span>
            <span class="mt-0.5">{item.label}</span>
          </a>
        {/each}
      </div>
    </nav>
  </div>
{/if}
