/**
 * Den OFFENTLIGE nøkkelen for nyhetsbrevlista (X25519, base64 av SPKI). Trygg å dele: den kan bare
 * forsegle, aldri åpne. Den private nøkkelen ligger bare på Øyvinds Mac (~/.husk/oyvind-nyhetsbrev.key).
 * Laget 5.11.2026 med `npm run nyhetsbrev:keygen`. NYHETSBREV_PUBLIC_KEY i miljøet overstyrer (bare til testing).
 */
export const OFFENTLIG_NOKKEL = "MCowBQYDK2VuAyEAqAwkIxKGq5tInOx/fj7E0lHf2x4Zxau0EJhq5VaBmVc=";

export function offentligNokkel() {
  return process.env.NYHETSBREV_PUBLIC_KEY || OFFENTLIG_NOKKEL;
}
