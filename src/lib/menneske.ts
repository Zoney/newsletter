/*
 * Enkel sjekk mot roboter i skjemaene (samme som hannenoding-no).
 * Skjemaene sender med JavaScript headeren under, med hvor mange millisekunder skjemaet har vært
 * åpent. Mangler den, eller er skjemaet sendt på under to sekunder, regnes det som en robot. Det
 * stopper de enkle robotene som poster rett til ruta; en robot som kjører en ekte nettleser og
 * venter, slipper gjennom. Hastighetsbremsen i ruta og i Caddy
 * (rate limiting per IP på app-serveren) tar resten.
 */
export const SKJEMA_HEADER = "x-skjema-apnet";
const MIN_MS = 2000;

export function serUtSomMenneske(req: Request): boolean {
  const ms = Number(req.headers.get(SKJEMA_HEADER));
  return Number.isFinite(ms) && ms >= MIN_MS && ms < 7 * 24 * 3600 * 1000;
}
