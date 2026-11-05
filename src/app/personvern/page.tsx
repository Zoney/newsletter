import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Personvern | Øyvinds nyhetsbrev",
  description: "Hva som lagres når du melder deg på nyhetsbrevet, hvor det ligger, og hvordan du melder deg av.",
};

/* Etter malen i husken: workshop/apper/personvern/mal-personvern.md. Skriv bare det som er sant for koden. */
export default function Personvern() {
  return (
    <article className="space-y-6 text-left text-gray-300 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">
      <h1 className="text-3xl font-bold text-white">Personvern</h1>
      <p className="text-lg">
        Det eneste denne siden lagrer om deg, er e-postadressen din hvis du selv melder deg på. Den lagres kryptert på min
        egen server i Finland, uten nyhetsbrevtjeneste, reklame eller sporing. Du kan melde deg av når du vil.
      </p>

      <h2>Hvem som er ansvarlig</h2>
      <p>
        Nyhetsbrevet drives av Øyvind Sandåker, som er behandlingsansvarlig for personopplysningene. Spørsmål om personvern
        sender du til oyvind@zoney.no.
      </p>

      <h2>Uten å melde deg på</h2>
      <ul>
        <li>Ingen informasjonskapsler, ingen analyseverktøy fra andre og ingen sporing.</li>
        <li>
          Serveren logger alt som kommer inn til sida (tidspunkt, IP-adressen din, hvilken side du ba om, nettleseren og
          hvilket nettsted du kom fra) for å beskytte tjenesten mot angrep og rette feil. Loggen ligger kryptert hos oss og
          slettes etter 30 dager. Informasjonskapsler kommer aldri i loggen. Det som blir igjen etterpå, er bare antall per
          dag (for eksempel hvor mange som så en side, eller brukte mobil), og det kan ikke knyttes til noen.
        </li>
      </ul>

      <h2>Når du melder deg på</h2>
      <ul>
        <li>
          <strong>Hva som lagres:</strong> e-postadressen din, tidspunktet, hvilken side du meldte deg på fra, og hvilken
          versjon av samtykketeksten du krysset av for. Ikke navn og ikke IP-adresse (serverloggen over gjelder alle besøk, også dette).
        </li>
        <li>
          <strong>Hvorfor:</strong> for å sende deg nyhetsbrevet, fordi du har sagt ja til det (GDPR artikkel 6 nr. 1
          bokstav a). Adressen brukes ikke til noe annet, deles ikke med noen og selges aldri.
        </li>
        <li>
          <strong>Hvordan den oppbevares:</strong> adressen krypteres i det den kommer inn til nettsiden, med en nøkkel
          nettsiden selv ikke kan låse opp. Nøkkelen som låser opp, finnes bare på min egen maskin og brukes bare når et
          brev skal sendes. Brevene sendes fra min egen e-post, med alle mottakere i blindkopi. Ingen ser hvem andre som
          får brevet, og ingen sporer om du åpner eller klikker.
        </li>
        <li>
          <strong>Påmeldt før november 2026:</strong> da lå lista hos Mailchimp. Adressene derfra er flyttet hit og
          krypteres på samme måte, og lista hos Mailchimp slettes når flyttingen er ferdig.
        </li>
      </ul>

      <h2>Hvor dataene ligger, og hvem som hjelper oss</h2>
      <p>
        Nettsiden og databasen kjører på én server vi leier av <strong>Hetzner Online GmbH</strong> (Tyskland), i
        datasenteret deres i Tuusula ved Helsingfors i Finland. Ingenting lagres eller behandles utenfor EU/EØS.
      </p>
      <ul>
        <li>Vi har en databehandleravtale med Hetzner etter GDPR artikkel 28, inngått 1. november 2026.</li>
        <li>
          Hetzner er sertifisert etter ISO/IEC 27001 og BSI C5 Type 2. TÜV Rheinland kontrollerte sikkerhetstiltakene i
          datasenteret i Finland 19. februar 2026 og fant ingen avvik.
        </li>
        <li>Hetzner leier ut maskinen, men har ikke tilgang til dataene: disken er kryptert, og nøkkelen lagres ikke hos dem.</li>
      </ul>
      <p>
        Vi bruker ingen andre tjenester som får personopplysninger: ingen nyhetsbrevtjeneste, ingen analyse, ingen
        innholdsnettverk og ingen eksterne skrifttyper. Let&apos;s Encrypt lager sertifikatet for den sikre forbindelsen og
        får bare vite domenenavnet.
      </p>

      <h2>Slik beskytter vi dataene</h2>
      <ul>
        <li>All trafikk går kryptert (HTTPS).</li>
        <li>
          Hver påmelding krypteres for seg før den lagres, og nettsiden har ingen måte å lese lista på. Hele disken på
          serveren er kryptert i tillegg.
        </li>
        <li>Databasen kan bare nås fra appen selv på samme maskin, ikke over nettet, og den har ingen passord som kan stjeles.</li>
        <li>Appen kjører avskjermet, uten tilgang til nettet og uten tilgang til andre apper.</li>
        <li>Serveren får sikkerhetsoppdateringer automatisk hver natt.</li>
        <li>Sikkerhetskopiene tas hver natt, krypteres to ganger med to nøkler som oppbevares hver for seg, og slettes etter 30 dager.</li>
      </ul>

      <h2>Hvor lenge vi tar vare på det</h2>
      <ul>
        <li>
          <strong>E-postadressen:</strong> til du melder deg av. Da slettes den ved neste opprydding, senest innen en måned.
        </li>
        <li>
          <strong>Logger på serveren:</strong> 30 dager.
        </li>
        <li>
          <strong>Sikkerhetskopier:</strong> 30 dager. Er adressen slettet, er den borte fra sikkerhetskopiene innen 30
          dager.
        </li>
      </ul>

      <h2>Meld deg av</h2>
      <p>
        På <Link href="/meld-av">avmeldingssiden</Link>, eller ved å svare «meld meg av» på et brev.
      </p>

      <h2>Rettighetene dine</h2>
      <p>
        Du har rett til innsyn i det vi har lagret om deg, til å få rettet feil, til å få det slettet, til å få det utlevert
        og til å protestere mot behandlingen. Skriv til oyvind@zoney.no, så svarer vi innen en måned.
      </p>
      <p>Mener du at vi behandler personopplysninger i strid med reglene, kan du klage til Datatilsynet.</p>

      <p className="text-sm text-gray-500">Sist endret 5. november 2026.</p>
    </article>
  );
}
