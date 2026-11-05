import { headers } from "next/headers";

/*
 * Server-til-server: Øyvinds Mac kaller sida med klientsertifikat via
 * https://relay.zoney.no/newsletter/… (husken: workshop/apper/README.md → «Server-til-server»).
 * Caddy setter X-Klient («CN=<navn>») bare der, etter sertifikatsjekken, og fjerner den fra alle
 * andre forespørsler, så den kan ikke forfalskes utenfra. Uten den svarer rutene 404, så på
 * newsletter.zoney.no finnes de ikke.
 */

/** Klientene som får lese og skrive lageret (sertifikatnavn, CN). */
const LOV = ["macen"];

export async function krevKlient(): Promise<Response | null> {
  const k = (await headers()).get("x-klient")?.match(/^CN=([a-z0-9-]+)$/)?.[1];
  if (!k) return new Response("Not found", { status: 404 });
  if (!LOV.includes(k)) return Response.json({ error: "Ikke tilgang" }, { status: 403 });
  return null;
}
