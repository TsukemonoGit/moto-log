<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    auth,
    vehicleStore,
    records,
    pagination,
  } from "$lib/stores/app.svelte";
  import { loadAllData } from "$lib/nostr/subscribe";
  import { getRxNostr } from "$lib/nostr/client";

  let loggingIn = $state(false);
  let error = $state("");
  let privacyAcknowledged = $state(false);

  async function doLogin() {
    const nostr = (window as any).nostr;
    if (!nostr) {
      error =
        "Nostr の署名拡張が見つかりません。nos2x 等をインストールしてください。";
      return;
    }

    loggingIn = true;
    error = "";

    try {
      const pubkey = await nostr.getPublicKey();
      auth.login(pubkey);
      getRxNostr();

      // データ読み込み
      records.setLoading(true);
      const data = await loadAllData(pubkey);
      vehicleStore.setVehicles(data.vehicles);
      records.setAll(data);
      pagination.setCursor(data.cursor, data.hasMore);
      records.setLoading(false);

      // 車両未登録ならセットアップへ、そうでなければホームへ
      if (data.vehicles.length === 0) {
        goto("/vehicle");
      } else {
        goto("/home");
      }
    } catch (e: any) {
      error = e.message || "ログインに失敗しました";
      loggingIn = false;
    }
  }
</script>

<div class="flex min-h-screen flex-col items-center justify-center px-4">
  <div class="w-full max-w-sm text-center">
    <div class="mb-6 text-6xl">🏍️</div>
    <h1 class="mb-2 text-3xl font-bold">Nostr Moto Log</h1>
    <p class="text-text-muted mb-8">バイクの記録を気軽に残そう</p>

    <!-- プライバシー警告 -->
    <div
      class="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-left text-sm"
    >
      <p class="mb-2 font-bold text-amber-400">⚠️ 公開データに関する注意</p>
      <p class="text-text-muted mb-2">
        このアプリのデータは <strong class="text-text"
          >Nostr リレーに公開情報として</strong
        >
        保存されます。<strong class="text-amber-400">誰でも閲覧可能</strong
        >です。
      </p>
      <p class="text-text-muted mb-3">
        以下の情報は<strong class="text-danger">入力しないでください</strong>:
      </p>
      <ul class="text-text-muted mb-3 list-inside list-disc space-y-1">
        <li>🚨 ナンバープレート番号</li>
        <li>🚨 自宅近くのガソリンスタンド名</li>
        <li>🚨 バイク屋の具体的な店舗名</li>
        <li>🚨 個人情報 (名前・住所・電話番号)</li>
      </ul>
      <label class="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          bind:checked={privacyAcknowledged}
          class="accent-primary h-4 w-4"
        />
        <span class="text-text text-sm">上記の内容を理解しました</span>
      </label>
    </div>

    {#if error}
      <p class="mb-4 text-sm text-red-400">{error}</p>
    {/if}

    <button
      onclick={doLogin}
      disabled={loggingIn || !privacyAcknowledged}
      class="bg-primary hover:bg-primary-dark w-full rounded-lg px-6 py-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      {#if loggingIn}
        ログイン中...
      {:else}
        Nostr でログイン
      {/if}
    </button>

    <p class="text-text-muted mt-3 text-xs">
      NIP-07 拡張 または NIP-46 (Nostr Connect) に対応
    </p>
  </div>
</div>
