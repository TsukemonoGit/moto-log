<script lang="ts">
  import { vehicleStore } from "$lib/stores/app.svelte";
  import FuelSummary from "$lib/components/home/FuelSummary.svelte";
  import MaintenanceStatus from "$lib/components/home/MaintenanceStatus.svelte";
  import RecentTimeline from "$lib/components/home/RecentTimeline.svelte";

  const vehicle = $derived(vehicleStore.activeVehicle);
</script>

<div class="space-y-4">
  <!-- 車両名 -->
  {#if vehicle}
    <div class="text-text-muted text-sm">
      {vehicle.name}
      {#if vehicle.maker}
        · {vehicle.maker}{/if}
    </div>
  {/if}

  <FuelSummary />
  <MaintenanceStatus />
  <RecentTimeline />
</div>
