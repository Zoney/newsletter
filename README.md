# Øyvinds nyhetsbrev

Påmeldingssida på **https://newsletter.zoney.no** (fram til november 2026 newsletter.oyvindbs.no på
Vercel, med lista i Mailchimp). Kjører på app-serveren hos Hetzner (husken: `workshop/apper/README.md`).
Egen liste, laget som Hannes nyhetsbrev på hannenoding.no (`hannenoding-no/AGENTS.md` §12): ingen
nyhetsbrevtjeneste, Øyvind sender selv fra egen e-post med alle i blindkopi.

## Sikkerhetsmodellen

- **Skrive-bare.** `POST /api/nyhetsbrev` er den eneste skrivbare ruta, og den kan bare skrive. Ingen
  side eller rute på sida kan lese lista. Svaret sier aldri om en adresse fantes fra før. Loggen får
  aldri adresser.
- **Forseglet konvolutt per hendelse.** Hver påmelding og avmelding krypteres i ruta med en engangsnøkkel
  (X25519 + HKDF-SHA256 + AES-256-GCM, stien som tilleggsdata), mot den offentlige nøkkelen i
  `src/lib/nyhetsbrev/offentlig-nokkel.mjs`, og lagres som én rad i `app.objekt` i Postgres
  (`nyhetsbrev/production/<tid>-<uuid>.json`). Kode: `src/lib/nyhetsbrev/seal.mjs` (bare `node:crypto`).
- **Den private nøkkelen er aldri på serveren.** Den ligger i `~/.husk/oyvind-nyhetsbrev.key` (chmod 600)
  på Macen. Ta backup (Apple Passwords). Mister vi den, er lista borte.
- **Å lese lista krever** klientsertifikatet `macen` (`~/.husk/klient/macen.{key,crt}`, slipper inn til
  `https://relay.zoney.no/newsletter/api/tjeneste/obj`; ruta svarer 404 uten) **og** den private nøkkelen.
- **Forsvar i ruta:** bare POST med JSON/form → samme opphav → maks 4 KB → honningfelle (`website`) →
  menneskesjekk (`x-skjema-apnet`, minst to sekunder, sendes bare med JavaScript) → 6 per IP per 10 min og
  120 per minutt → adressesjekk → samtykke krysset av. Ingen informasjonskapsler.
- **Samtykke** er versjonert i `src/content/nyhetsbrev.ts`. Påmeldingene fra Mailchimp har versjonen
  `mailchimp` (det gamle skjemaet hadde ingen avkrysning).

## Kommandoer (på Macen)

```bash
npm run -s nyhetsbrev:export -- | LANG=en_US.UTF-8 pbcopy   # BCC-lista rett på utklippstavla
npm run -s nyhetsbrev:export -- >/dev/null                  # bare antall (stderr)
npm run -s nyhetsbrev:export -- --json                      # med tidspunkt, kilde og samtykkeversjon
npm run nyhetsbrev:remove -- <e-post>                       # når noen svarer «meld meg av»
npm run -s nyhetsbrev:export -- --purge --yes >/dev/null    # slett avmeldte og gamle duplikater fysisk
```

Adressene går bare til stdout, alt annet til stderr. NB i zsh: `2>&1 >/dev/null | …` sender også
stdout inn i røret (MULTIOS), så adressene kommer med. Bruk `>/dev/null` alene.

## Flyttingen fra Mailchimp

Uttrekket ligger i `~/.husk/flytting/newsletter/mailchimp-medlemmer.json` (hentet med Mailchimp-API-et
5.11.2026, chmod 600). Etter første deploy:

```bash
npm run flytt:import -- --tørt     # antall, ingenting sendt
npm run flytt:import               # legger hver påmeldt adresse inn som forseglet påmelding
npm run -s nyhetsbrev:export -- >/dev/null   # antall påmeldt på serveren
```

Importen er idempotent (stien er laget av påmeldingstidspunktet og en HMAC av adressen med den private
nøkkelen), og den nekter å kjøre igjen når det allerede ligger påmeldinger fra Mailchimp der (bruk
`--fortsett` bare for å fullføre en kjøring som stoppet). Den tar også eksporten fra Mailchimp
(`--csv subscribed_members_export_….csv`). Ingenting slettes hos Mailchimp eller Vercel.

## Lokalt

```bash
npm run dev                         # localhost:3880, lagrer i data/lager/ (uten database)
npm run db:dev & npm run dev:db     # med PGlite som Postgres (localhost:5439)
NEWSLETTER_LAGER=lokal npm run -s nyhetsbrev:export -- --env development
NEWSLETTER_LAGER=lokal-server npm run -s nyhetsbrev:export -- --env development   # mot appen på localhost
```

## Deploy

Push til `main`, så `workshop/apper/apper.sh deploy newsletter` på Workshop. `vercel.json` stopper
Vercel fra å bygge. Miljø: `NEWSLETTER_MILJO=production` (skjemaet `app`), `DATABASE_URL` fra serveren.
