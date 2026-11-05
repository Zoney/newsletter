import type { Metadata } from "next";
import Link from "next/link";
import { NyhetsbrevForm } from "@/components/NyhetsbrevForm";

export const metadata: Metadata = { title: "Meld deg av | Øyvinds nyhetsbrev" };

export default function MeldAv() {
  return (
    <div className="space-y-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Meld deg av</h1>
      <p className="text-lg text-gray-400 sm:text-xl">
        Skriv inn adressen du vil ha ut av lista. Du kan også bare svare «meld meg av» på et brev.
      </p>
      <NyhetsbrevForm action="unsubscribe" source="/meld-av" />
      <p className="text-sm text-gray-500">
        <Link className="underline hover:text-gray-300" href="/">
          Tilbake
        </Link>
      </p>
    </div>
  );
}
