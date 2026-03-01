import type {
  Vehicle,
  RefuelRecord,
  QuickRecord,
  InspectionRecord,
  ShopRecord,
  OdometerRecord,
  AnyRecord,
  RecordType,
  TimelineItem,
} from "$lib/models/types";
import type { NostrEvent } from "nostr-tools";

// --- Auth ---
let _pubkey = $state<string | null>(null);
let _loggedIn = $state(false);

export const auth = {
  get pubkey() {
    return _pubkey;
  },
  get loggedIn() {
    return _loggedIn;
  },
  login(pubkey: string) {
    _pubkey = pubkey;
    _loggedIn = true;
  },
  logout() {
    _pubkey = null;
    _loggedIn = false;
    records.clear();
    pagination.clear();
  },
};

// --- Vehicle ---
let _vehicles = $state<Vehicle[]>([]);
let _activeVehicleId = $state<string | null>(null);

export const vehicleStore = {
  get vehicles() {
    return _vehicles;
  },
  get activeVehicleId() {
    return _activeVehicleId;
  },
  get activeVehicle(): Vehicle | undefined {
    return _vehicles.find((v) => v.id === _activeVehicleId);
  },
  setVehicles(vehicles: Vehicle[]) {
    _vehicles = vehicles;
    if (vehicles.length > 0 && !_activeVehicleId) {
      _activeVehicleId = vehicles[0].id;
    }
  },
  addVehicle(vehicle: Vehicle) {
    // 同じ ID の車両が既にあれば更新、なければ追加
    const idx = _vehicles.findIndex((v) => v.id === vehicle.id);
    if (idx >= 0) {
      _vehicles = _vehicles.map((v) => (v.id === vehicle.id ? vehicle : v));
    } else {
      _vehicles = [..._vehicles, vehicle];
    }
    if (!_activeVehicleId) {
      _activeVehicleId = vehicle.id;
    }
  },
  removeVehicle(id: string) {
    _vehicles = _vehicles.filter((v) => v.id !== id);
    // 削除した車両がアクティブだった場合は別の車両に切り替え
    if (_activeVehicleId === id) {
      _activeVehicleId = _vehicles.length > 0 ? _vehicles[0].id : null;
    }
  },
  setActive(id: string) {
    _activeVehicleId = id;
  },
};

// --- Records ---
let _refuels = $state<RefuelRecord[]>([]);
let _quickRecords = $state<QuickRecord[]>([]);
let _inspections = $state<InspectionRecord[]>([]);
let _shopRecords = $state<ShopRecord[]>([]);
let _odometerRecords = $state<OdometerRecord[]>([]);
let _loading = $state(false);

export const records = {
  get refuels() {
    return _refuels;
  },
  get quickRecords() {
    return _quickRecords;
  },
  get inspections() {
    return _inspections;
  },
  get shopRecords() {
    return _shopRecords;
  },
  get odometerRecords() {
    return _odometerRecords;
  },
  get loading() {
    return _loading;
  },

  setLoading(v: boolean) {
    _loading = v;
  },

  setAll(data: {
    refuels: RefuelRecord[];
    quickRecords: QuickRecord[];
    inspections: InspectionRecord[];
    shopRecords: ShopRecord[];
    odometerRecords: OdometerRecord[];
  }) {
    _refuels = data.refuels;
    _quickRecords = data.quickRecords;
    _inspections = data.inspections;
    _shopRecords = data.shopRecords;
    _odometerRecords = data.odometerRecords;
  },

  addRefuel(r: RefuelRecord) {
    _refuels = [r, ..._refuels].sort((a, b) => (a.date > b.date ? -1 : 1));
  },

  addQuick(r: QuickRecord) {
    _quickRecords = [r, ..._quickRecords].sort((a, b) =>
      a.date > b.date ? -1 : 1,
    );
  },

  addInspection(r: InspectionRecord) {
    _inspections = [r, ..._inspections].sort((a, b) =>
      a.date > b.date ? -1 : 1,
    );
  },

  addShop(r: ShopRecord) {
    _shopRecords = [r, ..._shopRecords].sort((a, b) =>
      a.date > b.date ? -1 : 1,
    );
  },

  addOdometer(r: OdometerRecord) {
    _odometerRecords = [r, ..._odometerRecords].sort((a, b) =>
      a.date > b.date ? -1 : 1,
    );
  },

  // --- 更新メソッド (同じ id のレコードを差し替え) ---
  updateRefuel(r: RefuelRecord) {
    _refuels = _refuels
      .map((x) => (x.id === r.id ? r : x))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  },
  updateQuick(r: QuickRecord) {
    _quickRecords = _quickRecords
      .map((x) => (x.id === r.id ? r : x))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  },
  updateInspection(r: InspectionRecord) {
    _inspections = _inspections
      .map((x) => (x.id === r.id ? r : x))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  },
  updateShop(r: ShopRecord) {
    _shopRecords = _shopRecords
      .map((x) => (x.id === r.id ? r : x))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  },
  updateOdometer(r: OdometerRecord) {
    _odometerRecords = _odometerRecords
      .map((x) => (x.id === r.id ? r : x))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  },

  // --- 削除メソッド ---
  removeRefuel(id: string) {
    _refuels = _refuels.filter((x) => x.id !== id);
  },
  removeQuick(id: string) {
    _quickRecords = _quickRecords.filter((x) => x.id !== id);
  },
  removeInspection(id: string) {
    _inspections = _inspections.filter((x) => x.id !== id);
  },
  removeShop(id: string) {
    _shopRecords = _shopRecords.filter((x) => x.id !== id);
  },
  removeOdometer(id: string) {
    _odometerRecords = _odometerRecords.filter((x) => x.id !== id);
  },

  /** 指定IDの記録を型と共に返す */
  findById(id: string): { type: RecordType; record: AnyRecord } | null {
    const r = _refuels.find((x) => x.id === id);
    if (r) return { type: "refuel", record: r };
    const q = _quickRecords.find((x) => x.id === id);
    if (q) return { type: "quick", record: q };
    const i = _inspections.find((x) => x.id === id);
    if (i) return { type: "inspection", record: i };
    const s = _shopRecords.find((x) => x.id === id);
    if (s) return { type: "shop", record: s };
    const o = _odometerRecords.find((x) => x.id === id);
    if (o) return { type: "odometer", record: o };
    return null;
  },

  /** 現在のアクティブ車両の記録だけフィルタして取得 */
  getForVehicle(vehicleId: string) {
    return {
      refuels: _refuels.filter((r) => r.vehicleId === vehicleId),
      quickRecords: _quickRecords.filter((r) => r.vehicleId === vehicleId),
      inspections: _inspections.filter((r) => r.vehicleId === vehicleId),
      shopRecords: _shopRecords.filter((r) => r.vehicleId === vehicleId),
      odometerRecords: _odometerRecords.filter(
        (r) => r.vehicleId === vehicleId,
      ),
    };
  },

  /** 全記録をタイムラインで取得 */
  getTimeline(vehicleId: string): TimelineItem[] {
    const items: TimelineItem[] = [];
    for (const r of _refuels.filter((x) => x.vehicleId === vehicleId))
      items.push({ type: "refuel", record: r, date: r.date });
    for (const r of _quickRecords.filter((x) => x.vehicleId === vehicleId))
      items.push({ type: "quick", record: r, date: r.date });
    for (const r of _inspections.filter((x) => x.vehicleId === vehicleId))
      items.push({ type: "inspection", record: r, date: r.date });
    for (const r of _shopRecords.filter((x) => x.vehicleId === vehicleId))
      items.push({ type: "shop", record: r, date: r.date });
    for (const r of _odometerRecords.filter((x) => x.vehicleId === vehicleId))
      items.push({ type: "odometer", record: r, date: r.date });
    items.sort((a, b) => (a.date > b.date ? -1 : 1));
    return items;
  },

  clear() {
    _refuels = [];
    _quickRecords = [];
    _inspections = [];
    _shopRecords = [];
    _odometerRecords = [];
  },

  /** 指定車両の最新オドメーター値を取得 (全記録種別から) */
  getLatestOdometer(vehicleId: string): number | null {
    let max: number | null = null;
    for (const r of _refuels) {
      if (r.vehicleId === vehicleId && r.odometer != null) {
        if (max === null || r.odometer > max) max = r.odometer;
      }
    }
    for (const r of _quickRecords) {
      if (r.vehicleId === vehicleId && r.odometer != null) {
        if (max === null || r.odometer > max) max = r.odometer;
      }
    }
    for (const r of _inspections) {
      if (r.vehicleId === vehicleId && r.odometer != null) {
        if (max === null || r.odometer > max) max = r.odometer;
      }
    }
    for (const r of _shopRecords) {
      if (r.vehicleId === vehicleId && r.odometer != null) {
        if (max === null || r.odometer > max) max = r.odometer;
      }
    }
    for (const r of _odometerRecords) {
      if (r.vehicleId === vehicleId) {
        if (max === null || r.odometer > max) max = r.odometer;
      }
    }
    return max;
  },

  /** 追加取得したデータをマージする (もっと読む) */
  appendAll(data: {
    refuels: RefuelRecord[];
    quickRecords: QuickRecord[];
    inspections: InspectionRecord[];
    shopRecords: ShopRecord[];
    odometerRecords: OdometerRecord[];
  }) {
    // d-tag (id) ベースの重複排除: 同一 id なら created_at が新しい方を採用
    function mergeById<T extends { id: string; createdAt: number }>(
      existing: T[],
      incoming: T[],
    ): T[] {
      const merged = [...existing];
      for (const item of incoming) {
        const idx = merged.findIndex((x) => x.id === item.id);
        if (idx >= 0) {
          if (item.createdAt > merged[idx].createdAt) merged[idx] = item;
        } else {
          merged.push(item);
        }
      }
      return merged.sort((a, b) =>
        (a as any).date > (b as any).date ? -1 : 1,
      );
    }

    _refuels = mergeById(_refuels, data.refuels);
    _quickRecords = mergeById(_quickRecords, data.quickRecords);
    _inspections = mergeById(_inspections, data.inspections);
    _shopRecords = mergeById(_shopRecords, data.shopRecords);
    _odometerRecords = mergeById(_odometerRecords, data.odometerRecords);
  },
};

// --- Raw Events (開発者ビュー用) ---
let _rawEvents = $state<Map<string, NostrEvent>>(new Map());

export const rawEventStore = {
  get events() {
    return _rawEvents;
  },

  set(dTag: string, event: NostrEvent) {
    _rawEvents = new Map(_rawEvents);
    _rawEvents.set(dTag, event);
  },

  get(dTag: string): NostrEvent | undefined {
    return _rawEvents.get(dTag);
  },

  getForVehicle(vehicleId: string): NostrEvent | undefined {
    return _rawEvents.get(`vehicle:${vehicleId}`);
  },

  clear() {
    _rawEvents = new Map();
  },
};

// --- Pagination (もっと読む) ---
let _hasMore = $state(false);
let _cursor = $state(0);
let _loadingMore = $state(false);

export const pagination = {
  get hasMore() {
    return _hasMore;
  },
  get cursor() {
    return _cursor;
  },
  get loadingMore() {
    return _loadingMore;
  },

  setCursor(cursor: number, hasMore: boolean) {
    _cursor = cursor;
    _hasMore = hasMore;
  },
  setLoadingMore(v: boolean) {
    _loadingMore = v;
  },
  clear() {
    _hasMore = false;
    _cursor = 0;
    _loadingMore = false;
  },
};

// --- Maintenance Alert Settings (メンテ警告閾値) ---
export interface MaintenanceThreshold {
  warnDays: number;
  dangerDays: number;
}

export type MaintenanceThresholds = Record<string, MaintenanceThreshold>;

const DEFAULT_THRESHOLDS: MaintenanceThresholds = {
  "chain-lube": { warnDays: 7, dangerDays: 14 },
  "tire-pressure": { warnDays: 14, dangerDays: 30 },
  wash: { warnDays: 14, dangerDays: 30 },
  "chain-clean": { warnDays: 14, dangerDays: 30 },
  "oil-check": { warnDays: 30, dangerDays: 60 },
  "coolant-check": { warnDays: 30, dangerDays: 90 },
  "battery-charge": { warnDays: 30, dangerDays: 60 },
};

function loadThresholds(): MaintenanceThresholds {
  try {
    const saved = localStorage.getItem("moto-log:maintenance-thresholds");
    if (saved) {
      return { ...DEFAULT_THRESHOLDS, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_THRESHOLDS };
}

let _thresholds = $state<MaintenanceThresholds>(loadThresholds());

export const maintenanceSettings = {
  get thresholds() {
    return _thresholds;
  },
  get defaults() {
    return DEFAULT_THRESHOLDS;
  },
  setThreshold(action: string, warn: number, danger: number) {
    _thresholds = {
      ..._thresholds,
      [action]: { warnDays: warn, dangerDays: danger },
    };
    try {
      localStorage.setItem(
        "moto-log:maintenance-thresholds",
        JSON.stringify(_thresholds),
      );
    } catch {
      // ignore
    }
  },
  reset() {
    _thresholds = { ...DEFAULT_THRESHOLDS };
    try {
      localStorage.removeItem("moto-log:maintenance-thresholds");
    } catch {
      // ignore
    }
  },
};
