import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { headers } from "next/headers";
import { currentActor } from "@/server/session";
import { messages as m } from "@/lib/messages";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: m.app, template: `%s | ${m.app}` },
  description: m.tagline,
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await currentActor(await headers());
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:bg-background focus:p-4"
        >
          {m.skip}
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href={actor ? "/dashboard" : "/"} className="brand-mark">
              <span className="brand-icon"><GraduationCap aria-hidden="true" /></span>
              <span className="flex flex-col gap-0.5"><span>{m.app}</span><span className="brand-caption">Learn with intention</span></span>
            </Link>
            <nav className="site-public-nav" aria-label="Account">
              {actor ? <Link className="site-workspace-link" href="/dashboard">{actor.role === "teacher" ? m.overview : m.classrooms}<span aria-hidden="true"> →</span></Link> : <><Link href="/login">{m.login}</Link><Link className="site-create-link" href="/register">Create account <span aria-hidden="true">↗</span></Link></>}
            </nav>
          </div>
        </header>
        <main id="main" className="site-main">
          {children}
        </main>
      </body>
    </html>
  );
}
