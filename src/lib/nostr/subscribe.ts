import { getRxNostr, createRxBackwardReq } from "./client";
import type {
  Vehicle,
  RefuelRecord,
  QuickRecord,
  InspectionRecord,
  ShopRecord,
  OdometerRecord,
} from "$lib/models/types";
import { uniq } from "rx-nostr";

const APP_LABEL = "nostr-moto-log";

export interface LoadedData {
  vehicles: Vehicle[];
  refuels: RefuelRecord[];
  quickRecords: QuickRecord[];
  inspections: InspectionRecord[];
  shopRecords: ShopRecord[];
  odometerRecords: OdometerRecord[];
}

/**
 * ログインユーザーの全データを一括取得する
 */
export function loadAllData(pubkey: string): Promise<LoadedData> {
  return new Promise((resolve) => {
    const data: LoadedData = {
      vehicles: [],
      refuels: [],
      quickRecords: [],
      inspections: [],
      shopRecords: [],
      odometerRecords: [],
    };

    const rxNostr = getRxNostr();
    const req = createRxBackwardReq();

    // タイムアウト: 15秒以内にリレーから応答がなければ取得済みデータで resolve
    const timeout = setTimeout(() => {
      console.warn(
        "loadAllData: timeout after 15s, resolving with partial data",
      );
      subscription.unsubscribe();
      finalize();
    }, 15_000);

    function finalize() {
      clearTimeout(timeout);
      // 日付順でソート
      data.refuels.sort((a, b) => (a.date > b.date ? -1 : 1));
      data.quickRecords.sort((a, b) => (a.date > b.date ? -1 : 1));
      data.inspections.sort((a, b) => (a.date > b.date ? -1 : 1));
      data.shopRecords.sort((a, b) => (a.date > b.date ? -1 : 1));
      data.odometerRecords.sort((a, b) => (a.date > b.date ? -1 : 1));
      resolve(data);
    }

    const subscription = rxNostr
      .use(req)
      .pipe(uniq())
      .subscribe({
        next: (packet) => {
          const event = packet.event;
          const dTag = event.tags.find((t) => t[0] === "d")?.[1] || "";
          const labelTag =
            event.tags.find((t) => t[0] === "l" && t[2] === APP_LABEL)?.[1] ||
            "";

          try {
            const content = JSON.parse(event.content);

            if (labelTag === "vehicle" || dTag.startsWith("vehicle:")) {
              data.vehicles.push({
                id: dTag.replace("vehicle:", ""),
                ...content,
              });
            } else if (labelTag === "refuel" || dTag.startsWith("refuel:")) {
              data.refuels.push({
                id: dTag,
                createdAt: event.created_at,
                ...content,
              });
            } else if (labelTag === "quick" || dTag.startsWith("quick:")) {
              data.quickRecords.push({
                id: dTag,
                createdAt: event.created_at,
                ...content,
              });
            } else if (
              labelTag === "inspection" ||
              dTag.startsWith("inspection:")
            ) {
              data.inspections.push({
                id: dTag,
                createdAt: event.created_at,
                ...content,
              });
            } else if (labelTag === "shop" || dTag.startsWith("shop:")) {
              data.shopRecords.push({
                id: dTag,
                createdAt: event.created_at,
                ...content,
              });
            } else if (
              labelTag === "odometer" ||
              dTag.startsWith("odometer:")
            ) {
              data.odometerRecords.push({
                id: dTag,
                createdAt: event.created_at,
                ...content,
              });
            }
          } catch {
            console.warn("Failed to parse event content:", event.id);
          }
        },
        complete: () => {
          subscription.unsubscribe();
          finalize();
        },
      });

    req.emit({
      kinds: [30078],
      authors: [pubkey],
      "#L": [APP_LABEL],
    });
    req.over();
  });
}
