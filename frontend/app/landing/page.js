"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Rocket,
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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Hero background video
// ---------------------------------------------------------------------------
// TODO: Replace with the Higgsfield-generated hero clip once credits are
// topped up. The Higgsfield MCP generation request for this section was:
//   "A cinematic, futuristic 3D animation of a friendly, highly realistic AI
//    female teacher avatar standing in a high-tech glowing classroom.
//    Holographic glowing symbols of physics, math, and chemistry are
//    floating in the air around her. Deep navy blue and dark space
//    background with electric blue and emerald green glowing neon accents.
//    Soft, cinematic studio lighting, slow and smooth camera pan, 4k
//    resolution, hyperrealistic, seamless loop."
// It could not run because the connected Higgsfield workspace was out of
// credits at build time — this is a stand-in clip so the layout is fully
// functional in the meantime.
const HERO_VIDEO_SRC =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

// ---------------------------------------------------------------------------
// Content data
// ---------------------------------------------------------------------------
const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Subjects", href: "#subjects" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

const STATS = [
  {
    icon: BrainCircuit,
    label: "Powered by Hybrid PC-BKT + LSTM AI",
    sub: "Real-time predictive difficulty engine",
    color: "text-blue-400",
    glow: "shadow-[0_0_30px_rgba(59,130,246,0.25)]",
  },
  {
    icon: Mic2,
    label: "Sinhala Voice Synthesized",
    sub: "Natural, native-medium narration",
    color: "text-emerald-400",
    glow: "shadow-[0_0_30px_rgba(52,211,153,0.25)]",
  },
  {
    icon: Gauge,
    label: "Adapts to You in Real-Time",
    sub: "Every lesson recalibrates as you learn",
    color: "text-purple-400",
    glow: "shadow-[0_0_30px_rgba(192,132,252,0.25)]",
  },
];

const SUBJECTS = [
  {
    name: "Physics",
    sinhala: "භෞතික විද්‍යාව",
    icon: Atom,
    from: "from-blue-500",
    to: "to-blue-700",
    ring: "hover:shadow-[0_0_45px_rgba(59,130,246,0.45)]",
    border: "border-blue-400/30",
    span: "lg:col-span-2 lg:row-span-1",
  },
  {
    name: "Chemistry",
    sinhala: "රසායන විද්‍යාව",
    icon: FlaskConical,
    from: "from-cyan-400",
    to: "to-cyan-600",
    ring: "hover:shadow-[0_0_45px_rgba(34,211,238,0.45)]",
    border: "border-cyan-400/30",
    span: "lg:col-span-1",
  },
  {
    name: "Biology",
    sinhala: "ජීව විද්‍යාව",
    icon: Dna,
    from: "from-emerald-400",
    to: "to-emerald-600",
    ring: "hover:shadow-[0_0_45px_rgba(52,211,153,0.45)]",
    border: "border-emerald-400/30",
    span: "lg:col-span-1",
  },
  {
    name: "Maths",
    sinhala: "ගණිතය",
    icon: Sigma,
    from: "from-purple-500",
    to: "to-purple-700",
    ring: "hover:shadow-[0_0_45px_rgba(168,85,247,0.45)]",
    border: "border-purple-400/30",
    span: "lg:col-span-1",
  },
  {
    name: "Economics",
    sinhala: "ආර්ථික විද්‍යාව",
    icon: LineChart,
    from: "from-orange-400",
    to: "to-orange-600",
    ring: "hover:shadow-[0_0_45px_rgba(251,146,60,0.45)]",
    border: "border-orange-400/30",
    span: "lg:col-span-1",
  },
  {
    name: "Buddhism",
    sinhala: "බුද්ධ ධර්මය",
    icon: Flower2,
    from: "from-fuchsia-500",
    to: "to-pink-600",
    ring: "hover:shadow-[0_0_45px_rgba(232,121,249,0.45)]",
    border: "border-fuchsia-400/30",
    span: "lg:col-span-3",
    banner: true,
  },
];

const STEPS = [
  {
    icon: ClipboardList,
    step: "01",
    title: "Pre-Quiz Diagnostic",
    desc: "A short adaptive quiz maps what you already know before the lesson starts.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-400/30",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "Dynamic AI Lesson",
    desc: "The Avatar teaches in Sinhala, adjusting pace and depth via BKT-LSTM in real time.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-400/30",
  },
  {
    icon: MessageSquareText,
    step: "03",
    title: "Interactive Q&A",
    desc: "Ask questions naturally and get instant, personalized answers from your Avatar.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-400/30",
  },
  {
    icon: Trophy,
    step: "04",
    title: "Post-Quiz Mastery",
    desc: "A final assessment confirms mastery and unlocks your next adaptive lesson.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-400/30",
  },
];

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [videoErrored, setVideoErrored] = useState(false);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#0f172a] text-slate-100 selection:bg-blue-500/40">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-purple-600/15 blur-[120px]" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Navbar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <header className="fixed top-0 z-50 w-full">
        <div className="mx-auto mt-4 max-w-6xl px-4">
          <nav className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <a href="#home" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-400 shadow-[0_0_20px_rgba(37,99,235,0.5)]">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                AI Guru
              </span>
            </a>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:block">
              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-shadow hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]"
                >
                  Start Learning
                </motion.button>
              </Link>
            </div>

            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="text-slate-200 md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </nav>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:hidden"
              >
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
                <Link href="/signup" onClick={() => setMenuOpen(false)}>
                  <button className="mt-2 w-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 px-5 py-2 text-sm font-semibold text-white">
                    Start Learning
                  </button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="home"
        className="relative flex min-h-screen items-center px-4 pt-32 pb-20"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
          {/* Text column */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeUp}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Sri Lanka&apos;s First AI Avatar Teacher
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              Master Your Subjects with{" "}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                Sri Lanka&apos;s First AI Avatar Teacher
              </span>
              .
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400"
            >
              Personalized Sinhala medium education powered by advanced
              predictive AI. Watch the avatar teach you in real-time.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-9 flex flex-wrap items-center gap-4"
            >
              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  animate={{
                    boxShadow: [
                      "0 0 20px rgba(37,99,235,0.45)",
                      "0 0 38px rgba(52,211,153,0.55)",
                      "0 0 20px rgba(37,99,235,0.45)",
                    ],
                  }}
                  transition={{
                    boxShadow: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 px-7 py-3.5 text-base font-semibold text-white"
                >
                  <Rocket className="h-5 w-5" />
                  Start Your Journey
                </motion.button>
              </Link>

              <motion.button
                onClick={() => setDemoOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-base font-semibold text-slate-200 backdrop-blur-md transition-colors hover:bg-white/10"
              >
                <PlayCircle className="h-5 w-5" />
                Watch Demo
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Video column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_0_40px_rgba(37,99,235,0.3)] backdrop-blur-xl">
              {!videoErrored ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={() => setVideoErrored(true)}
                  className="aspect-video w-full object-cover"
                >
                  <source src={HERO_VIDEO_SRC} type="video/mp4" />
                </video>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-950 via-slate-900 to-emerald-950">
                  <BrainCircuit className="h-14 w-14 text-blue-400" />
                  <p className="px-6 text-center text-sm text-slate-400">
                    Hero video preview unavailable — generate it via Higgsfield
                    and drop the URL into{" "}
                    <code className="text-blue-300">HERO_VIDEO_SRC</code>.
                  </p>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
            </div>

            {/* Floating badges */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-6 -top-6 hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 backdrop-blur-xl sm:flex"
            >
              <BrainCircuit className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold text-white">
                BKT-LSTM Engine
              </span>
            </motion.div>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-6 -right-4 hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 backdrop-blur-xl sm:flex"
            >
              <Mic2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">
                Sinhala Voice AI
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Stats bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerContainer}
        className="relative px-4 py-8"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-3">
          {STATS.map(({ icon: Icon, label, sub, color, glow }) => (
            <motion.div
              key={label}
              variants={fadeUp}
              whileHover={{ scale: 1.03, y: -4 }}
              className={`flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-shadow ${glow}`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5">
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------ */}
      {/* Subjects Bento Grid                                                */}
      {/* ------------------------------------------------------------------ */}
      <section id="subjects" className="relative px-4 py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="mb-14 text-center"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
            >
              Learn Every Subject,{" "}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Your Way
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-xl text-slate-400">
              A dedicated AI Avatar for every subject on the syllabus — taught
              entirely in Sinhala medium.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {SUBJECTS.map((subj) => (
              <motion.div
                key={subj.name}
                variants={fadeUp}
                whileHover={{ scale: 1.03, y: -6 }}
                className={`group relative overflow-hidden rounded-3xl border ${subj.border} bg-white/5 p-7 backdrop-blur-xl transition-shadow duration-300 ${subj.ring} ${subj.span} ${
                  subj.banner ? "flex flex-col items-center text-center sm:col-span-2" : ""
                }`}
              >
                <div
                  className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${subj.from} ${subj.to} opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40`}
                />
                <div
                  className={`relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${subj.from} ${subj.to} shadow-lg`}
                >
                  <subj.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="relative text-xl font-bold text-white">
                  {subj.name}
                </h3>
                <p className="relative mt-1 text-sm text-slate-400">
                  {subj.sinhala}
                </p>
                <div className="relative mt-5 flex items-center gap-1 text-sm font-medium text-slate-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Explore lessons
                  <ArrowRight className="h-4 w-4" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How It Works                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works" className="relative px-4 py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="mb-16 text-center"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
            >
              How{" "}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                AI Guru
              </span>{" "}
              Works
            </motion.h2>
            <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-xl text-slate-400">
              Four adaptive steps, powered by the Hybrid PC-BKT + LSTM engine.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={staggerContainer}
            className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="pointer-events-none absolute top-14 left-0 hidden h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block" />
            {STEPS.map(({ icon: Icon, step, title, desc, color, bg, border }) => (
              <motion.div
                key={step}
                variants={fadeUp}
                whileHover={{ scale: 1.04, y: -5 }}
                className={`relative rounded-2xl border ${border} bg-white/5 p-6 backdrop-blur-xl`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-xl border ${border} ${bg}`}
                >
                  <Icon className={`h-7 w-7 ${color}`} />
                </div>
                <span className="mt-4 block text-xs font-bold tracking-widest text-slate-500">
                  STEP {step}
                </span>
                <h3 className="mt-1 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Final CTA banner                                                   */}
      {/* ------------------------------------------------------------------ */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeUp}
        className="relative px-4 py-20"
      >
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/20 via-white/5 to-emerald-500/20 p-12 text-center backdrop-blur-xl">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Ready to Learn Smarter?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-300">
            Join AI Guru and let your personal Avatar teacher guide you to
            mastery — in Sinhala, at your pace.
          </p>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_rgba(37,99,235,0.5)]"
            >
              <Rocket className="h-5 w-5" />
              Start Your Journey
            </motion.button>
          </Link>
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer id="about" className="relative border-t border-white/10 px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-10 sm:flex-row">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-400">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">AI Guru</span>
              </div>
              <p className="mt-4 max-w-xs text-sm text-slate-400">
                Sri Lanka&apos;s first AI Avatar teaching platform — Sinhala
                medium education, personalized by predictive AI.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold text-white">Platform</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li><a href="#subjects" className="hover:text-white">Subjects</a></li>
                  <li><a href="#how-it-works" className="hover:text-white">How It Works</a></li>
                  <li><Link href="/login" className="hover:text-white">Login</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Company</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li><a href="#about" className="hover:text-white">About</a></li>
                  <li><a href="#" className="hover:text-white">Contact</a></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Legal</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li><a href="#" className="hover:text-white">Privacy</a></li>
                  <li><a href="#" className="hover:text-white">Terms</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
            <p>© {new Date().getFullYear()} AI Guru. All rights reserved.</p>
            <p>Built with the Hybrid PC-BKT + LSTM Adaptive Engine.</p>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------------------------ */}
      {/* Demo video modal                                                   */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {demoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDemoOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-[0_0_60px_rgba(37,99,235,0.35)]"
            >
              <button
                onClick={() => setDemoOpen(false)}
                className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur-md hover:bg-white/20"
                aria-label="Close demo"
              >
                <X className="h-5 w-5" />
              </button>
              {!videoErrored ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  className="aspect-video w-full"
                >
                  <source src={HERO_VIDEO_SRC} type="video/mp4" />
                </video>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-slate-400">
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
