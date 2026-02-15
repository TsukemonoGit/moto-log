# 型定義と UI の差分分析

types.ts に定義されているフィールドと、実際の UI（入力フォーム・表示）を照合した結果。
各項目について「必要か？」「どう対応するか？」を判定する。

---

## 1. 完全に未使用（型にあるが入力も表示もない）

### QuickRecord.details — ❌ 削除

- `details?: Record<string, unknown>` — 汎用の追加データ用に定義されたが、使い道が具体化していない
- 将来の拡張（空気圧の実測値を記録する等）用に残す選択肢もあるが、現時点では YAGNI
- **対応: 型定義から削除**

### InspectionRecord.odometer — ✅ 追加

- 点検時に ODO を記録できると、走行距離ベースの管理に便利
- 給油・ショップにはあるのに点検にないのは不自然
- **対応: 点検フォーム + edit に入力欄を追加、history に表示**

### InspectionIssue.note — ❌ 削除

- issue 単位のメモは粒度が細かすぎる。InspectionRecord.notes で十分
- **対応: 型定義から削除**

### OdometerRecord.notes — ❌ 削除

- ODO 記録は Quick 整備の副産物として自動作成される。メモを書く場面がない
- **対応: 型定義から削除**

---

## 2. 入力できるが表示されない

### Vehicle.fuelType — ✅ 表示追加

- レギュラー/ハイオク/軽油 — 給油する際に間違えないための重要情報
- **対応: 設定の車両一覧に表示 + 給油フォームにリマインダー表示**

### RefuelRecord.station — ✅ 表示追加

- せっかく入力しているので履歴カードに表示する
- **対応: history の給油カードに表示**

### RefuelRecord.notes — ✅ 表示追加

- メモも入力しているので履歴カードに表示する
- **対応: history の給油カードに表示**

### ShopRecord.category — ✅ 表示追加

- 定期整備 / 修理 / 車検 / その他 — 分類がわかると履歴が見やすい
- **対応: history のショップカードにバッジ表示**

### ShopRecord.notes — ✅ 表示追加

- メモも入力しているので履歴カードに表示する
- **対応: history のショップカードに表示**

---

## 3. 新規作成時に入力欄がない

### QuickRecord.notes — ✅ 追加（軽量に）

- ワンタップ整備のメリットは「即記録」なので、入力欄は常時表示しない
- ODO 入力と同様にトグルで展開する形にする
- **対応: log ページに「📝 メモも残す」トグル追加**

### InspectionRecord.notes — ✅ 追加

- 点検はフォーム型なので、普通にメモ欄を追加する
- **対応: 点検フォームの下部にメモ入力欄を追加**

---

## 4. データ不整合

### QuickRecord.odometer — ✅ 修正

- Nostr に publish しているのにローカルストアに保存されない
- **対応: `addQuick()` で odometer フィールドもセットする**

### InspectionIssue.status — ✅ 表示追加

- ⚠️ (warning) / NG の区別が履歴で見えない
- **対応: history の点検カードで status アイコンも表示**

### InspectionRecord.issues の edit — 🔜 後回し

- edit ページで issue を個別編集するのは UI が複雑になる
- 現状 allOk トグル＋一括クリアで運用可能
- **対応: 今回は見送り。将来対応**

---

## 対応サマリー

| #   | 対応                                       | 種別     | ファイル             |
| --- | ------------------------------------------ | -------- | -------------------- |
| 1   | `QuickRecord.details` を型から削除         | 型整理   | types.ts             |
| 2   | `InspectionIssue.note` を型から削除        | 型整理   | types.ts             |
| 3   | `OdometerRecord.notes` を型から削除        | 型整理   | types.ts             |
| 4   | 点検フォームに ODO 入力欄追加              | 入力追加 | log/inspection, edit |
| 5   | 点検フォームに notes 入力欄追加            | 入力追加 | log/inspection       |
| 6   | Quick 整備に notes トグル追加              | 入力追加 | log/+page            |
| 7   | Quick の addQuick に odometer セット       | バグ修正 | log/+page            |
| 8   | Vehicle.fuelType を設定・給油に表示        | 表示追加 | settings, log/refuel |
| 9   | RefuelRecord の station/notes を履歴に表示 | 表示追加 | history              |
| 10  | ShopRecord の category/notes を履歴に表示  | 表示追加 | history              |
| 11  | InspectionIssue.status を履歴に表示        | 表示追加 | history              |
