import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/*
 * Lageret for nyhetsbrevet: små objekter med en sti som nøkkel (nyhetsbrev/<miljø>/…). Kopiert fra
 * hannenoding-no (lib/lager.ts). Stien er også de
 * autentiserte tilleggsdataene i konvolutten (src/lib/nyhetsbrev/seal.mjs), så en kopiert konvolutt
 * kan bare åpnes under samme sti.
 *
 *  - På app-serveren hos Hetzner: én tabell, objekt, i Postgres over unix-socket (DATABASE_URL,
 *    se husken: workshop/apper/README.md). Production bruker skjemaet «app», alt annet «dev».
 *  - Lokalt uten DATABASE_URL: filer under data/lager/ (gitignored).
 *
 * Nettsida skriver bare nye konvolutter. Skriptene i scripts/ når resten
 * gjennom /api/tjeneste/obj, som bare svarer med klientsertifikat (src/lib/tjeneste.ts).
 */

const SKJEMA = process.env.NEWSLETTER_MILJO === "production" ? "app" : "dev";
const OBJEKT = `${SKJEMA}.objekt`;
const LOKAL = path.join(process.cwd(), "data", "lager");

export function lagerKonfigurert(): boolean {
  return Boolean(process.env.DATABASE_URL) || process.env.NODE_ENV !== "production";
}

let pool: Pool | null = null;
let klar: Promise<Pool> | null = null;
function db(): Promise<Pool> {
  klar ??= (async () => {
    // Ingen feil uten DATABASE_URL før noen faktisk spør: modulen lastes også under bygging.
    pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    await pool.query(`create schema if not exists ${SKJEMA}`);
    await pool.query(`create table if not exists ${OBJEKT} (
      sti text primary key,
      data bytea not null,
      opprettet timestamptz not null default now())`);
    return pool;
  })().catch((e) => {
    klar = null;
    throw e;
  });
  return klar;
}

const brukDb = () => Boolean(process.env.DATABASE_URL);

/** Skriver et objekt. Uten «overskriv» feiler det hvis stien finnes . */
export async function lagre(sti: string, data: Buffer | string, { overskriv = false } = {}): Promise<void> {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  if (brukDb()) {
    const sql = overskriv
      ? `insert into ${OBJEKT} (sti, data) values ($1, $2) on conflict (sti) do update set data = excluded.data, opprettet = now()`
      : `insert into ${OBJEKT} (sti, data) values ($1, $2)`;
    await (await db()).query(sql, [sti, buf]);
    return;
  }
  const p = path.join(LOKAL, sti);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf, { flag: overskriv ? "w" : "wx" });
}

export async function hent(sti: string): Promise<Buffer | null> {
  if (brukDb()) {
    const { rows } = await (await db()).query<{ data: Buffer }>(`select data from ${OBJEKT} where sti = $1`, [sti]);
    return rows[0]?.data ?? null;
  }
  try {
    return await fs.readFile(path.join(LOKAL, sti));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function slett(sti: string): Promise<void> {
  if (brukDb()) {
    await (await db()).query(`delete from ${OBJEKT} where sti = $1`, [sti]);
    return;
  }
  await fs.rm(path.join(LOKAL, sti), { force: true });
}

export type ObjInfo = { pathname: string; size: number; uploadedAt: string };

export async function liste(prefiks: string): Promise<ObjInfo[]> {
  if (brukDb()) {
    // starts_with i stedet for LIKE, så _ og % i prefikset ikke blir jokertegn
    const { rows } = await (await db()).query<{ sti: string; storrelse: number; opprettet: Date }>(
      `select sti, octet_length(data) as storrelse, opprettet from ${OBJEKT} where starts_with(sti, $1) order by sti`,
      [prefiks],
    );
    return rows.map((r) => ({ pathname: r.sti, size: Number(r.storrelse), uploadedAt: r.opprettet.toISOString() }));
  }
  const ut: ObjInfo[] = [];
  async function gaa(d: string) {
    let es;
    try {
      es = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await gaa(p);
      else {
        const st = await fs.stat(p);
        ut.push({ pathname: path.relative(LOKAL, p).split(path.sep).join("/"), size: st.size, uploadedAt: st.mtime.toISOString() });
      }
    }
  }
  await gaa(LOKAL);
  return ut.filter((o) => o.pathname.startsWith(prefiks)).sort((a, b) => a.pathname.localeCompare(b.pathname));
}
