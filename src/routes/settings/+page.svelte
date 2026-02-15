<script lang="ts">
  import { auth, vehicleStore, records } from "$lib/stores/app.svelte";

  let relayInput = $state("");
  let showRelayForm = $state(false);
  let exportStatus = $state("");

  const defaultRelays = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.nostr.wirednet.jp",
  ];

  function handleLogout() {
    if (!confirm("ログアウトしますか？ローカルデータはクリアされます。"))
      return;
    records.clear();
    auth.logout();
    location.href = "/";
  }

  function exportData() {
    const vid = vehicleStore.activeVehicleId;
    const allRecords = vid ? records.getTimeline(vid) : [];
    if (allRecords.length === 0) {
      exportStatus = "エクスポートするデータがありません";
      return;
    }

    const data = {
      exportedAt: new Date().toISOString(),
      vehicles: vehicleStore.vehicles,
      records: allRecords,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moto-log-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    exportStatus = "エクスポート完了！";
    setTimeout(() => (exportStatus = ""), 3000);
  }

  function clearLocalData() {
    if (
      !confirm(
        "ローカルデータをすべてクリアしますか？\nNostr上のデータは残ります。再ログインで復元できます。",
      )
    )
      return;
    records.clear();
    vehicleStore.vehicles.length = 0;
    location.reload();
  }
</script>

<div class="space-y-4">
  <h2 class="text-xl font-bold">⚙️ 設定</h2>

  <!-- 車両情報 -->
  <div class="bg-surface rounded-xl p-4">
    <h3 class="text-text-muted mb-3 text-sm font-medium">🏍️ 車両</h3>
    {#if vehicleStore.vehicles.length === 0}
      <p class="text-text-muted text-sm">車両が登録されていません</p>
      <a
        href="/vehicle?new=1"
        class="bg-primary hover:bg-primary-dark mt-2 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
      >
        バイクを登録する
      </a>
    {:else}
      <div class="space-y-2">
        {#each vehicleStore.vehicles as v}
          <div
            class="bg-bg flex items-center justify-between rounded-lg px-3 py-2"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{v.name}</span>
                {#if v.id === vehicleStore.activeVehicleId}
                  <span
                    class="bg-primary/20 text-primary rounded px-1.5 py-0.5 text-xs"
                    >使用中</span
                  >
                {/if}
              </div>
              <div class="text-text-muted text-xs">
                {[
                  v.maker,
                  v.year ? `${v.year}年` : "",
                  v.displacement ? `${v.displacement}cc` : "",
                ]
                  .filter(Boolean)
                  .join(" / ") || "詳細未設定"}
              </div>
            </div>
            <a
              href="/vehicle?id={v.id}"
              class="text-primary text-xs hover:underline"
            >
              編集
            </a>
          </div>
        {/each}
      </div>
      <a
        href="/vehicle?new=1"
        class="bg-surface-light hover:bg-surface mt-3 inline-block rounded-lg px-4 py-2 text-sm transition-colors"
      >
        ＋ バイクを追加
      </a>
    {/if}
  </div>

  <!-- アカウント情報 -->
  <div class="bg-surface rounded-xl p-4">
    <h3 class="text-text-muted mb-3 text-sm font-medium">🔑 アカウント</h3>
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm">公開鍵</span>
        <code class="bg-bg max-w-48 truncate rounded px-2 py-1 text-xs">
          {auth.pubkey?.slice(0, 16)}...
        </code>
      </div>
      <button
        onclick={handleLogout}
        class="mt-2 w-full rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400 hover:bg-red-900/50"
      >
        ログアウト
      </button>
    </div>
  </div>

  <!-- リレー設定 -->
  <div class="bg-surface rounded-xl p-4">
    <h3 class="text-text-muted mb-3 text-sm font-medium">📡 リレー</h3>
    <div class="space-y-2">
      {#each defaultRelays as relay}
        <div
          class="bg-bg flex items-center justify-between rounded-lg px-3 py-2"
        >
          <span class="text-sm">{relay.replace("wss://", "")}</span>
          <span class="text-xs text-green-400">接続中</span>
        </div>
      {/each}
    </div>
    <p class="text-text-muted mt-2 text-xs">
      ※ リレーの変更は今後のアップデートで対応予定です
    </p>
  </div>

  <!-- データ管理 -->
  <div class="bg-surface rounded-xl p-4">
    <h3 class="text-text-muted mb-3 text-sm font-medium">💾 データ管理</h3>
    <div class="space-y-2">
      <button
        onclick={exportData}
        class="bg-bg hover:bg-primary/20 w-full rounded-lg px-4 py-2 text-left text-sm"
      >
        📥 JSON エクスポート
      </button>
      {#if exportStatus}
        <p class="text-xs text-green-400">{exportStatus}</p>
      {/if}
      <button
        onclick={clearLocalData}
        class="bg-bg w-full rounded-lg px-4 py-2 text-left text-sm text-amber-400 hover:bg-amber-900/20"
      >
        🗑️ ローカルデータクリア
      </button>
      <p class="text-text-muted text-xs">
        Nostr 上のデータは残ります。再ログインで復元できます。
      </p>
    </div>
  </div>

  <!-- セキュリティリマインダー -->
  <div class="rounded-xl border border-amber-700/50 bg-amber-900/20 p-4">
    <h3 class="mb-2 text-sm font-medium text-amber-400">
      ⚠️ セキュリティリマインダー
    </h3>
    <ul class="space-y-1 text-xs text-amber-300/80">
      <li>🔴 ナンバープレート番号は絶対に入力しない</li>
      <li>🟡 ガソリンスタンド名から行動圏が推測されます</li>
      <li>🟡 ショップ名から居住地が特定される可能性</li>
      <li>🟢 給油量・燃費データは比較的安全</li>
      <li class="mt-1">
        Nostr
        に投稿したデータは完全な削除ができません。入力前に「これが公開されて大丈夫か？」を確認してください。
      </li>
    </ul>
  </div>

  <!-- アプリ情報 -->
  <div class="bg-surface rounded-xl p-4 text-center">
    <p class="text-lg">🏍️ Nostr Moto Log</p>
    <p class="text-text-muted text-xs">v0.1.0 - MVP</p>
    <p class="text-text-muted mt-1 text-xs">
      Nostr kind:30078 でバイク記録を管理
    </p>
  </div>
</div>
