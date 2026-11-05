#!/usr/bin/env node
/**
 * Melder en adresse av manuelt (når noen svarer «meld meg av» på et brev).
 * Skriver en forseglet avmeldingshendelse, akkurat som skjemaet gjør. Fjern den fysisk etterpå
 * med `npm run nyhetsbrev:export -- --purge --yes`.
 *
 *   npm run nyhetsbrev:remove -- navn@eksempel.no [--env production]
 *
 * Trenger klientsertifikatet til lageret (scripts/lager.mjs). Den offentlige nøkkelen står i koden
 * (src/lib/nyhetsbrev/offentlig-nokkel.mjs; NYHETSBREV_PUBLIC_KEY i miljøet overstyrer).
 */
import { randomUUID } from "node:crypto";
import { offentligNokkel } from "../../src/lib/nyhetsbrev/offentlig-nokkel.mjs";
import { aadFor, publicKeyFromB64, seal } from "../../src/lib/nyhetsbrev/seal.mjs";
import { aapneLager } from "../lager.mjs";

const args = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith("--")) ?? "").normalize("NFC").trim().toLowerCase();
const i = args.indexOf("--env");
const env = i >= 0 && args[i + 1] ? args[i + 1] : "production";
if (!email || !email.includes("@")) {
  console.error("Bruk: npm run nyhetsbrev:remove -- <e-post> [--env production|development]");
  process.exit(1);
}

const at = new Date().toISOString();
const pathname = `nyhetsbrev/${env}/${at.replace(/[:.]/g, "-")}-${randomUUID()}.json`;
const record = { kind: "unsubscribe", email, at, source: "manuelt" };
const envelope = seal(record, publicKeyFromB64(offentligNokkel()), aadFor(pathname));
await (await aapneLager()).put(pathname, JSON.stringify(envelope));
console.error(`Avmelding registrert i ${env}. Rydd fysisk med: npm run nyhetsbrev:export -- --env ${env} --purge --yes`);
