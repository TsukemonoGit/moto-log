<script lang="ts">
  import "../app.css";
  import { auth } from "$lib/stores/app.svelte";
  import { page } from "$app/state";

  let { children } = $props();

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
        <h1 class="text-lg font-bold">🏍️ Moto Log</h1>
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
