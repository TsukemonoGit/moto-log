import {
  createRxNostr,
  createRxBackwardReq,
  createRxForwardReq,
} from "rx-nostr";
import { verifier } from "rx-nostr-crypto";

const DEFAULT_RELAYS = [
  "wss://nostr.compile-error.net",
  "wss://nos.lol",
  "wss://relay.nostr.wirednet.jp",
];

let rxNostr: ReturnType<typeof createRxNostr> | null = null;

export function getRxNostr() {
  if (!rxNostr) {
    rxNostr = createRxNostr({ verifier });
    rxNostr.setDefaultRelays(DEFAULT_RELAYS);
  }
  return rxNostr;
}

export function getDefaultRelays(): string[] {
  return [...DEFAULT_RELAYS];
}

export { createRxBackwardReq, createRxForwardReq };
