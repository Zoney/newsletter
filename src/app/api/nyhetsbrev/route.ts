import { CONSENT, STATUSES, type Status } from "@/content/nyhetsbrev";
import { isConfigured, isValidEmail, normalizeEmail, storeRecord, type Action } from "@/lib/nyhetsbrev/records";
import { serUtSomMenneske } from "@/lib/menneske";

/*
 * Den eneste skrivbare ruta på hele sida, og den kan bare skrive (kopiert fra hannenoding-no).
 *
 * Sjekker, i rekkefølge: metode → samme opphav (Origin/Referer = Host) → størrelse →
 * innholdstype → honningfelle (skjult felt bots fyller ut; da later vi som alt gikk bra) →
 * menneskesjekk (lib/menneske.ts: skjemaet sendt med JavaScript, etter minst to sekunder) →
 * hastighetsbrems per IP → adresse → samtykke → lagring som forseglet konvolutt.
 * Svaret sier aldri om en adresse fantes fra før, og ingenting om hvor det ble lagret.
 * Loggen får aldri e-postadresser.
 *
 * Med JavaScript sendes JSON og svaret vises på stedet. En vanlig form-post (uten JavaScript)
 * gir 303 tilbake til / eller /meld-av med status i adressen, men mangler menneskesjekken og
 * avvises derfor som «robot». Det er med vilje: bedre å be leseren laste sida på nytt enn å
 * ha en dør roboter kan bruke.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP_PER_WINDOW = 6;
const MAX_GLOBAL_PER_MINUTE = 120;

// Brems i minnet. Sida er én prosess på app-serveren, og Caddy har sin egen grense per IP foran.
const perIp = new Map<string, number[]>();
let global: number[] = [];

function rateLimited(ip: string): boolean {
  const now = Date.now();
  global = global.filter((t) => now - t < 60 * 1000);
  if (global.length >= MAX_GLOBAL_PER_MINUTE) return true;
  const mine = (perIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (mine.length >= MAX_PER_IP_PER_WINDOW) return true;
  mine.push(now);
  perIp.set(ip, mine);
  global.push(now);
  if (perIp.size > 5000) perIp.clear();
  return false;
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "ukjent").trim();
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Parsed = { action: Action; email: string; consent: boolean; website: string; source: string };

function pick(get: (k: string) => unknown): Parsed {
  const s = (k: string) => {
    const v = get(k);
    return typeof v === "string" ? v.slice(0, 300) : "";
  };
  const c = get("consent");
  return {
    action: s("action") === "unsubscribe" ? "unsubscribe" : "subscribe",
    email: s("email"),
    consent: c === true || c === "yes" || c === "on",
    website: s("website"),
    source: s("source").startsWith("/") ? s("source").slice(0, 80) : "/",
  };
}

async function parseBody(req: Request, isForm: boolean): Promise<Parsed | null> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    if (isForm) {
      const p = new URLSearchParams(text);
      return pick((k) => p.get(k) ?? undefined);
    }
    const j = JSON.parse(text) as Record<string, unknown>;
    if (!j || typeof j !== "object") return null;
    return pick((k) => j[k]);
  } catch {
    return null;
  }
}

function reply(status: Status, code: number, isForm: boolean, action: Action, req: Request): Response {
  const headers = { "Cache-Control": "no-store" };
  if (!isForm) {
    return Response.json({ ok: code < 400, status }, { status: code, headers });
  }
  // Uten JavaScript: tilbake til skjemaet med status i adressen. Aldri e-posten.
  const to = new URL(req.url);
  to.pathname = action === "unsubscribe" ? "/meld-av" : "/";
  to.search = `?nyhetsbrev=${status}&skjema=${action}`;
  to.hash = "status";
  return Response.redirect(to.toString(), 303);
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const isForm = contentType.includes("application/x-www-form-urlencoded");
  const isJson = contentType.includes("application/json");
  if (!isForm && !isJson) return reply("feil", 415, false, "subscribe", req);
  if (!sameOrigin(req)) return reply("feil", 403, isForm, "subscribe", req);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return reply("feil", 413, isForm, "subscribe", req);

  const parsed = await parseBody(req, isForm);
  if (!parsed) return reply("feil", 400, isForm, "subscribe", req);
  const { action } = parsed;

  // Honningfelle: mennesker ser ikke feltet. Fylt ut = bot. Lat som alt gikk bra, lagre ingenting.
  if (parsed.website) return reply(action === "unsubscribe" ? "av" : "ok", 200, isForm, action, req);

  // Uten menneskesjekk (JavaScript-skjemaet, minst to sekunder åpent) regnes det som en robot.
  // Før bremsen, så roboter ikke bruker opp kvoten til folk som deler IP med dem.
  if (!serUtSomMenneske(req)) return reply("robot", 403, isForm, action, req);

  if (rateLimited(clientIp(req))) return reply("for-mange", 429, isForm, action, req);

  const email = normalizeEmail(parsed.email);
  if (!isValidEmail(email)) return reply("ugyldig", 400, isForm, action, req);
  if (action === "subscribe" && !parsed.consent) return reply("samtykke", 400, isForm, action, req);

  if (!isConfigured()) {
    console.error("nyhetsbrev: DATABASE_URL mangler");
    return reply("feil", 503, isForm, action, req);
  }

  try {
    await storeRecord({
      kind: action,
      email,
      at: new Date().toISOString(),
      source: parsed.source,
      ...(action === "subscribe" ? { consentVersion: CONSENT.version } : {}),
    });
  } catch (e) {
    console.error("nyhetsbrev: lagring feilet:", e instanceof Error ? e.message : "ukjent feil");
    return reply("feil", 500, isForm, action, req);
  }

  return reply(action === "unsubscribe" ? "av" : "ok", 200, isForm, action, req);
}

export function GET() {
  return new Response("Bare POST.", { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}

// Sikring mot skrivefeil i statusnavn andre steder: alle må finnes i MESSAGES.
void STATUSES;
