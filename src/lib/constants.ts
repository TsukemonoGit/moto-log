import type { QuickActionType, ShopCategory } from "$lib/models/types";

// --- Nostr アプリラベル ---
export const APP_LABEL = "nostr-moto-log";

// --- クイック整備ラベル ---

/** アイコン付きラベル (履歴・統計・ホームで使用) */
export const QUICK_ACTION_LABELS: Record<string, string> = {
  "tire-pressure": "💨 空気圧",
  "chain-lube": "🔗 チェーン注油",
  "chain-clean": "🔗 チェーン清掃",
  "chain-adjust": "⛓️ チェーン調整",
  wash: "🚿 洗車",
  "oil-check": "🛢 オイル確認",
  "coolant-check": "💧 冷却水",
  "battery-charge": "🔋 バッテリー",
  custom: "📝 その他",
};

/** テキストのみラベル (編集ページで使用) */
export const QUICK_ACTION_TEXT_LABELS: Record<QuickActionType, string> = {
  "tire-pressure": "空気圧チェック",
  "chain-lube": "チェーン注油",
  "chain-clean": "チェーン清掃",
  "chain-adjust": "チェーン調整",
  wash: "洗車",
  "oil-check": "オイル確認",
  "coolant-check": "冷却水確認",
  "battery-charge": "バッテリー充電",
  custom: "その他",
};

// --- ショップ整備 ---

/** ショップ作業選択肢 */
export const SHOP_WORK_OPTIONS: { key: string; label: string }[] = [
  { key: "oilChange", label: "オイル交換" },
  { key: "oilFilterChange", label: "オイルフィルター交換" },
  { key: "airFilterChange", label: "エアフィルター交換" },
  { key: "sparkPlugChange", label: "スパークプラグ交換" },
  { key: "brakeFluidChange", label: "ブレーキフルード交換" },
  { key: "coolantChange", label: "クーラント交換" },
  { key: "chainAdjust", label: "チェーン調整" },
  { key: "brakePadReplace", label: "ブレーキパッド交換" },
  { key: "tireReplaceFront", label: "前タイヤ交換" },
  { key: "tireReplaceRear", label: "後タイヤ交換" },
  { key: "batteryReplace", label: "バッテリー交換" },
  { key: "forkOilChange", label: "フォークオイル交換" },
];

/** ショップカテゴリラベル */
export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  regular: "定期",
  repair: "修理",
  shaken: "車検",
  custom: "カスタム",
};

/** ショップカテゴリタブ用配列 */
export const SHOP_CATEGORY_TABS: [ShopCategory, string][] = [
  ["regular", "定期"],
  ["repair", "修理"],
  ["shaken", "車検"],
  ["custom", "カスタム"],
];

// --- 点検 ---

/** 点検タイプラベル */
export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  daily: "日常",
  weekly: "週間",
  monthly: "月間",
};

// --- 燃料種別 ---

/** 燃料種別のラベルを返す */
export function getFuelTypeLabel(
  fuelType?: "regular" | "premium" | "diesel",
): string | null {
  if (!fuelType) return null;
  const labels: Record<string, string> = {
    regular: "レギュラー",
    premium: "ハイオク",
    diesel: "軽油",
  };
  return labels[fuelType] ?? null;
}
