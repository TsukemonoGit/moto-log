<!-- グローバルトースト通知コンポーネント -->
<script lang="ts">
  import { toastStore } from "$lib/stores/toast.svelte";
</script>

{#if toastStore.message}
  <div
    class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white shadow-lg"
  >
    {toastStore.message}
  </div>
{/if}
