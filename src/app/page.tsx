"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center">
      {/* Hero Section */}
      <section className="flex w-full flex-col items-center px-6 pt-20 pb-16 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="text-coral">G.O.A.T.S</span>
        </h1>
        <p className="mb-2 text-xl text-text-secondary sm:text-2xl">
          Find Pickup Basketball Courts. See Who&apos;s Playing.
        </p>
        <p className="mb-10 max-w-xl text-text-muted">
          The pickup basketball app that lets you discover courts near you,
          check in when you arrive, and connect with other players in real time.
        </p>

        {/* QR Code Placeholder */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-surface-variant bg-surface">
            <span className="text-sm text-text-muted">QR Code</span>
          </div>
          <p className="text-sm text-text-secondary">
            Scan to download the app
          </p>
        </div>

        {/* App Store Buttons Placeholder */}
        <div className="mb-12 flex gap-4">
          <div className="rounded-lg bg-surface px-6 py-3 text-sm text-text-secondary">
            App Store - Coming Soon
          </div>
          <div className="rounded-lg bg-surface px-6 py-3 text-sm text-text-secondary">
            Google Play - Coming Soon
          </div>
        </div>

        {/* Browse Courts CTA */}
        <Link
          href="/courts"
          className="rounded-full bg-coral px-8 py-4 text-lg font-semibold text-bg transition-colors hover:bg-coral-dark"
        >
          Browse Basketball Courts
        </Link>
      </section>

      {/* Features Section */}
      <section className="w-full max-w-4xl px-6 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold">
          Why <span className="text-teal">G.O.A.T.S</span>?
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="rounded-xl bg-surface p-6 text-center">
            <div className="mb-3 text-3xl">&#127936;</div>
            <h3 className="mb-2 text-lg font-semibold">Find Courts</h3>
            <p className="text-sm text-text-secondary">
              Discover basketball courts near you with details on baskets,
              lights, court condition, and more.
            </p>
          </div>
          <div className="rounded-xl bg-surface p-6 text-center">
            <div className="mb-3 text-3xl">&#128101;</div>
            <h3 className="mb-2 text-lg font-semibold">See Who&apos;s There</h3>
            <p className="text-sm text-text-secondary">
              Real-time check-ins show you how many people are at each court
              right now. No more empty runs.
            </p>
          </div>
          <div className="rounded-xl bg-surface p-6 text-center">
            <div className="mb-3 text-3xl">&#11088;</div>
            <h3 className="mb-2 text-lg font-semibold">Rate Players</h3>
            <p className="text-sm text-text-secondary">
              Play together, then rate each other. Build your reputation as a
              pickup basketball player.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-surface-variant px-6 py-8 text-center text-sm text-text-muted">
        <p>&copy; {new Date().getFullYear()} G.O.A.T.S. All rights reserved.</p>
      </footer>
    </main>
  );
}
