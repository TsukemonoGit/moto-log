import {
  createRxNostr,
  createRxBackwardReq,
  createRxForwardReq,
} from "rx-nostr";
import { verifier } from "rx-nostr-crypto";

const DEFAULT_RELAYS = [
  "wss://x.kojira.io",
  "wss://nos.lol",
  "wss://relay.nostr.wirednet.jp",
];

let rxNostr: ReturnType<typeof createRxNostr> | null = null;

export function getRxNostr() {
  if (!rxNostr) {
    rxNostr = createRxNostr({
      verifier,
      authenticator: "auto",
      eoseTimeout: 10000,
    });
    rxNostr.setDefaultRelays(DEFAULT_RELAYS);
  }
  return rxNostr;
}

export function getDefaultRelays(): string[] {
  return [...DEFAULT_RELAYS];
}

export { createRxBackwardReq, createRxForwardReq };
