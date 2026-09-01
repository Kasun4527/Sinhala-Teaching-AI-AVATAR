"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  PlayCircle,
  X,
  Menu,
  BrainCircuit,
  Mic2,
  Gauge,
  Atom,
  FlaskConical,
  Dna,
  Sigma,
  LineChart,
  Flower2,
  ClipboardList,
  MessageSquareText,
  Trophy,
  ArrowRight,
  Bot,
  Zap,
  TrendingUp,
  Gamepad2,
  ChevronRight,
} from "lucide-react";
import { GlareCard } from "@/components/ui/glare-card";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";

// ---------------------------------------------------------------------------
// Ported from frontend/routes/index.tsx (the TanStack Start page Lovable
// generated) into a Next.js App Router page. Changes from the original:
//   - `motion/react` -> `framer-motion` (already installed here)
//   - the Route/createFileRoute + heroVideo.asset.json import (Lovable's
//     private CDN pointer, TanStack-only) -> a plain local video path
//   - in-page-only anchor CTAs -> real /login, /signup, /select-role routes
// Design tokens (bg-background, text-physics, surface-card, font-display,
// …) are unchanged and come from the `.theme-aiguru` scope registered in
// app/globals.css.
// ---------------------------------------------------------------------------
const HERO_VIDEO_SRC = "/videos/hero-bg.mp4";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Subjects", href: "#subjects" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

const STATS = [
  { icon: BrainCircuit, label: "Hybrid PC-BKT + LSTM", sub: "Real-time AI engine", color: "text-physics" },
  { icon: Mic2, label: "Sinhala Voice Native", sub: "Natural AI narration", color: "text-biology" },
  { icon: Gauge, label: "Real-Time Adaptive", sub: "Recalibrates instantly", color: "text-maths" },
];

const SUBJECTS = [
  { name: "Physics", sinhala: "භෞතික විද්‍යාව", icon: Atom, color: "text-physics", tint: "bg-physics/12", span: "lg:col-span-2" },
  { name: "Chemistry", sinhala: "රසායන විද්‍යාව", icon: FlaskConical, color: "text-chemistry", tint: "bg-chemistry/12", span: "" },
  { name: "Biology", sinhala: "ජීව විද්‍යාව", icon: Dna, color: "text-biology", tint: "bg-biology/12", span: "" },
  { name: "Maths", sinhala: "ගණිතය", icon: Sigma, color: "text-maths", tint: "bg-maths/12", span: "" },
  { name: "Economics", sinhala: "ආර්ථික විද්‍යාව", icon: LineChart, color: "text-economics", tint: "bg-economics/12", span: "" },
  { name: "Buddhism", sinhala: "බුද්ධ ධර්මය", icon: Flower2, color: "text-buddhism", tint: "bg-buddhism/12", span: "lg:col-span-3" },
];

const STEPS = [
  { icon: ClipboardList, step: "01", title: "Pre-Quiz Diagnostic", desc: "A smart quiz maps your existing knowledge baseline.", color: "text-physics" },
  { icon: Sparkles, step: "02", title: "Dynamic AI Lesson", desc: "Avatar teaches in Sinhala, adjusting depth in real-time.", color: "text-biology" },
  { icon: MessageSquareText, step: "03", title: "Interactive Q&A", desc: "Ask questions naturally and get instant personalized answers.", color: "text-maths" },
  { icon: Trophy, step: "04", title: "Post-Quiz Mastery", desc: "Confirm mastery and unlock your next adaptive journey.", color: "text-economics" },
];

const WHY_CHOOSE = [
  { icon: Bot, title: "Personalized AI Avatar", desc: "A lifelike Sinhala-speaking teacher who adapts explanations to how you personally learn.", color: "text-physics" },
  { icon: BrainCircuit, title: "Hybrid BKT + LSTM Engine", desc: "Predicts what you know and what you don't, recalibrating difficulty after every answer.", color: "text-biology" },
  { icon: Mic2, title: "Native Sinhala Voice", desc: "Every lesson is narrated in natural, synthesized Sinhala — no translation friction.", color: "text-chemistry" },
  { icon: Zap, title: "Instant Q&A", desc: "Ask your Avatar anything mid-lesson and get an immediate, personalized answer.", color: "text-maths" },
  { icon: TrendingUp, title: "Real Progress Tracking", desc: "Mastery scores per topic so you always know exactly what to revise next.", color: "text-economics" },
  { icon: Gamepad2, title: "Gamified Quizzes", desc: "Pre- and post-quizzes turn every lesson into a quick, rewarding challenge.", color: "text-buddhism" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [videoErrored, setVideoErrored] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="theme-aiguru relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="glow-ambient absolute -left-40 top-10 h-96 w-96 rounded-full bg-primary/25 blur-[140px]" />
        <div className="glow-ambient absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-[160px]" />
        <div className="glow-ambient absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-maths/20 blur-[150px]" />
      </div>

      {/* Navbar */}
      <header className="fixed inset-x-0 top-4 z-50 px-4">
        <nav
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 transition-all duration-500 bg-white shadow-lg`}
        >
          <a href="#home" className="flex items-center gap-3 pl-2 text-black">
            <img src="/logo.png" alt="SUBHASHA" className="h-9 w-auto object-contain" />
            <span className="font-display text-lg font-bold tracking-tight">SUBHASHA</span>
          </a>

          <div className="hidden items-center md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-full px-5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-black"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Link href="/admin/login" className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-black transition-colors">
              Teacher
            </Link>
            <Link
              href="/login"
              className="group flex items-center gap-1.5 rounded-full bg-[image:var(--gradient-hero)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03]"
            >
              Sign in
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="rounded-full bg-gray-100 p-2.5 text-black md:hidden hover:bg-gray-200 transition-colors"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="bg-white mx-auto mt-3 max-w-6xl rounded-3xl p-3 md:hidden shadow-xl border border-gray-100"
            >
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-2xl px-5 py-3.5 text-base font-semibold text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/admin/login"
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl px-5 py-3.5 text-base font-semibold text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
              >
                Teacher
              </Link>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="mt-2 block rounded-2xl bg-[image:var(--gradient-hero)] px-5 py-3.5 text-center text-base font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <section id="home" className="relative flex min-h-[100svh] items-center overflow-hidden">
        <div className="absolute inset-0">
          {!videoErrored ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              onError={() => setVideoErrored(true)}
              className="h-full w-full object-cover [filter:brightness(0.95)_contrast(1.05)_saturate(1.2)]"
            >
              <source src={HERO_VIDEO_SRC} type="video/mp4" />
            </video>
          ) : (
            <div className="h-full w-full bg-[image:var(--gradient-surface)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/20 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/75 via-background/25 to-transparent" />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative mx-auto w-full max-w-6xl px-2 sm:px-6 pt-32 pb-20"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Sri Lanka&apos;s First AI Avatar Teacher
          </motion.div>

          <motion.h1 variants={fadeUp} className="mt-6 max-w-4xl text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
            Master Your Subjects with{" "}
            <span className="text-gradient">Perfect AI Precision.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-6 max-w-xl text-lg text-muted-foreground">
            Personalized Sinhala medium education powered by advanced predictive AI. Experience the
            future of learning where the curriculum adapts to you.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/select-role"
              className="group flex h-14 items-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-8 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03]"
            >
              <Sparkles className="h-5 w-5" />
              SUBHASHA — Sinhala AI Avatar Teacher
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#subjects"
              className="flex h-14 items-center gap-3 rounded-full border border-border bg-secondary/40 px-8 text-base font-semibold backdrop-blur-md transition-colors hover:bg-secondary/70"
            >
              <PlayCircle className="h-5 w-5 text-accent" />
              Subjects
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="relative mx-auto -mt-10 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {STATS.map(({ icon: Icon, label, sub, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="surface-card flex items-center gap-4 rounded-3xl p-5 transition-shadow hover:shadow-[var(--shadow-glow)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary/70">
                <Icon className={`h-6 w-6 ${color}`} />
              </span>
              <div>
                <p className="font-display text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Subjects */}
      <section id="subjects" className="mx-auto max-w-6xl px-4 sm:px-6 py-28">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="max-w-2xl">
          <h2 className="text-4xl font-bold sm:text-5xl">
            Learn Every Subject, <span className="text-gradient">Your Way</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            A dedicated AI Avatar for every subject on the syllabus — taught entirely in Sinhala
            medium with unparalleled personalization.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map(({ name, sinhala, icon: Icon, color, tint, span }) => (
            <div key={name} className={`${span}`}>
              <GlareCard>
                <motion.article
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`group surface-card relative overflow-hidden rounded-[1.75rem] p-7 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-glow)] h-full w-full`}
                >
                  <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full ${tint} blur-2xl transition-opacity group-hover:opacity-100 opacity-70`} />
                  <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${tint}`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </span>
                  <h3 className="relative mt-6 text-2xl font-bold">{name}</h3>
                  <p className="relative mt-1 text-sm text-muted-foreground">{sinhala}</p>
                  <span className={`relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                    Explore Lessons
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </motion.article>
              </GlareCard>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative border-y border-border/20 bg-secondary/20 py-28 overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.3em] text-accent">THE PROCESS</p>
          <h2 className="mt-4 text-4xl font-bold sm:text-5xl">
            How <span className="text-gradient">Subhasha</span> Works
          </h2>

          <div className="mt-14">
            <InfiniteMovingCards
              items={STEPS}
              direction="left"
              speed="fast"
              renderItem={({ icon: Icon, step, title, desc, color }) => (
                <div className="surface-card rounded-[1.75rem] p-7 h-full flex flex-col justify-start">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/70">
                      <Icon className={`h-6 w-6 ${color}`} />
                    </span>
                    <span className="font-display text-3xl font-bold text-muted-foreground/25">{step}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              )}
            />
          </div>
        </div>
      </section>

      {/* Why choose */}
      <section id="about" className="mx-auto max-w-6xl px-4 sm:px-6 py-28">
        <h2 className="max-w-2xl text-4xl font-bold sm:text-5xl">
          Everything You Need to <span className="text-gradient">Succeed</span>
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_CHOOSE.map(({ icon: Icon, title, desc, color }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="surface-card rounded-[1.75rem] p-7 transition-transform hover:-translate-y-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/70">
                <Icon className={`h-6 w-6 ${color}`} />
              </span>
              <h3 className="mt-6 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-28">
        <div className="surface-card relative overflow-hidden rounded-[2.5rem] px-8 py-20 text-center">
          <div className="glow-ambient pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/35 blur-[120px]" />
          <div className="glow-ambient pointer-events-none absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-accent/30 blur-[120px]" />
          <h2 className="relative text-4xl font-bold sm:text-5xl">Ready to Learn Smarter?</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
            Join Subhasha today. Let your personal Avatar teacher guide you to mastery — in Sinhala,
            at your perfect pace.
          </p>
          <div className="relative mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/select-role"
              className="flex h-14 items-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-8 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03]"
            >
              <Sparkles className="h-5 w-5" />
              SUBHASHA — Sinhala AI Avatar Teacher
            </Link>
            <Link
              href="/login"
              className="flex h-14 items-center rounded-full border border-border bg-secondary/40 px-8 text-base font-semibold hover:bg-secondary/70"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Subhasha" className="h-9 w-auto object-contain" />
              <span className="font-display text-lg font-bold">Subhasha</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Sri Lanka&apos;s first AI Avatar teaching platform. Revolutionizing Sinhala medium
              education with predictive, personalized artificial intelligence.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Subhasha. All rights reserved.</p>
            <p className="mt-2 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-accent" />
              Built with Hybrid PC-BKT + LSTM Engine
            </p>
          </div>
        </div>
      </footer>

      {/* Demo modal */}
      <AnimatePresence>
        {demoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDemoOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="surface-card relative w-full max-w-4xl overflow-hidden rounded-[2rem] shadow-[var(--shadow-glow)]"
            >
              <button
                onClick={() => setDemoOpen(false)}
                aria-label="Close demo"
                className="absolute right-5 top-5 z-10 rounded-full bg-background/60 p-3 backdrop-blur-md hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
              {!videoErrored ? (
                <video src={HERO_VIDEO_SRC} controls autoPlay className="aspect-video w-full" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
                  Demo video unavailable.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
