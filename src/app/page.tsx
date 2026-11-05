import Link from "next/link";
import { NyhetsbrevForm } from "@/components/NyhetsbrevForm";

export default function Home() {
  return (
    <div className="space-y-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Nerdete nyhetsbrev fra Øyvind?</h1>
      <p className="text-lg text-gray-400 sm:text-xl lg:text-2xl">
        Skal det være noe nerdete greier til random tidspunkt på epost? F.eks om DevSecOps, Serverless, .NET, TypeScript,
        React, Azure, Ultraløping, AI, XAI, GenAI, AGI, osv?
      </p>
      <p className="text-lg text-gray-400 sm:text-xl lg:text-2xl">Om du våger er det bare å skrive inn eposten din her:</p>
      <NyhetsbrevForm action="subscribe" source="/" />
      <p className="text-sm text-gray-500 sm:text-base">
        Adressen lagres kryptert på min egen server, og ingen nyhetsbrevtjeneste er involvert.{" "}
        <Link className="underline hover:text-gray-300" href="/personvern">
          Les mer
        </Link>
        .
      </p>
    </div>
  );
}
