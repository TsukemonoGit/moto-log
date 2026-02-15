# 開発者 View 設計

## 背景・目的

Nostr の特性上、`kind 5` (NIP-09) で削除リクエストを送っても、リレーがそれを尊重するかは保証されず、データが残り続けることがある。  
開発者・上級ユーザーが以下を確認できる「開発者モード」を提供する:

- 各レコードに対応する **生の Nostr イベント JSON** の閲覧
- イベント ID / d-tag / 署名といった Nostr プロトコルレベルの情報
- リレー上に残存しているイベントの確認（再取得）

---

## 現状の課題

### 生イベントが保持されていない

現在の `subscribe.ts` → `loadAllData()` では、`packet.event` からパースした内容のみをストアに格納し、生の Nostr イベント (`NostrEvent`) を破棄している。

```typescript
// 現在: event を捨てて content だけ取得
const content = JSON.parse(event.content);
data.refuels.push({ id: dTag, createdAt: event.created_at, ...content });
```

**→ 生イベントを保持する仕組みが必要**

---

## 設計

### 1. 生イベントストア (`rawEvents`)

#### 方針

`loadAllData` 時に、各レコードの `id` (= d-tag) をキーとして生イベントを `Map` に保持する。

#### データ構造

```typescript
// src/lib/stores/app.svelte.ts に追加
import type { NostrEvent } from "nostr-tools";

let _rawEvents = $state<Map<string, NostrEvent>>(new Map());

export const rawEventStore = {
  get events() {
    return _rawEvents;
  },

  set(dTag: string, event: NostrEvent) {
    _rawEvents = new Map(_rawEvents); // Svelte リアクティビティ用
    _rawEvents.set(dTag, event);
  },

  get(dTag: string): NostrEvent | undefined {
    return _rawEvents.get(dTag);
  },

  /** vehicle の d-tag は "vehicle:{id}" ではなく id のみで保存されているため変換 */
  getForVehicle(vehicleId: string): NostrEvent | undefined {
    return _rawEvents.get(`vehicle:${vehicleId}`);
  },

  clear() {
    _rawEvents = new Map();
  },
};
```

#### subscribe.ts の変更

```typescript
// loadAllData 内
const subscription = rxNostr
  .use(req)
  .pipe(uniq())
  .subscribe({
    next: (packet) => {
      const event = packet.event;
      const dTag = event.tags.find((t) => t[0] === "d")?.[1] || "";

      // ★ 生イベントを保持
      rawEventStore.set(dTag, event);

      // 既存のパース処理...
    },
  });
```

---

### 2. UI 設計

#### 2a. アクセス方法

**設定ページ (`/settings`) に「開発者情報」セクションを追加**

```
設定ページ
├── 車両設定
├── リレー設定
├── アカウント
├── データ管理
└── 🆕 開発者情報        ← 新規セクション
    ├── イベント一覧ビュー (インライン展開)
    └── または /dev ページへのリンク
```

検討: 設定ページがすでに長いため、**専用ページ `/dev` を新設** する方が望ましい。
設定ページには「開発者情報 →」のリンクだけ置く。

#### 2b. `/dev` ページ構成

```
┌─────────────────────────────────┐
│ ← 開発者情報                      │
│                                 │
│ ⚠️ この画面はNostrイベントの      │
│   生データを表示します            │
│                                 │
│ ─── フィルター ───               │
│ [全て] [車両] [給油] [整備]      │
│ [点検] [ショップ] [走行距離]      │
│                                 │
│ ─── イベント: 24件 ───           │
│                                 │
│ ┌─ refuel:cbr600rr-1707...  ──┐ │
│ │ 📅 2026-02-10               │ │
│ │ Event ID: abc123...def       │ │
│ │ d-tag: refuel:cbr600rr-...  │ │
│ │ created_at: 1739180000       │ │
│ │ [▼ JSONを展開]               │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─ quick:cbr600rr-1707...  ──┐  │
│ │ 📅 2026-02-08               │ │
│ │ Event ID: xyz789...abc       │ │
│ │ [▼ JSONを展開]               │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─── アクション ───               │
│ [📋 全イベントJSONをコピー]       │
│ [🔄 リレーから再取得]             │
│                                 │
└─────────────────────────────────┘
```

#### 2c. JSON 展開時の表示

```
┌─ refuel:cbr600rr-1707... ──────────┐
│ 📅 2026-02-10                       │
│ Event ID: abc123def456...           │
│ d-tag: refuel:cbr600rr-1707849600  │
│ created_at: 1739180000              │
│                                     │
│ ▲ JSON を閉じる                     │
│ ┌──────────────────────────────┐    │
│ │ {                            │    │
│ │   "id": "abc123...",         │    │
│ │   "pubkey": "def456...",     │    │
│ │   "created_at": 1739180000, │    │
│ │   "kind": 30078,             │    │
│ │   "tags": [                  │    │
│ │     ["d", "refuel:cbr..."],  │    │
│ │     ["L", "nostr-moto-log"],│    │
│ │     ["l", "refuel", ...]     │    │
│ │   ],                         │    │
│ │   "content": "{...}",        │    │
│ │   "sig": "xyz..."            │    │
│ │ }                            │    │
│ └──────────────────────────────┘    │
│ [📋 コピー]                         │
│                                     │
│ ── content (パース済み) ──          │
│ ┌──────────────────────────────┐    │
│ │ {                            │    │
│ │   "vehicleId": "cbr600rr",  │    │
│ │   "date": "2026-02-10",     │    │
│ │   "fuelAmount": 12.5,       │    │
│ │   ...                        │    │
│ │ }                            │    │
│ └──────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

### 3. リレー再取得機能

現在ストアに保持している生イベントはアプリ起動時のスナップショットに過ぎない。  
「リレーから再取得」ボタンで **最新の状態を確認** できるようにする。

```typescript
// src/lib/nostr/subscribe.ts に追加
export function refetchRawEvents(pubkey: string): Promise<NostrEvent[]> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const rxNostr = getRxNostr();
    const req = createRxBackwardReq();

    const timeout = setTimeout(() => {
      sub.unsubscribe();
      resolve(events);
    }, 15_000);

    const sub = rxNostr
      .use(req)
      .pipe(uniq())
      .subscribe({
        next: (packet) => {
          events.push(packet.event);
        },
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe();
          resolve(events);
        },
      });

    req.emit({ kinds: [30078], authors: [pubkey], "#L": ["nostr-moto-log"] });
    req.over();
  });
}
```

これにより、削除リクエスト送信後にリレー上に残っているかどうかを確認できる。

---

### 4. 追加機能案（実装範囲の選択）

| 機能                     | 優先度   | 説明                                     |
| ------------------------ | -------- | ---------------------------------------- |
| イベント一覧 + JSON 展開 | ★★★ 必須 | 各レコードの生イベントを閲覧             |
| フィルター (種別)        | ★★★ 必須 | refuel / quick / inspection 等で絞り込み |
| JSON コピー              | ★★★ 必須 | クリップボードにコピー                   |
| content パース表示       | ★★☆ 推奨 | content 文字列を整形 JSON で表示         |
| リレー再取得             | ★★☆ 推奨 | 最新の状態をリレーから直接確認           |
| 全イベント一括コピー     | ★☆☆ 任意 | 全件を JSON 配列としてコピー             |
| 個別リレー指定取得       | ★☆☆ 任意 | 特定リレーだけに問い合わせ               |
| イベント ID 検索         | ★☆☆ 任意 | event ID で直接検索                      |

---

### 5. 実装上の注意点

#### 5a. `NostrEvent` 型

`nostr-tools` の `NostrEvent` (= `VerifiedEvent`) を使用する。

```typescript
interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}
```

#### 5b. メモリ考慮

生イベントは署名 (`sig`) 含めて 1 件 1〜2 KB 程度。  
1000 件でも 1〜2 MB 程度なので、通常利用の範囲ではメモリ問題にならない。

#### 5c. Vehicle の d-tag マッピング

Vehicle は `id` が `cbr600rr` だが d-tag は `vehicle:cbr600rr`。  
`rawEventStore.getForVehicle()` で変換する。  
他のレコード (refuel, quick, ...) は `id` = d-tag なのでそのまま。

#### 5d. セキュリティ

- 生イベントには `pubkey` と `sig` が含まれるが、公開情報なので問題なし
- 秘密鍵は含まれない（NIP-07 署名のため）

---

### 6. ファイル構成

```
src/routes/dev/
  +page.svelte          ← 開発者ビュー本体
src/lib/stores/
  app.svelte.ts         ← rawEventStore 追加
src/lib/nostr/
  subscribe.ts          ← loadAllData で生イベント保持 + refetchRawEvents 追加
src/routes/settings/
  +page.svelte          ← 「開発者情報」リンク追加
```

---

### 7. 実装ステップ

1. **`rawEventStore`** を `app.svelte.ts` に追加
2. **`subscribe.ts`** で `loadAllData` 内に `rawEventStore.set()` を追加
3. **`subscribe.ts`** に `refetchRawEvents()` を追加
4. **`/dev/+page.svelte`** を新規作成
   - フィルタータブ
   - イベントカード一覧
   - JSON 展開 / 折りたたみ
   - コピーボタン
   - リレー再取得ボタン
5. **`/settings`** に「開発者情報」セクション・リンクを追加
6. テスト & ビルド確認
