import { hent, lagre, liste, slett } from "@/lib/lager";
import { krevKlient } from "@/lib/tjeneste";

/*
 * Lageret for skriptene i scripts/ (eksport av nyhetsbrevlista, avmelding og flyttingen fra
 * Mailchimp), bare med klientsertifikat. Svarer med objektene som de ligger: konvoluttene er
 * forseglet, og den private nøkkelen har bare Øyvind lokalt. Kopiert fra hannenoding-no.
 *
 *   GET    ?prefix=nyhetsbrev/production/      → [{ pathname, size, uploadedAt }]
 *   GET    ?path=<sti>                          → innholdet (404 hvis det ikke finnes)
 *   PUT    ?path=<sti>[&overwrite=1]            ← innholdet (409 hvis stien finnes uten overwrite)
 *   DELETE ?path=<sti>
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STI = /^nyhetsbrev\/[a-z]+\/[A-Za-z0-9._\/-]+$/;
const PREFIKS = /^nyhetsbrev\/([a-z]+\/([A-Za-z0-9._\/-]*)?)?$/;

function sti(req: Request): string | null {
  const s = new URL(req.url).searchParams.get("path");
  return s && STI.test(s) && !s.includes("..") ? s : null;
}

export async function GET(req: Request) {
  const nei = await krevKlient();
  if (nei) return nei;
  const p = new URL(req.url).searchParams.get("prefix");
  if (p !== null) {
    if (!PREFIKS.test(p) || p.includes("..")) return Response.json({ error: "Ugyldig prefiks" }, { status: 400 });
    return Response.json(await liste(p));
  }
  const s = sti(req);
  if (!s) return Response.json({ error: "Ugyldig sti" }, { status: 400 });
  const buf = await hent(s);
  if (!buf) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const nei = await krevKlient();
  if (nei) return nei;
  const s = sti(req);
  if (!s) return Response.json({ error: "Ugyldig sti" }, { status: 400 });
  const overskriv = new URL(req.url).searchParams.get("overwrite") === "1";
  try {
    await lagre(s, Buffer.from(await req.arrayBuffer()), { overskriv });
  } catch (e) {
    const kode = (e as { code?: string }).code;
    if (kode === "23505" || kode === "EEXIST") return Response.json({ error: "Finnes fra før" }, { status: 409 });
    throw e;
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const nei = await krevKlient();
  if (nei) return nei;
  const s = sti(req);
  if (!s) return Response.json({ error: "Ugyldig sti" }, { status: 400 });
  await slett(s);
  return Response.json({ ok: true });
}
