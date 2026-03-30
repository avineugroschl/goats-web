"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 sm:px-12">
        <div className="flex items-center gap-3">
          <img
            src="/app-icon.png"
            alt="G.O.A.T.S"
            className="h-10 w-10 rounded-xl"
          />
          <span className="text-xl font-bold tracking-tight">G.O.A.T.S</span>
        </div>
        <Link
          href="/courts"
          className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-text-on-dark transition-colors hover:bg-teal-dark"
        >
          Browse Courts
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center px-6 pt-16 pb-20 sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:pt-24 lg:pb-28">
        {/* Left side - text */}
        <div className="mb-12 max-w-xl text-center lg:mb-0 lg:text-left">
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Improve your pickup{" "}
            <span className="text-teal">basketball experience.</span>
          </h1>
          <p className="mb-8 text-lg text-text-secondary sm:text-xl">
            Never be surprised again. We give you all the info you need to have
            a great run. No more guessing, just show up and play.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
            <Link
              href="/courts"
              className="rounded-full bg-coral px-8 py-4 text-lg font-semibold text-text-on-dark transition-colors hover:bg-coral-dark"
            >
              Browse Courts
            </Link>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl border-2 border-dashed border-surface-variant bg-surface">
                <span className="text-xs text-text-muted">QR Code</span>
              </div>
              <p className="text-xs text-text-muted">Scan to download</p>
            </div>
          </div>
        </div>

        {/* Right side - phone screenshots */}
        <div className="relative flex gap-4">
          <div className="w-44 -rotate-3 overflow-hidden rounded-3xl shadow-2xl sm:w-52">
            <img
              src="/screenshot-welcome.jpg"
              alt="G.O.A.T.S welcome screen"
              className="w-full"
            />
          </div>
          <div className="w-44 translate-y-8 rotate-3 overflow-hidden rounded-3xl shadow-2xl sm:w-52">
            <img
              src="/screenshot-courts-active.jpg"
              alt="G.O.A.T.S courts list showing active players"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface px-6 py-20 sm:px-12">
        <h2 className="mb-16 text-center text-3xl font-bold sm:text-4xl">
          Everything you need to play... <span className="text-teal">Right now</span>
        </h2>
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon="/screenshot-courts.jpg"
            title="Find Courts"
            description="Browse basketball courts with our custom reviews, the details that matter, and commentary straight from the court."
          />
          <FeatureCard
            icon="/screenshot-court-detail.jpg"
            title="Live Check-ins"
            description="See how many people are at each court right now. No more showing up to an empty gym."
            imagePosition="center 100%"
          />
          <FeatureCard
            icon="/screenshot-rate-player.jpg"
            title="Rate Players"
            description="Play with other players and unlock the ability to rate each other&apos;s skills."
          />
          <FeatureCard
            icon="/screenshot-profile.jpg"
            title="Build Your Rep"
            description="Your overall rating follows you. Show up, play hard, become a G.O.A.T."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface-dark px-6 py-20 text-center sm:px-12">
        <img
          src="/app-icon.png"
          alt="G.O.A.T.S"
          className="mx-auto mb-6 h-20 w-20 rounded-2xl"
        />
        <h2 className="mb-4 text-3xl font-bold text-text-on-dark sm:text-4xl">
          Ready to improve your game?
        </h2>
        <p className="mx-auto mb-8 max-w-md text-text-on-dark/70">
          Download G.O.A.T.S. It&apos;s not a baaahhh&apos;d decision... sorry.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <span className="rounded-lg bg-white/10 px-6 py-3 text-sm text-text-on-dark/60">
            App Store — Coming Soon
          </span>
          <span className="rounded-lg bg-white/10 px-6 py-3 text-sm text-text-on-dark/60">
            Google Play — Coming Soon
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-variant px-6 py-8 text-center text-sm text-text-muted">
        <p>&copy; {new Date().getFullYear()} G.O.A.T.S. All rights reserved.</p>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  imagePosition,
}: {
  icon: string;
  title: string;
  description: string;
  imagePosition?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-bg p-6 text-center">
      <div className="mb-4 h-16 w-16 overflow-hidden rounded-xl">
        <img src={icon} alt={title} className="h-full w-full object-cover" style={imagePosition ? { objectPosition: imagePosition } : undefined} />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}
