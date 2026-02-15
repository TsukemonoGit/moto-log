import type {
  Vehicle,
  RefuelRecord,
  QuickRecord,
  InspectionRecord,
  ShopRecord,
  OdometerRecord,
  AnyRecord,
  RecordType,
} from "$lib/models/types";

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
    _vehicles = [..._vehicles, vehicle];
    if (!_activeVehicleId) {
      _activeVehicleId = vehicle.id;
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
  getTimeline(
    vehicleId: string,
  ): { type: RecordType; record: AnyRecord; date: string }[] {
    const items: { type: RecordType; record: AnyRecord; date: string }[] = [];
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
};
