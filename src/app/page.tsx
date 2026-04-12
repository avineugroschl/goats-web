"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "@/components/Footer";

export default function Home() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  return (
    <main className="min-h-screen bg-bg overflow-hidden">
      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between bg-surface-dark px-6 py-5 sm:px-12">
        <div className="flex items-center gap-3">
          <img src="/app-icon.png" alt="G.O.A.T.S" className="h-10 w-10 rounded-xl" />
          <span className="font-display text-xl font-bold tracking-tight text-white">G.O.A.T.S</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/operator" className="hidden text-sm font-medium text-white/50 transition-colors hover:text-teal sm:block">
            Court Operators
          </Link>
        </div>
      </nav>

      {/* Hero — dark section */}
      <section className="relative bg-surface-dark px-6 pt-16 pb-24 sm:px-12 lg:pt-24 lg:pb-32 overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-teal/[0.06] blur-3xl" />
          <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-coral/[0.04] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-20">
          {/* Left — copy + buttons */}
          <div className={`max-w-xl text-center lg:text-left transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/10 px-4 py-1.5">
              <div className="h-2 w-2 rounded-full bg-teal animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-widest text-teal">Live on courts near you</span>
            </div>

            <h1 className="font-display mb-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              Improve your pickup<br />
              <span className="text-teal">basketball experience.</span>
            </h1>

            <p className="mb-8 max-w-md text-lg leading-relaxed text-white/60 lg:max-w-none">
              Never be surprised again. We give you all the info you need to have
              a great run. No more guessing, just show up and play.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <Link href="/courts" className="rounded-full bg-coral px-8 py-4 font-display text-base font-bold text-white shadow-lg shadow-coral/25 transition-all hover:bg-coral-dark hover:shadow-coral/35 hover:scale-[1.02]">
                Browse Courts
              </Link>
              <a href="#get-the-app" className="rounded-full border-2 border-white/20 px-8 py-4 font-display text-base font-bold text-white transition-all hover:border-teal hover:text-teal">
                Get the App
              </a>
            </div>
          </div>

          {/* Right — single phone screenshot */}
          <div className={`relative flex shrink-0 items-center justify-center transition-all duration-700 delay-200 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            {/* Glow behind phone */}
            <div className="absolute h-72 w-72 rounded-full bg-teal/10 blur-3xl" />

            <div className="relative w-56 rotate-3 overflow-hidden rounded-[2.5rem] border-2 border-white/10 shadow-2xl shadow-black/40 sm:w-64">
              <img src="/screenshot-hero.jpg" alt="G.O.A.T.S courts list showing live activity" className="w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display mb-14 text-center text-3xl font-extrabold text-text-primary sm:text-4xl">
            Everything you need before, during,<br className="hidden sm:block" /> and<span className="text-teal"> after the game.</span>
          </h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <FeatureCard
              screenshot="/screenshot-courts-active.jpg"
              badge="Discover"
              title="Find Courts"
              desc="Browse basketball courts with our custom reviews, details that matter, and commentary from the court."
              accent="teal"
            />
            <FeatureCard
              screenshot="/screenshot-court-detail.jpg"
              badge="Live"
              title="Live Check-ins"
              desc="See how many people are at each court right now. No more showing up to an empty gym."
              accent="coral"
            />
            <FeatureCard
              screenshot="/screenshot-rate-player.jpg"
              badge="Compete"
              title="Rate Players"
              desc="Play with other players and unlock the ability to rate each other&apos;s skills. 9 categories, honest assessments."
              accent="gold"
            />
            <FeatureCard
              screenshot="/screenshot-profile.jpg"
              badge="Reputation"
              title="Improve Your Skills"
              desc="Your overall rating follows you. See where you stand, where you&apos;re improving, and what to work on."
              accent="teal"
            />
          </div>
        </div>
      </section>

      {/* Callout */}
      <section className="border-y border-surface-variant/60 px-6 py-16 sm:px-12">
        <p className="font-display text-center text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
          Free. No ads.<span className="text-teal"> Just basketball.</span>
        </p>
      </section>

      {/* CTA */}
      <section id="get-the-app" className="relative bg-surface-dark px-6 py-24 text-center sm:px-12 scroll-mt-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/[0.06] blur-3xl" />
        </div>

        <div className="relative z-10">
          <img src="/app-icon.png" alt="G.O.A.T.S" className="mx-auto mb-8 h-24 w-24 rounded-3xl shadow-2xl shadow-teal/10" />
          <h2 className="font-display mb-4 text-3xl font-extrabold text-white sm:text-4xl">
            Ready to improve your game?
          </h2>
          <p className="mx-auto mb-10 max-w-md text-white/50">
            Download G.O.A.T.S. It&apos;s not a baaahhh&apos;d decision... sorry.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <span className="rounded-xl bg-white/10 px-8 py-4 text-sm font-semibold text-white/60 backdrop-blur-sm">
              App Store — Coming Soon
            </span>
            <span className="rounded-xl bg-white/10 px-8 py-4 text-sm font-semibold text-white/60 backdrop-blur-sm">
              Google Play — Coming Soon
            </span>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function FeatureCard({
  screenshot,
  badge,
  title,
  desc,
  accent,
}: {
  screenshot: string;
  badge: string;
  title: string;
  desc: string;
  accent: "teal" | "coral" | "gold";
}) {
  const accentColors = {
    teal: { bg: "bg-teal/10", text: "text-teal", border: "border-teal/20" },
    coral: { bg: "bg-coral/10", text: "text-coral", border: "border-coral/20" },
    gold: { bg: "bg-gold/10", text: "text-gold", border: "border-gold/20" },
  };
  const c = accentColors[accent];

  return (
    <div className={`group flex flex-col overflow-hidden rounded-2xl border ${c.border} bg-white transition-all hover:shadow-lg hover:shadow-black/5`}>
      <div className="flex flex-1 flex-col p-6">
        <span className={`mb-3 inline-flex w-fit items-center rounded-full ${c.bg} px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${c.text}`}>
          {badge}
        </span>
        <h3 className="font-display mb-2 text-lg font-bold text-text-primary">{title}</h3>
        <p className="text-sm leading-relaxed text-text-secondary">{desc}</p>
      </div>
      <div className="flex justify-center bg-surface-dark/[0.03] px-6 pt-4">
        <div className="w-32 overflow-hidden rounded-t-2xl shadow-lg transition-transform group-hover:-translate-y-1">
          <img src={screenshot} alt={title} className="w-full" />
        </div>
      </div>
    </div>
  );
}
