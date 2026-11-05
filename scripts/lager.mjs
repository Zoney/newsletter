/**
 * Lageret for skriptene (eksport, avmelding, flyttingen fra Mailchimp). Kopiert fra hannenoding-no.
 * Velges med NEWSLETTER_LAGER:
 *
 *   hetzner  (standard) app-serveren hos Hetzner, gjennom https://relay.zoney.no/newsletter/api/tjeneste/obj
 *            med klientsertifikatet ~/.husk/klient/macen.{key,crt}. Uten sertifikatet slipper ingen inn,
 *            og på newsletter.zoney.no finnes ikke ruta (husken: workshop/apper/README.md → «Server-til-server»).
 *   lokal    filer under data/lager/, det samme som `npm run dev` skriver uten DATABASE_URL.
 *   lokal-server  en app som kjører på localhost (NEWSLETTER_URL, standard http://localhost:3880),
 *            gjennom samme /api/tjeneste/obj som på serveren, med X-Klient satt for hånd. Til testing.
 *
 * Alle gir det samme: list(prefix) → [{ pathname }], get(sti) → tekst eller null, put(sti, tekst,
 * { overwrite }), del(stier).
 */
import { promises as fs, readFileSync } from "node:fs";
import https from "node:https";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RELAY = process.env.NEWSLETTER_RELAY ?? "relay.zoney.no";
const KLIENT = process.env.NEWSLETTER_KLIENT ?? "macen";
const LOKAL = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "lager");

function tjeneste(metode, query, kropp) {
  const dir = path.join(homedir(), ".husk", "klient");
  const [key, cert] = ["key", "crt"].map((x) => readFileSync(path.join(dir, `${KLIENT}.${x}`)));
  const body = kropp === undefined ? undefined : Buffer.from(kropp, "utf8");
  return new Promise((ok, feil) => {
    const req = https.request(
      {
        host: RELAY,
        method: metode,
        path: `/newsletter/api/tjeneste/obj?${new URLSearchParams(query)}`,
        key,
        cert,
        timeout: 20_000,
        headers: body ? { "content-type": "application/octet-stream", "content-length": body.length } : {},
      },
      (res) => {
        const biter = [];
        res.on("data", (d) => biter.push(d));
        res.on("end", () => ok({ status: res.statusCode, tekst: Buffer.concat(biter).toString("utf8") }));
      },
    );
    req.on("timeout", () => req.destroy(new Error(`tidsavbrudd mot ${RELAY}`)));
    req.on("error", feil);
    if (body) req.write(body);
    req.end();
  });
}

function hetzner() {
  const sjekk = (r, hva) => {
    if (r.status >= 300) throw new Error(`${hva}: ${r.status} ${r.tekst.slice(0, 200)}`);
    return r;
  };
  return {
    navn: "app-serveren hos Hetzner",
    async list(prefix) {
      return JSON.parse(sjekk(await tjeneste("GET", { prefix }), `list ${prefix}`).tekst);
    },
    async get(sti) {
      const r = await tjeneste("GET", { path: sti });
      return r.status === 404 ? null : sjekk(r, `get ${sti}`).tekst;
    },
    async put(sti, tekst, { overwrite = false } = {}) {
      sjekk(await tjeneste("PUT", { path: sti, ...(overwrite ? { overwrite: "1" } : {}) }, tekst), `put ${sti}`);
    },
    async del(stier) {
      for (const sti of [stier].flat()) sjekk(await tjeneste("DELETE", { path: sti }), `del ${sti}`);
    },
  };
}

function lokal() {
  return {
    navn: "lokalt (data/lager)",
    async list(prefix) {
      const ut = [];
      async function gaa(d) {
        let es;
        try {
          es = await fs.readdir(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of es) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) await gaa(p);
          else ut.push({ pathname: path.relative(LOKAL, p).split(path.sep).join("/") });
        }
      }
      await gaa(LOKAL);
      return ut.filter((o) => o.pathname.startsWith(prefix)).sort((a, b) => a.pathname.localeCompare(b.pathname));
    },
    async get(sti) {
      try {
        return await fs.readFile(path.join(LOKAL, sti), "utf8");
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async put(sti, tekst, { overwrite = false } = {}) {
      const p = path.join(LOKAL, sti);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, tekst, { flag: overwrite ? "w" : "wx" });
    },
    async del(stier) {
      for (const sti of [stier].flat()) await fs.rm(path.join(LOKAL, sti), { force: true });
    },
  };
}

// Lokalt finnes ingen Caddy, så X-Klient settes her; på serveren setter bare Caddy den.
function lokalServer() {
  const url = (process.env.NEWSLETTER_URL ?? "http://localhost:3880").replace(/\/+$/, "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("lokal-server går bare mot localhost");
  const kall = async (metode, query, kropp) => {
    const r = await fetch(`${url}/api/tjeneste/obj?${new URLSearchParams(query)}`, {
      method: metode,
      headers: { "x-klient": "CN=macen", ...(kropp === undefined ? {} : { "content-type": "application/octet-stream" }) },
      body: kropp,
    });
    return { status: r.status, tekst: await r.text() };
  };
  const sjekk = (r, hva) => {
    if (r.status >= 300) throw new Error(`${hva}: ${r.status} ${r.tekst.slice(0, 200)}`);
    return r;
  };
  return {
    navn: `lokal app (${url})`,
    async list(prefix) {
      return JSON.parse(sjekk(await kall("GET", { prefix }), `list ${prefix}`).tekst);
    },
    async get(sti) {
      const r = await kall("GET", { path: sti });
      return r.status === 404 ? null : sjekk(r, `get ${sti}`).tekst;
    },
    async put(sti, tekst, { overwrite = false } = {}) {
      sjekk(await kall("PUT", { path: sti, ...(overwrite ? { overwrite: "1" } : {}) }, tekst), `put ${sti}`);
    },
    async del(stier) {
      for (const sti of [stier].flat()) sjekk(await kall("DELETE", { path: sti }), `del ${sti}`);
    },
  };
}

/** Lageret NEWSLETTER_LAGER peker på (eller det som er nevnt). */
export async function aapneLager(valg = process.env.NEWSLETTER_LAGER ?? "hetzner") {
  if (valg === "hetzner") return hetzner();
  if (valg === "lokal") return lokal();
  if (valg === "lokal-server") return lokalServer();
  throw new Error(`Ukjent lager: ${valg} (hetzner, lokal eller lokal-server)`);
}
