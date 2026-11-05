#!/usr/bin/env node
/**
 * Lager nøkkelparet for nyhetsbrevlista. Kjøres ÉN gang, lokalt, av administrator.
 *
 *  - Privat nøkkel → ~/.husk/oyvind-nyhetsbrev.key (chmod 600). Aldri på serveren, aldri i git.
 *  - Offentlig nøkkel → src/lib/nyhetsbrev/offentlig-nokkel.mjs (trygg å dele, ligger i koden).
 *
 * Overstyr fila med NYHETSBREV_PRIVATE_KEY_FILE. `--force` overskriver en eksisterende nøkkel,
 * og da blir alle påmeldinger som er forseglet med den gamle nøkkelen uleselige. Eksporter først.
 * Skriptet skriver aldri den private nøkkelen til terminalen.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { generateKeyPair } from "../../src/lib/nyhetsbrev/seal.mjs";

const file = process.env.NYHETSBREV_PRIVATE_KEY_FILE ?? join(homedir(), ".husk", "oyvind-nyhetsbrev.key");
const force = process.argv.includes("--force");

if (existsSync(file) && !force) {
  console.error(`Privat nøkkel finnes allerede: ${file}`);
  console.error("En ny nøkkel gjør alle eksisterende påmeldinger uleselige. Eksporter lista først, og bruk --force hvis du mener det.");
  process.exit(1);
}

const { publicKeyB64, privateKeyB64 } = generateKeyPair();
mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
writeFileSync(file, `${privateKeyB64}\n`, { mode: 0o600 });
chmodSync(file, 0o600);

console.log(`Privat nøkkel skrevet til ${file} (bare du kan lese fila).`);
console.log("TA BACKUP av fila, f.eks. i Apple Passwords. Mister du den, kan ingen lese lista.\n");
console.log("Offentlig nøkkel (trygg å dele). Lim den inn i src/lib/nyhetsbrev/offentlig-nokkel.mjs:\n");
console.log(publicKeyB64);
