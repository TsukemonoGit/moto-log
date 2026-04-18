# 🏍️ Nostr Moto Log

バイクの給油・整備・点検を [Nostr](https://nostr.com/) に記録する PWA ウェブアプリ。

データは Nostr リレーに **kind 30078 (Parameterized Replaceable Event)** として保存されるため、特定のサーバーに依存せず、どこからでもアクセスできます。

## 主な機能

| カテゴリ              | 機能                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| ⛽ **給油**           | 給油量・金額・ODO・スタンドを記録。「満タンにした！」ワンタップ記録にも対応           |
| 🔧 **ワンタップ整備** | 空気圧・チェーン注油/清掃/調整・洗車・オイル確認 等をタップだけで即記録               |
| 📋 **点検**           | 日常/週間/月間点検。項目ごとの OK/NG 判定と ALL OK 率の追跡                           |
| 🏭 **ショップ整備**   | バイク屋での作業内容・費用・次回予定を記録                                            |
| 📊 **統計**           | 燃費推移、ガソリン単価推移、月別コスト (燃料/整備)、整備回数、点検 OK 率              |
| 🏠 **ダッシュボード** | 最終メンテ一覧 (色分け警告)、次回予定リマインダー、直近の記録                         |
| 📋 **履歴**           | タブフィルター (全て/給油/整備/点検/ショップ)、月別グループ表示、リッチカード         |
| 🚗 **複数車両**       | 2台持ちOK。設定画面からバイクの追加・編集・切り替えが可能。車両ごとに記録・統計を管理 |

## スクリーンショット

> TODO: スクリーンショットを追加

## 技術スタック

- **フレームワーク**: [SvelteKit](https://svelte.dev/) (Svelte 5 / Runes)
- **Nostr**: [rx-nostr](https://github.com/penpenpng/rx-nostr) + [nostr-tools](https://github.com/nbd-wtf/nostr-tools)
- **認証**: [@konemono/nostr-login](https://github.com/nicoschmdt/nostr-login) (NIP-07 / NIP-46)
- **スタイリング**: [Tailwind CSS 4](https://tailwindcss.com/)
- **ビルド**: [Vite](https://vite.dev/)

## Nostr イベント設計

すべてのデータは **kind 30078** の Parameterized Replaceable Event として保存されます。

```
d-tag 形式: {recordType}:{vehicleId}:{unixTimestamp}
```

| レコード種別 | d-tag プレフィックス          | 内容                 |
| ------------ | ----------------------------- | -------------------- |
| 車両情報     | `vehicle:{id}`                | 車両プロフィール     |
| 給油         | `refuel:{vehicleId}:{ts}`     | 給油量・金額・ODO 等 |
| クイック整備 | `quick:{vehicleId}:{ts}`      | ワンタップ整備記録   |
| 点検         | `inspection:{vehicleId}:{ts}` | 点検結果             |
| ショップ整備 | `shop:{vehicleId}:{ts}`       | 作業内容・費用       |
| 走行距離     | `odo:{vehicleId}:{ts}`        | オドメーター記録     |

## セットアップ

```sh
# リポジトリをクローン
git clone https://github.com/htm43/nostr-moto-log.git
cd nostr-moto-log

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

## 開発コマンド

```sh
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run preview      # ビルド結果のプレビュー
npm run check        # 型チェック (svelte-check)
```

## プロジェクト構成

```
src/
├── lib/
│   ├── components/Toast.svelte  # グローバルトースト通知
│   ├── constants.ts             # 共通定数・ラベル
│   ├── models/types.ts          # データ型定義
│   ├── stores/
│   │   ├── app.svelte.ts        # グローバル状態管理 (Svelte 5 Runes)
│   │   └── toast.svelte.ts      # トースト通知ストア
│   ├── nostr/
│   │   ├── client.ts            # rx-nostr クライアント
│   │   ├── publish.ts           # イベント発行
│   │   └── subscribe.ts         # イベント購読・データ読み込み
│   └── services/
│       └── fuel-calc.ts         # 燃費計算ロジック
├── routes/
│   ├── +layout.svelte           # 共通レイアウト (認証・ナビ・トースト)
│   ├── +page.svelte             # ログイン画面
│   ├── home/                    # ダッシュボード
│   ├── log/                     # 記録入力 (給油・点検・ショップ)
│   ├── history/                 # 履歴一覧
│   ├── stats/                   # 統計
│   ├── edit/                    # 記録編集
│   ├── settings/                # 設定
│   └── vehicle/                 # 車両登録
├── service-worker.ts            # PWA Service Worker
└── app.css                      # Tailwind CSS + カスタムテーマ
```

## デフォルトリレー

- `wss://x.kojira.io`
- `wss://nos.lol`
- `wss://nfrelay.app`

設定画面からリレーの追加・削除が可能です（予定）。接続状態はリアルタイムで確認できます。

## ⚠️ プライバシーに関する注意

Nostr に保存されるデータは**公開情報**です。以下の情報は入力しないでください：

- 🚨 ナンバープレート番号
- 🚨 自宅近くのガソリンスタンド名
- 🚨 バイク屋の具体的な店舗名
- 🚨 個人情報 (名前・住所・電話番号)

## ライセンス

MIT
