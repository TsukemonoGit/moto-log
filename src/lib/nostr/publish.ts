import { getRxNostr } from "./client";
import type { EventTemplate } from "nostr-tools";

const APP_LABEL = "nostr-moto-log";

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
  rxNostr.send(signed);
}

/**
 * kind 5 (NIP-09) でイベントを削除する
 */
export async function deleteEvent(
  eventId: string,
  dTag: string,
): Promise<void> {
  const nostr = (window as any).nostr;
  if (!nostr) throw new Error("Nostr signer not available.");

  const event: EventTemplate = {
    kind: 5,
    content: "deleted",
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["e", eventId],
      ["a", `30078:${await nostr.getPublicKey()}:${dTag}`],
    ],
  };

  const signed = await nostr.signEvent(event);
  const rxNostr = getRxNostr();
  rxNostr.send(signed);
}
