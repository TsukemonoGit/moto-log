// 車両プロフィール
export interface Vehicle {
  id: string; // slugified identifier
  name: string;
  maker?: string;
  year?: number;
  displacement?: number;
  fuelTankCapacity?: number;
  fuelType?: "regular" | "premium" | "diesel";
  recommendedTirePressureFront?: number; // kPa
  recommendedTirePressureRear?: number; // kPa
}

// 給油記録
export interface RefuelRecord {
  id: string; // d-tag
  vehicleId: string;
  date: string; // YYYY-MM-DD
  fuelAmount?: number; // L (任意: 量がわからなくても記録可能)
  isFullTank: boolean;
  odometer?: number; // km
  pricePerLiter?: number; // ¥/L
  totalCost?: number; // ¥
  station?: string;
  notes?: string;
  createdAt: number; // unix timestamp
}

// クイック整備アクション
export type QuickActionType =
  | "tire-pressure"
  | "chain-lube"
  | "chain-clean"
  | "chain-adjust"
  | "wash"
  | "oil-check"
  | "coolant-check"
  | "battery-charge"
  | "custom";

export interface QuickRecord {
  id: string;
  vehicleId: string;
  date: string;
  action: QuickActionType;
  odometer?: number;
  notes?: string;
  createdAt: number;
}

// 点検記録
export type InspectionType = "daily" | "weekly" | "monthly";

export interface InspectionIssue {
  item: string;
  status: "warning" | "ng";
}

export interface InspectionRecord {
  id: string;
  vehicleId: string;
  date: string;
  type: InspectionType;
  odometer?: number;
  allOk: boolean;
  issues: InspectionIssue[];
  notes?: string;
  createdAt: number;
}

// ショップ整備
export type ShopCategory = "regular" | "repair" | "shaken" | "custom";

export interface ShopRecord {
  id: string;
  vehicleId: string;
  date: string;
  odometer?: number;
  category?: ShopCategory;
  shopName?: string;
  workDone: string[];
  totalCost?: number;
  nextDate?: string;
  nextOdometer?: number;
  notes?: string;
  createdAt: number;
}

// 走行距離記録
export interface OdometerRecord {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  createdAt: number;
}

// すべての記録を統合するためのユニオン型
export type AnyRecord =
  | RefuelRecord
  | QuickRecord
  | InspectionRecord
  | ShopRecord
  | OdometerRecord;

// 記録種別の判定用
export type RecordType =
  | "refuel"
  | "quick"
  | "inspection"
  | "shop"
  | "odometer";

// タイムライン用の判別可能ユニオン型
export type TimelineItem =
  | { type: "refuel"; record: RefuelRecord; date: string }
  | { type: "quick"; record: QuickRecord; date: string }
  | { type: "inspection"; record: InspectionRecord; date: string }
  | { type: "shop"; record: ShopRecord; date: string }
  | { type: "odometer"; record: OdometerRecord; date: string };

// 燃費計算結果
export interface FuelEfficiency {
  date: string;
  kmPerLiter: number;
  distance: number;
  fuelAmount: number;
}
