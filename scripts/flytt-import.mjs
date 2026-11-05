#!/usr/bin/env node
/**
 * Flyttingen fra Mailchimp (november 2026). Kjøres på Macen, én gang (men trygt å kjøre igjen).
 *
 * Leser medlemmene fra Mailchimp-uttrekket og legger hver påmeldte adresse inn i lista på
 * app-serveren som en forseglet påmeldingshendelse, akkurat som skjemaet gjør. Bare status
 * «subscribed» tas med; avmeldte, «cleaned» og «pending» hoppes over (og telles).
 *
 * Kilde, én av:
 *   standard        ~/.husk/flytting/newsletter/mailchimp-medlemmer.json (hentet med Mailchimp-API-et:
 *                   { medlemmer: [{ email_address, status, timestamp_opt, timestamp_signup, last_changed }] })
 *   --csv <fil>     eksporten fra Mailchimp (Audience → Export audience). Fila for påmeldte
 *                   (subscribed_members_export_….csv) har kolonnene «Email Address», «OPTIN_TIME»,
 *                   «CONFIRM_TIME». Uten statuskolonne regnes alle rader i fila som påmeldt.
 *
 * Mål (lageret, scripts/lager.mjs):
 *   standard        app-serveren, via https://relay.zoney.no/newsletter/… med klientsertifikatet
 *                   ~/.husk/klient/macen.{key,crt}
 *   NEWSLETTER_LAGER=lokal   data/lager/ (det `npm run dev` uten database skriver)
 *   --env <miljø>   production (standard) eller development
 *   --tørt          vis bare antall, send ingenting
 *
 * Idempotent: stien til hver konvolutt er laget av påmeldingstidspunktet og en HMAC av adressen med
 * den private nøkkelen (~/.husk/oyvind-nyhetsbrev.key), så samme adresse får samme sti hver gang.
 * Serveren svarer 409 på en sti som finnes, og da hoppes den over. Bare den som har den private
 * nøkkelen, kan regne ut stien fra en adresse. Ligger det allerede påmeldinger fra Mailchimp i
 * lista, nekter skriptet uten --fortsett (se vernet under).
 *
 * Skriver bare antall til terminalen, aldri adresser.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { offentligNokkel } from "../src/lib/nyhetsbrev/offentlig-nokkel.mjs";
import { aadFor, privateKeyFromB64, publicKeyB64FromPrivate, publicKeyFromB64, seal } from "../src/lib/nyhetsbrev/seal.mjs";
import { aapneLager } from "./lager.mjs";

const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const tort = args.includes("--tørt") || args.includes("--tort");
const env = opt("--env") ?? "production";
if (!["production", "development"].includes(env)) fail("--env må være production eller development.");

// ---------- nøklene ----------
const keyFile = process.env.NYHETSBREV_PRIVATE_KEY_FILE ?? join(homedir(), ".husk", "oyvind-nyhetsbrev.key");
let privateKey;
try {
  privateKey = privateKeyFromB64(readFileSync(keyFile, "utf8"));
} catch {
  fail(`Fant ikke en gyldig privat nøkkel i ${keyFile}.`);
}
const publicKeyB64 = offentligNokkel();
if (publicKeyB64FromPrivate(privateKey) !== publicKeyB64.trim()) {
  fail("Den private nøkkelen hører ikke til den offentlige nøkkelen i koden. Ingenting sendt.");
}
const publicKey = publicKeyFromB64(publicKeyB64);
const hmacKey = privateKey.export({ type: "pkcs8", format: "der" });

// ---------- kilden ----------
const normal = (e) => String(e ?? "").normalize("NFC").trim().toLowerCase();

/** Enkel CSV-leser (anførselstegn, komma og linjeskift i felt). */
function lesCsv(tekst) {
  const rader = [];
  let rad = [], felt = "", i = 0, iAnf = false;
  tekst = tekst.replace(/^﻿/, "");
  while (i < tekst.length) {
    const c = tekst[i];
    if (iAnf) {
      if (c === '"' && tekst[i + 1] === '"') { felt += '"'; i += 2; continue; }
      if (c === '"') { iAnf = false; i++; continue; }
      felt += c; i++; continue;
    }
    if (c === '"') { iAnf = true; i++; continue; }
    if (c === ",") { rad.push(felt); felt = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { rad.push(felt); rader.push(rad); rad = []; felt = ""; i++; continue; }
    felt += c; i++;
  }
  if (felt || rad.length) { rad.push(felt); rader.push(rad); }
  return rader.filter((r) => r.some((f) => f.trim()));
}

/** «2023-12-30 12:34:56» (Mailchimp-eksporten, UTC) eller ISO → ISO, ellers null. */
function tid(v) {
  if (!v) return null;
  const s = String(v).trim().replace(" ", "T");
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

let medlemmer;
const csv = opt("--csv");
if (csv) {
  const rader = lesCsv(readFileSync(csv, "utf8"));
  const hode = rader.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const kol = (...navn) => navn.map((n) => hode.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iEpost = kol("email address", "e-mail address", "email");
  const iStatus = kol("status", "member_rating_status");
  const iTid = [kol("confirm_time"), kol("optin_time"), kol("last_changed")];
  if (iEpost < 0) fail("Fant ikke kolonnen «Email Address» i CSV-fila.");
  medlemmer = rader.map((r) => ({
    email: normal(r[iEpost]),
    status: iStatus >= 0 ? r[iStatus].trim().toLowerCase() : "subscribed",
    at: iTid.map((i) => (i >= 0 ? tid(r[i]) : null)).find(Boolean) ?? null,
  }));
} else {
  const fil = opt("--json") ?? join(homedir(), ".husk", "flytting", "newsletter", "mailchimp-medlemmer.json");
  const data = JSON.parse(readFileSync(fil, "utf8"));
  medlemmer = (data.medlemmer ?? data.members ?? []).map((m) => ({
    email: normal(m.email_address),
    status: String(m.status ?? "").toLowerCase(),
    at: tid(m.timestamp_opt) ?? tid(m.timestamp_signup) ?? tid(m.last_changed),
  }));
}

const perStatus = {};
for (const m of medlemmer) perStatus[m.status] = (perStatus[m.status] ?? 0) + 1;
const unike = new Map();
let ugyldige = 0;
for (const m of medlemmer) {
  if (m.status !== "subscribed") continue;
  if (!m.email.includes("@") || m.email.length > 254) { ugyldige++; continue; }
  const før = unike.get(m.email);
  if (!før || (m.at && (!før.at || m.at < før.at))) unike.set(m.email, m);
}
console.error(`Kilde: ${medlemmer.length} medlemmer ${JSON.stringify(perStatus)}; ${unike.size} unike påmeldte tas med${ugyldige ? `, ${ugyldige} uten gyldig adresse hoppet over` : ""}.`);

// ---------- sending ----------
const lager = await aapneLager().catch((e) => fail(e.message));
// Vern: etter `nyhetsbrev:export --purge` er avmeldte borte sammen med konvolutten fra importen. En ny
// kjøring da ville meldt dem på igjen. Ligger det allerede noe fra Mailchimp i lista, kjøres importen
// bare med --fortsett (for å fullføre en kjøring som stoppet underveis).
const fraFør = (await lager.list(`nyhetsbrev/${env}/`)).filter((o) => o.pathname.includes("-mc-")).length;
if (fraFør > 0 && !args.includes("--fortsett")) {
  fail(
    `Importen er kjørt før: ${fraFør} påmeldinger fra Mailchimp ligger i ${lager.navn} (${env}). En ny kjøring etter en ` +
      "opprydding kan melde på igjen folk som har meldt seg av. Bruk --fortsett bare for å fullføre en kjøring som stoppet.",
  );
}
const nå = new Date().toISOString();
let lagt = 0, fantes = 0, feil = 0;
for (const m of unike.values()) {
  const at = m.at ?? nå;
  const id = createHmac("sha256", hmacKey).update(`mailchimp|${m.email}`).digest("hex").slice(0, 32);
  const pathname = `nyhetsbrev/${env}/${at.replace(/[:.]/g, "-")}-mc-${id}.json`;
  if (tort) { lagt++; continue; }
  const record = { kind: "subscribe", email: m.email, at, source: "mailchimp", consentVersion: "mailchimp" };
  try {
    await lager.put(pathname, JSON.stringify(seal(record, publicKey, aadFor(pathname))));
    lagt++;
  } catch (e) {
    if (/\b409\b|EEXIST/.test(String(e?.message ?? e?.code))) fantes++;
    else { feil++; console.error(`  feil: ${String(e?.message ?? e).replace(/[^\s]+@[^\s]+/g, "<adresse>").slice(0, 200)}`); }
  }
}
console.error(
  tort
    ? `Tørt: ville lagt ${lagt} påmeldinger i ${lager.navn} (${env}). Ingenting sendt.`
    : `${lager.navn} (${env}): ${lagt} lagt inn, ${fantes} fantes fra før, ${feil} feilet.`,
);
process.exit(feil ? 1 : 0);
