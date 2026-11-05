#!/usr/bin/env node
/**
 * Eksporterer nyhetsbrevlista som én BCC-klar linje. Kjøres BARE lokalt, av administrator.
 * Trenger to ting ingen andre har: klientsertifikatet som slipper inn til lageret på app-serveren
 * (~/.husk/klient/macen.{key,crt}, se scripts/lager.mjs) og den private nøkkelen
 * (~/.husk/oyvind-nyhetsbrev.key).
 *
 *   npm run -s nyhetsbrev:export --                       # produksjonslista, kommaseparert → lim inn i Blindkopi
 *   npm run -s nyhetsbrev:export -- | LANG=en_US.UTF-8 pbcopy   # rett på utklippstavla (æøå riktig)
 *   npm run -s nyhetsbrev:export -- --json                # detaljer: adresse, tidspunkt, kilde, samtykkeversjon
 *   NEWSLETTER_LAGER=lokal npm run -s nyhetsbrev:export -- --env development   # testdata fra lokal utvikling
 *   npm run -s nyhetsbrev:export -- --purge --yes         # slett avmeldte og gamle duplikater fysisk fra lageret
 *
 * Adresselista går til stdout, alt annet til stderr, så `| pbcopy` bare får adressene.
 * Skriptet skriver aldri adresser til disk.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { aadFor, open, privateKeyFromB64 } from "../../src/lib/nyhetsbrev/seal.mjs";
import { aapneLager } from "../lager.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const env = opt("--env", "production");
if (!["production", "preview", "development"].includes(env)) fail("--env må være production, preview eller development.");
const prefix = `nyhetsbrev/${env}/`;

const lager = await aapneLager().catch((e) => fail(e.message));

const keyFile = process.env.NYHETSBREV_PRIVATE_KEY_FILE ?? join(homedir(), ".husk", "oyvind-nyhetsbrev.key");
let privateKey;
try {
  privateKey = privateKeyFromB64(readFileSync(keyFile, "utf8"));
} catch {
  fail(`Fant ikke en gyldig privat nøkkel i ${keyFile}. Hent backupen, eller kjør npm run nyhetsbrev:keygen hvis lista er tom.`);
}

// 1) Alle hendelser i miljøet.
const blobs = await lager.list(prefix);

// 2) Åpne hver konvolutt. En som ikke lar seg åpne rapporteres, aldri gjettes.
const events = [];
const broken = [];
for (const b of blobs) {
  try {
    const tekst = await lager.get(b.pathname);
    if (tekst === null) throw new Error("finnes ikke lenger");
    const envelope = JSON.parse(tekst);
    const rec = open(envelope, privateKey, aadFor(b.pathname));
    if (typeof rec?.email !== "string" || typeof rec?.at !== "string") throw new Error("ufullstendig post");
    events.push({ ...rec, pathname: b.pathname });
  } catch (e) {
    broken.push({ pathname: b.pathname, error: e instanceof Error ? e.message : String(e) });
  }
}

// 3) Siste hendelse per adresse avgjør. Påmeldt igjen etter avmelding = påmeldt.
events.sort((a, b) => a.at.localeCompare(b.at));
const byEmail = new Map();
for (const e of events) {
  const cur = byEmail.get(e.email) ?? { history: [] };
  cur.history.push(e);
  cur.latest = e;
  byEmail.set(e.email, cur);
}
const subscribed = [...byEmail.entries()].filter(([, v]) => v.latest.kind === "subscribe");
const unsubscribed = [...byEmail.entries()].filter(([, v]) => v.latest.kind === "unsubscribe");

if (flag("--json")) {
  console.log(
    JSON.stringify(
      {
        env,
        subscribed: subscribed.map(([email, v]) => ({
          email,
          at: v.latest.at,
          source: v.latest.source,
          consentVersion: v.latest.consentVersion ?? null,
        })),
        unsubscribedCount: unsubscribed.length,
        events: events.length,
        broken,
      },
      null,
      2,
    ),
  );
} else {
  console.error(
    `${env}: ${subscribed.length} påmeldt, ${unsubscribed.length} avmeldt, ${events.length} hendelser${broken.length ? `, ${broken.length} kunne ikke åpnes` : ""}.`,
  );
  if (subscribed.length) console.error("Lim linja under inn i Blindkopi (Bcc):\n");
  console.log(subscribed.map(([email]) => email).sort().join(", "));
}
for (const b of broken) console.error(`  kunne ikke åpne ${b.pathname}: ${b.error}`);

// 4) Opprydding: avmeldte (hele historikken) og gamle duplikater for påmeldte.
if (flag("--purge")) {
  const toDelete = [];
  for (const [, v] of byEmail) {
    if (v.latest.kind === "unsubscribe") toDelete.push(...v.history.map((h) => h.pathname));
    else toDelete.push(...v.history.filter((h) => h !== v.latest).map((h) => h.pathname));
  }
  if (toDelete.length === 0) console.error("Ingenting å rydde.");
  else if (!flag("--yes")) console.error(`Ville slettet ${toDelete.length} hendelser (avmeldte + gamle duplikater). Legg til --yes for å gjøre det.`);
  else {
    await lager.del(toDelete);
    console.error(`Slettet ${toDelete.length} hendelser.`);
  }
}
