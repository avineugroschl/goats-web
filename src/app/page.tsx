"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "@/components/Footer";

/* ── Modern phone frame with realistic bezel + dynamic island ── */
function PhoneFrame({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="relative rounded-[2.6rem] bg-[#0a0a0a] p-[4px] shadow-[0_30px_80px_-15px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-white/[0.06]">
        {/* Screen */}
        <div className="overflow-hidden rounded-[2.35rem]">
          <img
            src={src}
            alt={alt}
            className="block w-full"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-bg">
      {/* ─── Nav — light, always shows Court Operators ─── */}
      <nav className="relative z-30 flex items-center justify-between border-b border-black/[0.04] bg-white/80 px-6 py-4 backdrop-blur-lg sm:px-12">
        <div className="flex items-center gap-3">
          <img
            src="/app-icon.png"
            alt="G.O.A.T.S"
            className="h-10 w-10 rounded-xl"
          />
          <span className="font-display text-xl font-bold tracking-tight text-text-primary">
            G.O.A.T.S
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/courts"
            className="rounded-full bg-coral px-3 py-2 text-center font-display text-xs font-bold text-white shadow-lg shadow-coral/25 transition-all hover:scale-[1.02] hover:bg-coral-dark hover:shadow-coral/35 sm:px-6 sm:py-2.5 sm:text-sm"
          >
            Browse Courts
          </Link>
          <Link
            href="/operator"
            className="rounded-full border-2 border-text-primary/15 px-3 py-2 text-center font-display text-xs font-bold text-text-primary transition-all hover:border-teal hover:text-teal sm:px-6 sm:py-2.5 sm:text-sm"
          >
            Court Operators
          </Link>
        </div>
      </nav>

      {/* ─── Hero — light section ─── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-20 sm:px-12 lg:pt-20 lg:pb-28">
        {/* Ambient gradient washes */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-[550px] w-[550px] rounded-full bg-teal/[0.07] blur-[120px]" />
          <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-coral/[0.04] blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:gap-16">
          {/* Left — copy + buttons + badges */}
          <div
            className={`max-w-xl flex-1 text-center transition-all duration-700 lg:text-left ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/[0.08] px-4 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-teal" />
              <span className="text-xs font-semibold uppercase tracking-widest text-teal-dark">
                Live on courts near you
              </span>
            </div>

            <h1 className="font-display mb-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-text-primary sm:text-5xl lg:text-[3.4rem]">
              Improve your pickup
              <br />
              <span className="text-teal">basketball experience.</span>
            </h1>

            <p className="mb-8 max-w-md text-lg leading-relaxed text-text-secondary lg:max-w-none">
              G.O.A.T.S is the pickup basketball app. We give you all the info you need to have
              a great run. No more guessing, just show up and play.
            </p>

            {/* App store badges */}
            <div id="app-badges" className="scroll-mt-32 flex flex-col items-center gap-2.5 sm:flex-row lg:justify-start">
              <span className="rounded-xl bg-surface-dark/[0.06] px-5 py-2.5 text-sm font-semibold text-text-muted">
                App Store &mdash; Coming Soon
              </span>
              <span className="rounded-xl bg-surface-dark/[0.06] px-5 py-2.5 text-sm font-semibold text-text-muted">
                Google Play &mdash; Coming Soon
              </span>
            </div>
          </div>

          {/* Right — phone showcase */}
          <div
            className={`relative flex shrink-0 items-center justify-center transition-all delay-200 duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
          >
            {/* Glow behind phones */}
            <div className="absolute h-72 w-72 rounded-full bg-teal/[0.06] blur-[80px]" />

            {/* 3-phone fan — sm+ */}
            <div className="relative hidden h-[480px] w-[400px] sm:block lg:w-[440px]">
              {/* Left phone */}
              <div className="absolute left-0 top-6 z-0 w-[155px] -rotate-6 lg:w-[168px]">
                <PhoneFrame
                  src="/screenshot-court-detail-new.jpg"
                  alt="Court details"
                />
              </div>
              {/* Center phone */}
              <div className="relative z-20 flex justify-center">
                <PhoneFrame
                  src="/screenshot-courts-new.jpg"
                  alt="G.O.A.T.S courts list"
                  className="w-[178px] lg:w-[190px]"
                />
              </div>
              {/* Right phone */}
              <div className="absolute right-0 top-6 z-10 w-[155px] rotate-6 lg:w-[168px]">
                <PhoneFrame
                  src="/screenshot-ratings-new.jpg"
                  alt="Player ratings"
                />
              </div>
            </div>

            {/* Single phone — mobile */}
            <div className="sm:hidden">
              <PhoneFrame
                src="/screenshot-courts-new.jpg"
                alt="G.O.A.T.S courts list"
                className="w-[220px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features — dark section ─── */}
      <section className="bg-surface-dark px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display mb-14 text-center text-3xl font-extrabold text-white sm:text-4xl">
            Everything you need before, during,
            <br className="hidden sm:block" /> and
            <span className="text-teal"> after the game.</span>
          </h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <FeatureCard
              screenshot="/screenshot-find-courts.png"
              badge="Discover"
              title="Find Courts"
              desc="Browse basketball courts with our custom reviews, details that matter, and commentary from the court."
              accent="teal"
            />
            <FeatureCard
              screenshot="/screenshot-court-detail-new.jpg"
              badge="Live"
              title="Live Check-ins"
              desc="See how many people are at each court right now. No more showing up to an empty gym."
              accent="coral"
            />
            <FeatureCard
              screenshot="/screenshot-rate-player-new.jpg"
              badge="Compete"
              title="Rate Players"
              desc="Play with other players and unlock the ability to rate each other&apos;s skills. 9 categories, honest assessments."
              accent="gold"
            />
            <FeatureCard
              screenshot="/screenshot-profile-new.jpg"
              badge="Reputation"
              title="Improve Your Skills"
              desc="Your overall rating follows you. See where you stand, where you&apos;re improving, and what to work on."
              accent="teal"
            />
          </div>
        </div>
      </section>

      {/* ─── Callout — dark, flowing from features ─── */}
      <section className="border-t border-white/[0.05] bg-surface-dark px-6 py-16 sm:px-12">
        <p className="font-display text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Free. No ads.
          <span className="text-teal"> Just basketball.</span>
        </p>
      </section>

      {/* ─── CTA — light section ─── */}
      <section
        id="get-the-app"
        className="relative overflow-hidden bg-bg px-6 py-24 text-center scroll-mt-16 sm:px-12"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/[0.05] blur-[100px]" />
        </div>

        <div className="relative z-10">
          <img
            src="/app-icon.png"
            alt="G.O.A.T.S"
            className="mx-auto mb-8 h-24 w-24 rounded-3xl shadow-2xl shadow-teal/15"
          />
          <h2 className="font-display mb-4 text-3xl font-extrabold text-text-primary sm:text-4xl">
            Ready to improve your game?
          </h2>
          <p className="mx-auto mb-10 max-w-md text-text-secondary">
            Download G.O.A.T.S. It&apos;s not a baaahhh&apos;d decision...
            sorry.
          </p>
          <a
            href="#app-badges"
            className="inline-block rounded-full bg-coral px-10 py-4 font-display text-base font-bold text-white shadow-lg shadow-coral/25 transition-all hover:scale-[1.02] hover:bg-coral-dark hover:shadow-coral/35"
          >
            Get the App
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
}

/* ── Feature card — styled for dark background ── */
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
    teal: { bg: "bg-teal/10", text: "text-teal", border: "border-teal/15" },
    coral: {
      bg: "bg-coral/10",
      text: "text-coral",
      border: "border-coral/15",
    },
    gold: { bg: "bg-gold/10", text: "text-gold", border: "border-gold/15" },
  };
  const c = accentColors[accent];

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border ${c.border} bg-white/[0.04] transition-all hover:bg-white/[0.07] hover:shadow-lg hover:shadow-black/20`}
    >
      <div className="flex flex-1 flex-col p-6">
        <span
          className={`mb-3 inline-flex w-fit items-center rounded-full ${c.bg} px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${c.text}`}
        >
          {badge}
        </span>
        <h3 className="font-display mb-2 text-lg font-bold text-white">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-white/50">{desc}</p>
      </div>
      <div className="flex justify-center px-6 pt-4">
        <div className="w-32 overflow-hidden rounded-t-2xl shadow-lg transition-transform group-hover:-translate-y-1">
          <img src={screenshot} alt={title} className="w-full" />
        </div>
      </div>
    </div>
  );
}
