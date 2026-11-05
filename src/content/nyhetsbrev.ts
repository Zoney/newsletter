/**
 * Nyhetsbrevet: samtykketekst (versjonert) og statusmeldinger.
 * Samtykkeversjonen lagres i hver påmelding, så vi vet hvilken tekst folk krysset av for.
 * Endres teksten: ny versjon her, og behold de gamle i CONSENT_HISTORY.
 * Samtykket står i leserens stemme («jeg» er den som melder seg på).
 */
export const CONSENT = {
  version: "2026-11-05",
  text: "Ja, Øyvind Sandåker kan sende meg nyhetsbrevet på e-post. Jeg kan melde meg av når som helst.",
} as const;

export const CONSENT_HISTORY: Record<string, string> = {
  [CONSENT.version]: CONSENT.text,
  // Påmeldingene fra Mailchimp (30.12.2023 til 5.11.2026): skjemaet hadde ingen avkrysning, bare
  // e-postfeltet og knappen «Abonner» under teksten om hva brevet handler om.
  mailchimp: "Skrev inn e-postadressen og trykket «Abonner» på newsletter.oyvindbs.no (uten egen samtykketekst).",
};

export type Status = "ok" | "av" | "ugyldig" | "samtykke" | "for-mange" | "robot" | "feil";

/** Meldingene leseren ser. Svaret sier aldri om adressen fantes fra før. */
export const MESSAGES: Record<Status, string> = {
  ok: "Skøy, takk! Du er meldt på.",
  av: "Du er meldt av. Takk for at du var med.",
  ugyldig: "Sjekk e-postadressen. Den ser ikke riktig ut.",
  samtykke: "Kryss av for at jeg kan sende deg e-post, så går det.",
  "for-mange": "Det kom mange forsøk på kort tid. Vent noen minutter og prøv igjen.",
  robot: "Fikk ikke bekreftet at du er et menneske. Last siden på nytt og prøv igjen.",
  feil: "Noe gikk galt hos meg. Prøv igjen litt senere.",
};

export const STATUSES = Object.keys(MESSAGES) as Status[];
