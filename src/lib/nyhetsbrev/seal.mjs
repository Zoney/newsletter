/**
 * Forseglet konvolutt for nyhetsbrev-påmeldinger. Kun Node-innebygde moduler.
 *
 * Modellen («mega-sikkert»):
 *  - Nettsiden har bare den OFFENTLIGE nøkkelen (X25519, env NYHETSBREV_PUBLIC_KEY).
 *  - Hver påmelding krypteres for seg med en engangsnøkkel: X25519-ECDH mot den offentlige
 *    nøkkelen → HKDF-SHA256 → AES-256-GCM. Samme oppskrift som libsodiums «sealed box».
 *  - Den PRIVATE nøkkelen ligger bare lokalt hos administratoren (~/.husk/…), aldri på serveren.
 *    Den som får tak i hele serveren (miljøvariabler, databasen, backupene) ser derfor
 *    bare antall konvolutter og tidsstempler, aldri en e-postadresse.
 *  - AAD (tilleggsdata som autentiseres) er stien til objektet, så en konvolutt ikke kan
 *    flyttes eller kopieres til en annen sti uten at dekrypteringen feiler.
 *
 * Konvolutt (JSON i blobben): { v: 1, epk, iv, ct, tag } — alle felt base64.
 * Brukes av både src/app/api/nyhetsbrev (forsegle) og scripts/nyhetsbrev/* (åpne), derfor .mjs.
 * Kopiert fra hannenoding-no (lib/nyhetsbrev/seal.mjs), med egen INFO-streng.
 */
import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const INFO = "oyvind-nyhetsbrev-v1";

/** Nytt X25519-nøkkelpar. Begge som base64 av DER (SPKI / PKCS8). */
export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return {
    publicKeyB64: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKeyB64: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  };
}

/** @param {string} b64 */
export function publicKeyFromB64(b64) {
  return createPublicKey({ key: Buffer.from(b64.trim(), "base64"), format: "der", type: "spki" });
}

/** @param {string} b64 */
export function privateKeyFromB64(b64) {
  return createPrivateKey({ key: Buffer.from(b64.trim(), "base64"), format: "der", type: "pkcs8" });
}

/** Offentlig nøkkel (base64 SPKI) utledet fra en privat nøkkel. */
export function publicKeyB64FromPrivate(privateKey) {
  return createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64");
}

/** Tilleggsdataene som binder konvolutten til stien sin. @param {string} pathname */
export function aadFor(pathname) {
  return `${INFO}|${pathname}`;
}

function deriveKey(shared, ephPubDer, recipientPubDer) {
  const salt = Buffer.concat([ephPubDer, recipientPubDer]);
  return Buffer.from(hkdfSync("sha256", shared, salt, INFO, 32));
}

/**
 * Forsegler et JSON-objekt for mottakeren. Krever bare den offentlige nøkkelen.
 * @param {unknown} plaintextObject
 * @param {import("node:crypto").KeyObject} recipientPublicKey
 * @param {string} aad
 */
export function seal(plaintextObject, recipientPublicKey, aad) {
  const eph = generateKeyPairSync("x25519");
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: recipientPublicKey });
  const ephPubDer = eph.publicKey.export({ type: "spki", format: "der" });
  const recPubDer = recipientPublicKey.export({ type: "spki", format: "der" });
  const key = deriveKey(shared, ephPubDer, recPubDer);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(plaintextObject), "utf8")), cipher.final()]);
  return {
    v: 1,
    epk: ephPubDer.toString("base64"),
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * Åpner en konvolutt. Krever den private nøkkelen. Kaster hvis noe er tuklet med.
 * @param {{v:number, epk:string, iv:string, ct:string, tag:string}} envelope
 * @param {import("node:crypto").KeyObject} recipientPrivateKey
 * @param {string} aad
 */
export function open(envelope, recipientPrivateKey, aad) {
  if (!envelope || envelope.v !== 1) throw new Error("Ukjent konvoluttformat");
  const ephPubDer = Buffer.from(envelope.epk, "base64");
  const ephPub = createPublicKey({ key: ephPubDer, format: "der", type: "spki" });
  const shared = diffieHellman({ privateKey: recipientPrivateKey, publicKey: ephPub });
  const recPubDer = createPublicKey(recipientPrivateKey).export({ type: "spki", format: "der" });
  const key = deriveKey(shared, ephPubDer, recPubDer);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(envelope.ct, "base64")), decipher.final()]);
  return JSON.parse(pt.toString("utf8"));
}
