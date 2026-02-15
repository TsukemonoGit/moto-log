import { getRxNostr, createRxBackwardReq } from "./client";
import type {
  Vehicle,
  RefuelRecord,
  QuickRecord,
  InspectionRecord,
  ShopRecord,
  OdometerRecord,
} from "$lib/models/types";
import type { NostrEvent } from "nostr-tools";
import { uniq } from "rx-nostr";
import { rawEventStore } from "$lib/stores/app.svelte";

const APP_LABEL = "nostr-moto-log";
const BATCH_SIZE = 200;

export interface LoadedData {
  vehicles: Vehicle[];
  refuels: RefuelRecord[];
  quickRecords: QuickRecord[];
  inspections: InspectionRecord[];
  shopRecords: ShopRecord[];
  odometerRecords: OdometerRecord[];
}

export interface LoadResult extends LoadedData {
  hasMore: boolean;
  cursor: number; // 次回取得用の until 値 (最古の created_at)
}

interface BatchResult {
  events: NostrEvent[];
  oldestCreatedAt: number;
}

/**
 * 単一バッチを取得する (until + limit)
 */
function fetchBatch(pubkey: string, until: number): Promise<BatchResult> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];

    const rxNostr = getRxNostr();
    const req = createRxBackwardReq();

    const timeout = setTimeout(() => {
      req.over();
    }, 10_000);

    const sub = rxNostr
      .use(req)
      .pipe(uniq())
      .subscribe({
        next: (packet) => {
          const event = packet.event as NostrEvent;
          events.push(event);
        },
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe();

          // 複数リレーから合計 BATCH_SIZE 超のイベントが返る場合、
          // 新しい順に BATCH_SIZE 件だけ残す。
          // 超過分を捨てないとリレー間の返却範囲ズレで歯抜けが起きる。
          if (events.length > BATCH_SIZE) {
            events.sort((a, b) => b.created_at - a.created_at);
            events.length = BATCH_SIZE; // 古い側を切り捨て
          }

          const trimmedOldest =
            events.length > 0
              ? Math.min(...events.map((e) => e.created_at))
              : until;

          resolve({ events, oldestCreatedAt: trimmedOldest });
        },
      });

    req.emit({
      kinds: [30078],
      authors: [pubkey],
      "#L": [APP_LABEL],
      limit: BATCH_SIZE,
      until,
    });
    req.over();
  });
}

/**
 * イベント配列をパースして LoadedData に振り分ける
 */
function parseEvents(events: NostrEvent[]): LoadedData {
  const data: LoadedData = {
    vehicles: [],
    refuels: [],
    quickRecords: [],
    inspections: [],
    shopRecords: [],
    odometerRecords: [],
  };

  for (const event of events) {
    const dTag = event.tags.find((t) => t[0] === "d")?.[1] || "";
    const labelTag =
      event.tags.find((t) => t[0] === "l" && t[2] === APP_LABEL)?.[1] || "";

    // 生イベントを保持（開発者ビュー用）
    rawEventStore.set(dTag, event);

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
      } else if (labelTag === "inspection" || dTag.startsWith("inspection:")) {
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
      } else if (labelTag === "odometer" || dTag.startsWith("odometer:")) {
        data.odometerRecords.push({
          id: dTag,
          createdAt: event.created_at,
          ...content,
        });
      }
    } catch {
      console.warn("Failed to parse event content:", event.id);
    }
  }

  return data;
}

function sortData(data: LoadedData): void {
  data.refuels.sort((a, b) => (a.date > b.date ? -1 : 1));
  data.quickRecords.sort((a, b) => (a.date > b.date ? -1 : 1));
  data.inspections.sort((a, b) => (a.date > b.date ? -1 : 1));
  data.shopRecords.sort((a, b) => (a.date > b.date ? -1 : 1));
  data.odometerRecords.sort((a, b) => (a.date > b.date ? -1 : 1));
}

/**
 * ログインユーザーの最新データを取得する (初回ロード)
 */
export async function loadAllData(pubkey: string): Promise<LoadResult> {
  const until = Math.floor(Date.now() / 1000) + 1;
  const { events, oldestCreatedAt } = await fetchBatch(pubkey, until);
  const data = parseEvents(events);
  sortData(data);

  return {
    ...data,
    hasMore: events.length >= BATCH_SIZE,
    cursor: oldestCreatedAt,
  };
}

/**
 * 追加データを取得する (もっと読む)
 */
export async function loadMoreData(
  pubkey: string,
  cursor: number,
): Promise<LoadResult> {
  const { events, oldestCreatedAt } = await fetchBatch(pubkey, cursor);
  const data = parseEvents(events);
  sortData(data);

  return {
    ...data,
    hasMore: events.length >= BATCH_SIZE,
    cursor: oldestCreatedAt,
  };
}

/**
 * リレーから生イベントを再取得する（開発者ビュー用）
 * ストアの更新は行わず、取得結果をそのまま返す
 */
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
          events.push(packet.event as NostrEvent);
        },
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe();
          resolve(events);
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
