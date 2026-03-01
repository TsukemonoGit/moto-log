import { getRxNostr } from "./client";
import type { EventTemplate } from "nostr-tools";
import { rawEventStore } from "$lib/stores/app.svelte";
import { APP_LABEL } from "$lib/constants";

/**
 * kind 30078 のイベントを構築して publish する
 */
export async function publishEvent(
  dTag: string,
  labelTag: string,
  content: Record<string, unknown>,
): Promise<void> {
  const nostr = (window as any).nostr;
  if (!nostr) {
    throw new Error("Nostr signer not available. Please login first.");
  }

  const event: EventTemplate = {
    kind: 30078,
    content: JSON.stringify(content),
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["d", dTag],
      ["L", APP_LABEL],
      ["l", labelTag, APP_LABEL],
    ],
  };

  const signed = await nostr.signEvent(event);
  const rxNostr = getRxNostr();

  // 少なくとも 1 つのリレーから OK を待つ (10秒タイムアウト)
  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const sub = rxNostr.send(signed).subscribe({
      next: (result) => {
        if (!resolved && result.ok) {
          resolved = true;
          sub.unsubscribe();
          resolve();
        }
      },
      complete: () => {
        if (!resolved) {
          resolved = true;
          // 全リレー応答済みだが OK なし → それでも resolve (fire-and-forget 的)
          resolve();
        }
      },
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        sub.unsubscribe();
        resolve(); // タイムアウトでも reject しない (UX 重視)
      }
    }, 10_000);
  });
}

/**
 * kind 5 (NIP-09) でイベントを削除する
 * rawEventStore から event ID を自動取得し、e タグを必ず含める
 */
export async function deleteEvent(dTag: string): Promise<void> {
  const nostr = (window as any).nostr;
  if (!nostr) throw new Error("Nostr signer not available.");

  const rawEvent = rawEventStore.get(dTag);
  const tags: string[][] = [
    ["a", `30078:${await nostr.getPublicKey()}:${dTag}`],
  ];
  if (rawEvent) {
    tags.unshift(["e", rawEvent.id]);
  }

  const event: EventTemplate = {
    kind: 5,
    content: "deleted",
    created_at: Math.floor(Date.now() / 1000),
    tags,
  };

  const signed = await nostr.signEvent(event);
  const rxNostr = getRxNostr();

  await new Promise<void>((resolve) => {
    let resolved = false;
    const sub = rxNostr.send(signed).subscribe({
      next: (result) => {
        if (!resolved && result.ok) {
          resolved = true;
          sub.unsubscribe();
          resolve();
        }
      },
      complete: () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      },
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        sub.unsubscribe();
        resolve();
      }
    }, 10_000);
  });
}
