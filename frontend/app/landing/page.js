"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useMotionTemplate } from "framer-motion";
import InteractiveParticles from "../../components/InteractiveParticles";
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
  Bot,
  Zap,
  TrendingUp,
  Gamepad2,
  LogIn,
  ChevronRight
} from "lucide-react";

// ---------------------------------------------------------------------------
// Hero background video
// ---------------------------------------------------------------------------
const HERO_VIDEO_SRC = "/videos/hero-bg.mp4";

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
    label: "Hybrid PC-BKT + LSTM",
    sub: "Real-time AI engine",
    color: "text-blue-400",
    glow: "group-hover:shadow-[0_0_40px_rgba(59,130,246,0.4)]",
  },
  {
    icon: Mic2,
    label: "Sinhala Voice Native",
    sub: "Natural AI narration",
    color: "text-emerald-400",
    glow: "group-hover:shadow-[0_0_40px_rgba(52,211,153,0.4)]",
  },
  {
    icon: Gauge,
    label: "Real-Time Adaptive",
    sub: "Recalibrates instantly",
    color: "text-purple-400",
    glow: "group-hover:shadow-[0_0_40px_rgba(192,132,252,0.4)]",
  },
];

const SUBJECTS = [
  {
    name: "Physics",
    sinhala: "භෞතික විද්‍යාව",
    icon: Atom,
    from: "from-blue-600",
    to: "to-blue-900",
    accent: "text-blue-400",
    ring: "hover:shadow-[0_0_50px_rgba(59,130,246,0.3)]",
    border: "border-blue-500/20",
    span: "lg:col-span-2 lg:row-span-1",
  },
  {
    name: "Chemistry",
    sinhala: "රසායන විද්‍යාව",
    icon: FlaskConical,
    from: "from-cyan-500",
    to: "to-cyan-800",
    accent: "text-cyan-400",
    ring: "hover:shadow-[0_0_50px_rgba(34,211,238,0.3)]",
    border: "border-cyan-500/20",
    span: "lg:col-span-1",
  },
  {
    name: "Biology",
    sinhala: "ජීව විද්‍යාව",
    icon: Dna,
    from: "from-emerald-500",
    to: "to-emerald-800",
    accent: "text-emerald-400",
    ring: "hover:shadow-[0_0_50px_rgba(52,211,153,0.3)]",
    border: "border-emerald-500/20",
    span: "lg:col-span-1",
  },
  {
    name: "Maths",
    sinhala: "ගණිතය",
    icon: Sigma,
    from: "from-purple-500",
    to: "to-purple-900",
    accent: "text-purple-400",
    ring: "hover:shadow-[0_0_50px_rgba(168,85,247,0.3)]",
    border: "border-purple-500/20",
    span: "lg:col-span-1",
  },
  {
    name: "Economics",
    sinhala: "ආර්ථික විද්‍යාව",
    icon: LineChart,
    from: "from-orange-500",
    to: "to-orange-800",
    accent: "text-orange-400",
    ring: "hover:shadow-[0_0_50px_rgba(251,146,60,0.3)]",
    border: "border-orange-500/20",
    span: "lg:col-span-1",
  },
  {
    name: "Buddhism",
    sinhala: "බුද්ධ ධර්මය",
    icon: Flower2,
    from: "from-rose-500",
    to: "to-rose-900",
    accent: "text-rose-400",
    ring: "hover:shadow-[0_0_50px_rgba(244,63,94,0.3)]",
    border: "border-rose-500/20",
    span: "lg:col-span-3",
    banner: true,
  },
];

const STEPS = [
  {
    icon: ClipboardList,
    step: "01",
    title: "Pre-Quiz Diagnostic",
    desc: "A smart quiz maps your existing knowledge baseline.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "Dynamic AI Lesson",
    desc: "Avatar teaches in Sinhala, adjusting depth in real-time.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    icon: MessageSquareText,
    step: "03",
    title: "Interactive Q&A",
    desc: "Ask questions naturally and get instant personalized answers.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    icon: Trophy,
    step: "04",
    title: "Post-Quiz Mastery",
    desc: "Confirm mastery and unlock your next adaptive journey.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
];

const WHY_CHOOSE = [
  {
    icon: Bot,
    title: "Personalized AI Avatar",
    desc: "A lifelike Sinhala-speaking teacher who adapts explanations to how you personally learn.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: BrainCircuit,
    title: "Hybrid BKT + LSTM Engine",
    desc: "Predicts what you know and what you don't, recalibrating difficulty after every answer.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    icon: Mic2,
    title: "Native Sinhala Voice",
    desc: "Every lesson is narrated in natural, synthesized Sinhala — no translation friction.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  {
    icon: Zap,
    title: "Instant Q&A",
    desc: "Ask your Avatar anything mid-lesson and get an immediate, personalized answer.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    icon: TrendingUp,
    title: "Real Progress Tracking",
    desc: "Mastery scores per topic so you always know exactly what to revise next.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: Gamepad2,
    title: "Gamified Quizzes",
    desc: "Pre- and post-quizzes turn every lesson into a quick, rewarding challenge.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
  },
];

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [videoErrored, setVideoErrored] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 1000], [0, 300]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  // Mouse tracking for spotlight effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Scroll detection for navbar
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle CSS for the animated gradient text & navbar glow
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes gradient-x {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .animate-gradient-x {
        background-size: 200% 200%;
        animation: gradient-x 8s ease infinite;
      }
      @keyframes border-glow {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.8; }
      }
      .animate-border-glow {
        animation: border-glow 3s ease-in-out infinite;
      }
      @keyframes logo-pulse {
        0%, 100% { box-shadow: 0 0 15px rgba(59,130,246,0.4), 0 0 30px rgba(52,211,153,0.2); }
        50% { box-shadow: 0 0 25px rgba(59,130,246,0.6), 0 0 50px rgba(52,211,153,0.4); }
      }
      .animate-logo-pulse {
        animation: logo-pulse 3s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#050505] text-slate-100 selection:bg-blue-500/30">
      
      {/* Interactive Mouse Spotlight */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.06), transparent 40%)`
        }}
      />

      {/* Premium ambient glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[50rem] w-[50rem] rounded-full bg-blue-900/20 blur-[150px] mix-blend-screen" />
        <div className="absolute top-[20%] -right-[10%] h-[40rem] w-[40rem] rounded-full bg-emerald-900/15 blur-[120px] mix-blend-screen" />
        <div className="absolute -bottom-[20%] left-[20%] h-[60rem] w-[60rem] rounded-full bg-purple-900/15 blur-[150px] mix-blend-screen" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Minimalist Dark Pill Navbar                                        */}
      {/* ------------------------------------------------------------------ */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 z-50 w-full flex justify-center pt-5 px-4"
      >
        <div className="relative w-[98%] max-w-[2000px]">
          <nav className="relative flex items-center justify-between gap-8 rounded-[3rem] bg-[#111111] px-6 py-5 shadow-2xl transition-all duration-500">
            {/* Logo */}
            <Link href="/landing" className="flex items-center gap-4 pl-4 group relative z-10 shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-[0.6rem] bg-white transition-transform duration-300 group-hover:scale-105">
                <Sparkles className="h-5 w-5 text-black" strokeWidth={2.5} />
              </div>
              <span className="text-[1.2rem] font-bold tracking-tight text-white">
                AI Guru
              </span>
            </Link>

            {/* Desktop Links with Magic Indicator */}
            <div 
              className="hidden items-center gap-4 md:flex relative z-10"
              onMouseLeave={() => setHoveredNav(null)}
            >
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onMouseEnter={() => setHoveredNav(link.label)}
                  className="relative px-6 py-2.5 text-[1rem] font-medium text-white/70 transition-colors hover:text-white"
                >
                  <span className="relative z-20">{link.label}</span>
                  {hoveredNav === link.label && (
                    <motion.div
                      layoutId="navHover"
                      className="absolute inset-0 -z-10 rounded-full bg-white/10"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                </a>
              ))}
            </div>

            {/* Right side buttons */}
            <div className="hidden items-center gap-4 md:flex relative z-10">
              <Link href="/login">
                <button className="px-4 py-2 text-[1.05rem] font-medium text-white/70 transition-colors hover:text-white">
                  Sign in
                </button>
              </Link>
              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 p-[2px] font-bold text-black shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all hover:shadow-[0_0_30px_rgba(52,211,153,0.6)]"
                >
                  <span className="relative z-10 flex h-full w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3 transition-colors group-hover:bg-transparent group-hover:text-white">
                    Get Started
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </motion.button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="relative z-10 md:hidden p-3 rounded-full bg-white/5 text-slate-200 hover:bg-white/10 transition-colors mr-2"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </nav>

          {/* Mobile Menu Dropdown */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ type: "spring", bounce: 0.3 }}
                className="absolute top-full left-0 right-0 mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]/95 p-4 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] md:hidden"
              >
                <div className="flex flex-col gap-1">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-2xl px-5 py-4 text-base font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                    >
                      {link.label}
                    </a>
                  ))}
                  <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    <button className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base font-bold text-white hover:bg-white/10 transition-all active:scale-95">
                      Log In
                    </button>
                  </Link>
                  <Link href="/signup" onClick={() => setMenuOpen(false)}>
                    <button className="mt-2 w-full rounded-2xl bg-white px-5 py-4 text-base font-bold text-black shadow-lg active:scale-95">
                      Get Started Free
                    </button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero Section                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="home"
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-32 pb-24"
      >
        {/* Parallax Background Video */}
        <motion.div 
          style={{ y: heroY, opacity: heroOpacity }}
          className="absolute inset-0 z-0 origin-top"
        >
          {!videoErrored ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              onError={() => setVideoErrored(true)}
              className="h-full w-full object-cover [filter:brightness(0.85)_contrast(1.1)_saturate(1.2)]"
            >
              <source src={HERO_VIDEO_SRC} type="video/mp4" />
            </video>
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-[#050505] to-[#0a0a1a]" />
          )}
          {/* Balanced Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/90 via-[#050505]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-90" />
          {/* Balanced Radial vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#050505_100%)] opacity-60" />
        </motion.div>

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-8 inline-flex items-center gap-3 rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-2 text-sm font-semibold text-blue-300 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.2)]"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              Sri Lanka&apos;s First AI Avatar Teacher
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
              Master Your Subjects with{" "}
              <span className="animate-gradient-x bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                Perfect AI Precision.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              className="mt-8 max-w-2xl text-xl leading-relaxed text-slate-300 font-medium"
            >
              Personalized Sinhala medium education powered by advanced
              predictive AI. Experience the future of learning where the curriculum adapts to you.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
              className="mt-10 flex flex-wrap items-center gap-5"
            >
              <Link href="/signup">
                <button className="group relative flex h-14 items-center gap-3 rounded-full bg-white px-8 text-base font-bold text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                  <Rocket className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                  Start Your Journey
                  <div className="absolute inset-0 rounded-full border border-white/50 mix-blend-overlay" />
                </button>
              </Link>

              <button
                onClick={() => setDemoOpen(true)}
                className="group flex h-14 items-center gap-3 rounded-full border border-white/20 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
                  <PlayCircle className="h-5 w-5" />
                </div>
                Watch Demo
              </button>
            </motion.div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute right-[10%] top-[30%] z-0 hidden lg:block animate-pulse duration-3000">
          <div className="h-32 w-32 rounded-full bg-gradient-to-tr from-blue-500/20 to-emerald-500/20 blur-[50px]" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Stats bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        variants={staggerContainer}
        className="relative z-20 mx-auto -mt-24 max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STATS.map(({ icon: Icon, label, sub, color, glow }, i) => (
            <motion.div
              key={label}
              variants={fadeUp}
              className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]/80 p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:bg-[#111111]/90 ${glow}`}
            >
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-2xl transition-all duration-500 group-hover:bg-white/10" />
              <div className="relative z-10 flex items-center gap-5">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-inner`}>
                  <Icon className={`h-8 w-8 ${color} transition-transform duration-300 group-hover:scale-110`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{label}</p>
                  <p className="mt-1 text-sm text-slate-400">{sub}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------ */}
      {/* Subjects Bento Grid                                                */}
      {/* ------------------------------------------------------------------ */}
      <section id="subjects" className="relative px-4 py-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Learn Every Subject,{" "}
              <span className="animate-gradient-x bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Your Way
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              A dedicated AI Avatar for every subject on the syllabus — taught
              entirely in Sinhala medium with unparalleled personalization.
            </p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[280px]"
          >
            {SUBJECTS.map((subj) => (
              <motion.div
                key={subj.name}
                variants={fadeUp}
                className={`group relative overflow-hidden rounded-[2.5rem] border ${subj.border} bg-[#0a0a0a]/60 p-10 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:bg-[#111111]/80 ${subj.ring} ${subj.span} ${
                  subj.banner ? "flex flex-col sm:flex-row items-center justify-between gap-8 sm:col-span-2 lg:col-span-3" : "flex flex-col"
                }`}
              >
                {/* Dynamic Background Gradients */}
                <div className={`absolute inset-0 bg-gradient-to-br ${subj.from} ${subj.to} opacity-0 transition-opacity duration-500 group-hover:opacity-10`} />
                <div className={`absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br ${subj.from} ${subj.to} opacity-10 blur-[80px] transition-all duration-500 group-hover:opacity-30 group-hover:scale-150`} />
                
                <div className={`${subj.banner ? "text-left" : ""}`}>
                  <div className={`relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${subj.from} ${subj.to} shadow-lg ring-1 ring-white/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                    <subj.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="relative text-3xl font-bold text-white tracking-tight">
                    {subj.name}
                  </h3>
                  <p className={`relative mt-2 text-base font-medium ${subj.accent}`}>
                    {subj.sinhala}
                  </p>
                </div>
                
                <div className={`relative mt-auto flex items-center gap-2 text-sm font-bold text-white opacity-0 transition-all duration-500 group-hover:opacity-100 ${subj.banner ? 'mt-0' : 'translate-y-4 group-hover:translate-y-0'}`}>
                  <span className="bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-2 hover:bg-white/20 transition-colors cursor-pointer">
                    Explore Lessons
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How It Works                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works" className="relative px-4 py-32 sm:px-6 lg:px-8 bg-[#020202]">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
        <div className="mx-auto max-w-7xl relative z-10">
          <div className="mb-24 text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-bold tracking-widest mb-4">THE PROCESS</span>
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              How{" "}
              <span className="animate-gradient-x bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                AI Guru
              </span>{" "}
              Works
            </h2>
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="relative grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4"
          >
            {/* Connecting line for desktop */}
            <div className="pointer-events-none absolute top-12 left-10 hidden h-0.5 w-[calc(100%-5rem)] bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-amber-500/20 lg:block" />
            
            {STEPS.map(({ icon: Icon, step, title, desc, color, bg, border }, i) => (
              <motion.div
                key={step}
                variants={fadeUp}
                className="relative group"
              >
                <div className={`relative z-10 mx-auto lg:mx-0 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-xl transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_0_40px_rgba(255,255,255,0.1)]`}>
                  <div className={`absolute inset-0 rounded-3xl opacity-20 transition-opacity duration-500 group-hover:opacity-40 ${bg}`} />
                  <Icon className={`relative z-20 h-10 w-10 ${color}`} />
                  <div className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white ring-4 ring-[#020202]">
                    {step}
                  </div>
                </div>
                <div className="mt-8 text-center lg:text-left">
                  <h3 className="text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-400">
                    {desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Why Choose Us                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative px-4 py-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Everything You Need to{" "}
              <span className="animate-gradient-x bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Succeed
              </span>
            </h2>
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {WHY_CHOOSE.map(({ icon: Icon, title, desc, color, bg, border }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                className={`group rounded-3xl border border-white/10 bg-[#0a0a0a]/50 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:bg-[#111111]/80 hover:border-white/20 hover:shadow-2xl`}
              >
                <div className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  <Icon className={`h-8 w-8 ${color}`} />
                </div>
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <p className="mt-3 text-base leading-relaxed text-slate-400">
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
      <section className="relative px-4 py-32 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mx-auto max-w-5xl overflow-hidden rounded-[3rem] border border-white/10 bg-[#0a0a0a] relative"
        >
          {/* Awesome inner glows */}
          <div className="absolute -top-[50%] -left-[10%] h-[100%] w-[50%] rounded-full bg-blue-600/30 blur-[100px]" />
          <div className="absolute -bottom-[50%] -right-[10%] h-[100%] w-[50%] rounded-full bg-emerald-600/30 blur-[100px]" />

          {/* Interactive constellation — dots link into a web around the
              cursor, mirroring the reference recording */}
          <InteractiveParticles
            className="absolute inset-0 opacity-80"
            color="#5eead4"
            particleCount={90}
            connectDistance={110}
            mouseRadius={170}
          />

          <div className="relative z-10 px-6 py-20 text-center sm:px-12 sm:py-24">
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Ready to Learn Smarter?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-slate-300">
              Join AI Guru today. Let your personal Avatar teacher guide you to
              mastery — in Sinhala, at your perfect pace.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link href="/signup">
                <button className="group relative flex h-14 items-center justify-center gap-3 rounded-full bg-white px-10 text-base font-bold text-black transition-all hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.2)] w-full sm:w-auto">
                  <Rocket className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                  Start Learning Free
                </button>
              </Link>
              <Link href="/login">
                <button className="flex h-14 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-10 text-base font-bold text-white backdrop-blur-md transition-all hover:bg-white/10 w-full sm:w-auto">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer id="about" className="relative border-t border-white/10 bg-[#050505] px-4 pt-20 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-400">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-white tracking-tight">AI Guru</span>
              </div>
              <p className="mt-6 max-w-sm text-base text-slate-400 leading-relaxed">
                Sri Lanka&apos;s first AI Avatar teaching platform. Revolutionizing Sinhala medium education with predictive, personalized artificial intelligence.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wider uppercase">Platform</h3>
                <ul className="mt-6 space-y-4 text-base text-slate-400">
                  <li><a href="#subjects" className="hover:text-white transition-colors">Subjects</a></li>
                  <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                  <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wider uppercase">Company</h3>
                <ul className="mt-6 space-y-4 text-base text-slate-400">
                  <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wider uppercase">Legal</h3>
                <ul className="mt-6 space-y-4 text-base text-slate-400">
                  <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/10 pt-8 text-sm text-slate-500 sm:flex-row">
            <p>© {new Date().getFullYear()} AI Guru. All rights reserved.</p>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Built with Hybrid PC-BKT + LSTM Engine
            </div>
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-[0_0_100px_rgba(37,99,235,0.4)] ring-1 ring-white/20"
            >
              <button
                onClick={() => setDemoOpen(false)}
                className="absolute right-6 top-6 z-10 rounded-full bg-black/50 p-3 text-white backdrop-blur-md hover:bg-white/20 transition-colors"
                aria-label="Close demo"
              >
                <X className="h-6 w-6" />
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
                <div className="flex aspect-video w-full items-center justify-center text-slate-400 bg-slate-950">
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
