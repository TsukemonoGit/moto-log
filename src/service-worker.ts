/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;

// キャッシュ名 (ビルドごとにバージョンが変わる)
const CACHE = `cache-${version}`;

// キャッシュ対象: ビルド成果物 + static ファイル
const ASSETS = [...build, ...files];

// インストール時に全アセットをキャッシュ
sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => sw.skipWaiting()),
  );
});

// アクティブ化時に古いキャッシュを削除
sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      for (const key of keys) {
        if (key !== CACHE) await caches.delete(key);
      }
      sw.clients.claim();
    }),
  );
});

// フェッチ戦略: ビルドアセットはキャッシュ優先、その他はネットワーク優先
sw.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // WebSocket はスルー
  if (url.protocol === "wss:" || url.protocol === "ws:") return;

  // 外部リソースはスルー
  if (url.origin !== location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const isAsset = ASSETS.includes(url.pathname);

      if (isAsset) {
        // ビルドアセット → キャッシュ優先 (Cache First)
        const cached = await cache.match(event.request);
        if (cached) return cached;
      }

      try {
        // ネットワークから取得
        const response = await fetch(event.request);

        // 成功したらキャッシュに保存 (ナビゲーション含む)
        if (response.status === 200) {
          cache.put(event.request, response.clone());
        }

        return response;
      } catch {
        // オフライン時はキャッシュにフォールバック
        const cached = await cache.match(event.request);
        if (cached) return cached;

        // ナビゲーションリクエストならルートページを返す (SPA フォールバック)
        if (event.request.mode === "navigate") {
          const fallback = await cache.match("/");
          if (fallback) return fallback;
        }

        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});
