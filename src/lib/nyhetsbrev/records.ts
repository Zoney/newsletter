import { randomUUID } from "node:crypto";
import { lagerKonfigurert, lagre } from "@/lib/lager";
import { offentligNokkel } from "./offentlig-nokkel.mjs";
import { aadFor, publicKeyFromB64, seal } from "./seal.mjs";

/*
 * Det som lagres per påmelding/avmelding, og hvordan (samme modell som hannenoding-no, AGENTS.md §12).
 *
 *  - Hver hendelse er ett eget objekt i lageret (lib/lager.ts): `nyhetsbrev/<miljø>/<tidsstempel>-<uuid>.json`.
 *    Ingen fil som må leses og skrives om (ingen kappløp), og stien avslører ingenting.
 *  - Innholdet er en forseglet konvolutt (seal.mjs). Nettsiden kan skrive, aldri lese.
 *  - Avmelding er også en hendelse. Eksportskriptet tar siste hendelse per adresse.
 *  - Miljøet i stien skiller test (development) fra ekte (production).
 */

export type Action = "subscribe" | "unsubscribe";

export type NyhetsbrevRecord = {
  kind: Action;
  email: string;
  /** ISO-tidspunkt for hendelsen. */
  at: string;
  /** Hvor hendelsen kom fra: sida skjemaet sto på ("/", "/meld-av"), "manuelt" eller "mailchimp". */
  source: string;
  /** Versjonen av samtykketeksten som ble krysset av (kun ved påmelding). */
  consentVersion?: string;
};

export const NYHETSBREV_ENV = process.env.NEWSLETTER_MILJO ?? "development";
export const NYHETSBREV_PREFIX = `nyhetsbrev/${NYHETSBREV_ENV}/`;

export function normalizeEmail(raw: string): string {
  return raw.normalize("NFC").trim().toLowerCase();
}

/** Streng nok til å stoppe tull, romslig nok for ekte adresser. */
export function isValidEmail(email: string): boolean {
  if (email.length < 6 || email.length > 254) return false;
  if (/[\s<>()[\]\\,;:"]/.test(email)) return false;
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64) return false;
  if (!/^[a-z0-9æøå.\-]+(\.[a-z0-9æøå\-]+)+$/i.test(domain)) return false;
  if (domain.includes("..") || domain.startsWith("-") || domain.endsWith("-")) return false;
  return true;
}

export function isConfigured(): boolean {
  return Boolean(offentligNokkel()) && lagerKonfigurert();
}

/** Forsegler og lagrer én hendelse. Returnerer ingenting, med vilje: stien skal ikke ut. */
export async function storeRecord(record: NyhetsbrevRecord): Promise<void> {
  const publicKey = publicKeyFromB64(offentligNokkel());
  const stamp = record.at.replace(/[:.]/g, "-");
  const pathname = `${NYHETSBREV_PREFIX}${stamp}-${randomUUID()}.json`;
  const envelope = seal(record, publicKey, aadFor(pathname));
  await lagre(pathname, JSON.stringify(envelope));
}
