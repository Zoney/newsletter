"use client";

import { useId, useState, useSyncExternalStore, type SyntheticEvent } from "react";
import { SKJEMA_HEADER } from "@/lib/menneske";
import { CONSENT, MESSAGES, STATUSES, type Status } from "@/content/nyhetsbrev";

// Adresselinja er en ekstern kilde vi bare leser (uten JavaScript lander leseren på
// /?nyhetsbrev=<status>&skjema=<action>#status). På serveren finnes den ikke.
const noSubscribe = () => () => {};
const readSearch = () => window.location.search;
const serverSearch = () => "";

/**
 * Påmeldings- og avmeldingsskjemaet (etter hannenoding-no, components/NyhetsbrevForm.tsx).
 * Med JavaScript sendes JSON og svaret vises under knappen. Uten JavaScript blir det en vanlig
 * form-post, som API-ruta avviser som «robot» (menneskesjekken sendes bare med fetch).
 */
export function NyhetsbrevForm({ action, source }: { action: "subscribe" | "unsubscribe"; source: string }) {
  const id = useId();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  // Når skjemaet ble åpnet, til menneskesjekken i API-ruta (src/lib/menneske.ts)
  const [apnet] = useState(() => Date.now());

  const search = useSyncExternalStore(noSubscribe, readSearch, serverSearch);
  let fromUrl: Status | null = null;
  if (search) {
    const p = new URLSearchParams(search);
    const s = p.get("nyhetsbrev");
    if (s && (STATUSES as string[]).includes(s) && p.get("skjema") === action) fromUrl = s as Status;
  }
  const shown = status ?? fromUrl;

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/nyhetsbrev", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", [SKJEMA_HEADER]: String(Date.now() - apnet) },
        body: JSON.stringify({
          action,
          email: fd.get("email"),
          consent: fd.get("consent") === "yes",
          website: fd.get("website") ?? "",
          source,
        }),
      });
      const data = (await res.json().catch(() => null)) as { status?: Status } | null;
      setStatus(data?.status && (STATUSES as string[]).includes(data.status) ? data.status : "feil");
      if (res.ok) form.reset();
    } catch {
      setStatus("feil");
    } finally {
      setBusy(false);
    }
  }

  const ok = shown === "ok" || shown === "av";

  return (
    <form action="/api/nyhetsbrev" method="post" onSubmit={onSubmit} className="text-left" aria-describedby={shown ? `${id}-status` : undefined}>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="source" value={source} />

      <label htmlFor={`${id}-email`} className="sr-only">
        E-postadressen din
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          maxLength={254}
          placeholder="Skriv inn eposten din her"
          className="min-h-12 flex-grow rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-white placeholder:text-gray-400 focus:outline-2 focus:outline-purple-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-md bg-purple-700 px-5 py-2 font-semibold text-white transition-colors hover:bg-purple-600 disabled:opacity-60"
        >
          {busy ? "Sender …" : action === "subscribe" ? "Abonner" : "Meld meg av"}
        </button>
      </div>

      {/* Honningfelle: usynlig for folk, fristende for roboter. Fylles den ut, lagres ingenting. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Nettside</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {action === "subscribe" && (
        <label htmlFor={`${id}-consent`} className="mt-4 flex items-start gap-3 text-base text-gray-300">
          <input id={`${id}-consent`} name="consent" type="checkbox" value="yes" required className="mt-1 h-5 w-5 shrink-0 accent-purple-600" />
          <span>{CONSENT.text}</span>
        </label>
      )}

      <p id={`${id}-status`} role="status" aria-live="polite" className={`mt-3 min-h-[1.6em] text-base font-semibold ${ok ? "text-green-300" : "text-rose-400"}`}>
        {shown ? MESSAGES[shown] : ""}
      </p>
    </form>
  );
}
