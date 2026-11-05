import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Øyvinds nyhetsbrev",
  description: "Noen ganger holder det ikke med en LinkedIn-post..?",
  metadataBase: new URL("https://newsletter.zoney.no"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="min-h-screen">
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
        <footer className="flex h-16 flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-sm text-gray-500">
          <a className="hover:text-gray-300" href="https://x.com/zoney">X.com/Zoney</a>
          <a className="hover:text-gray-300" href="https://www.linkedin.com/in/%C3%B8yvind-brekkhus-sand%C3%A5ker-343a0a9/">LinkedIn</a>
          <Link className="hover:text-gray-300" href="/meld-av">Meld deg av</Link>
          <Link className="hover:text-gray-300" href="/personvern">Personvern</Link>
        </footer>
      </body>
    </html>
  );
}
