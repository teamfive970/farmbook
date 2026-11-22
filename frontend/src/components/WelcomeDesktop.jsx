import {
  ArrowRight,
  CircleCheck,
  CloudOff,
  FileText,
  LogIn,
  NotebookPen,
  Package,
  PawPrint,
  QrCode as QrIcon,
  ShieldCheck,
  Smartphone,
  Sprout,
  TrendingUp,
  Users,
  Volume2,
  Wallet
} from "lucide-react";
import { Link } from "react-router-dom";
import Brand, { BrandMark } from "./Brand.jsx";
import { QrCode } from "./Choices.jsx";
import { SpeakButton, VoiceToggle } from "./Voice.jsx";
import { buttonClass } from "./ui.jsx";
import { WORDS } from "../lib/words.js";
import DemoAccessCard from "./DemoAccessCard.jsx";

// The welcome page on a computer screen (1024px and wider). The phone keeps
// its own simple welcome page; this one has room to show what the app does.

const FEATURES = [
  {
    Icon: NotebookPen,
    title: "Farm work, day by day",
    text: "Planting, weeding, spraying, feeding. Tap the pictures; no typing needed.",
    tone: "bg-emerald-50 text-emerald-700"
  },
  {
    Icon: Sprout,
    title: "Crops and animals",
    text: "Each planting and animal group has its own records, from the start to the harvest.",
    tone: "bg-lime-50 text-lime-700"
  },
  {
    Icon: Package,
    title: "Harvests and stock",
    text: "See what you harvested, what you sold and what is still in store.",
    tone: "bg-amber-50 text-amber-700"
  },
  {
    Icon: Wallet,
    title: "Money and profit",
    text: "Sales, income and expenses in L$ and US$, kept apart. Profit is worked out for you.",
    tone: "bg-sky-50 text-sky-700"
  },
  {
    Icon: QrIcon,
    title: "Harvest Passport",
    text: "A QR code and printed tag that show buyers where your crop came from.",
    tone: "bg-violet-50 text-violet-700"
  },
  {
    Icon: FileText,
    title: "Reports to share",
    text: "Save a clear farm report as PDF or for Excel, for your group, buyer or bank.",
    tone: "bg-rose-50 text-rose-700"
  }
];

const STEPS = [
  { title: "Make your account", text: "Your name, phone number and a secret PIN of 4 to 6 numbers." },
  { title: "Add your farm", text: "Pick what you grow or raise, and where the farm is." },
  { title: "Record as you work", text: "Work, harvests, sales and costs. It saves on the phone first." },
  { title: "See how you are doing", text: "Profit, harvest in store and reports, whenever you need them." }
];

const TRUST = [
  { Icon: CloudOff, text: "Works without network" },
  { Icon: Volume2, text: "Can read the words out loud" },
  { Icon: ShieldCheck, text: "Private: only you see your records" }
];

// A small picture of the app on a phone, drawn with HTML so it stays sharp.
function PhonePreview() {
  return (
    <div className="relative mx-auto w-[300px] xl:w-[330px]" aria-hidden="true">
      <div className="rounded-[2.6rem] border-[10px] border-ink bg-ink shadow-[0_40px_80px_-30px_rgba(20,83,45,0.6)]">
        <div className="overflow-hidden rounded-[2rem] bg-canvas">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary-dark">
              <BrandMark /> FarmBok
            </span>
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">All sent</span>
          </div>
          <div className="space-y-2.5 px-4 pb-5">
            <p className="text-sm font-bold text-ink">Hello, Musu</p>
            <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-3 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">Today</p>
              <p className="mt-0.5 text-sm font-bold">What work did you do today?</p>
              <div className="mt-2 rounded-xl bg-white py-2 text-center text-xs font-bold text-primary-dark">
                + Record today's work
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                ["Income", "L$23,000", "text-success"],
                ["Expenses", "L$12,000", "text-rose-700"],
                ["Profit", "L$11,000", "text-success"]
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-xl bg-white p-2 shadow-card">
                  <p className="text-[9px] text-ink-soft">{label}</p>
                  <p className={`text-[11px] font-bold ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
            {[
              [Sprout, "Swamp farm", "Rice · Cassava", "bg-emerald-50 text-emerald-700"],
              [PawPrint, "Chicken pen", "44 chickens", "bg-orange-50 text-orange-700"]
            ].map(([Icon, name, line, tone]) => (
              <div key={name} className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-card">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
                  <Icon size={16} />
                </span>
                <span>
                  <span className="block text-xs font-bold text-ink">{name}</span>
                  <span className="block text-[10px] text-ink-soft">{line}</span>
                </span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-xl bg-amber-50 py-2.5 text-center text-[11px] font-bold text-amber-900">Harvest</div>
              <div className="rounded-xl bg-success/10 py-2.5 text-center text-[11px] font-bold text-success">What I sell</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards around the phone */}
      <div className="absolute -left-40 bottom-40 hidden w-52 2xl:-left-48 rounded-2xl bg-white p-3 shadow-float xl:block">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Smartphone size={16} />
          </span>
          <span>
            <span className="block text-xs font-bold text-ink">Saved on this phone</span>
            <span className="block text-[10px] text-ink-soft">Sends when network comes</span>
          </span>
        </div>
      </div>
      <div className="absolute -right-24 bottom-16 hidden w-44 2xl:-right-40 rounded-2xl bg-white p-3 shadow-float xl:block">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Harvest Passport</p>
        <div className="mt-1.5 flex items-center gap-2">
          <QrCode text="https://farmbok.example/p/LR-DEMO000001" size={54} />
          <span>
            <span className="block text-xs font-bold text-ink">Rice · Grade A</span>
            <span className="block text-[10px] text-ink-soft">Scan to check</span>
          </span>
        </div>
      </div>
      <div className="absolute -right-16 top-10 hidden items-center gap-2 rounded-full bg-white px-3 py-2 shadow-float xl:flex">
        <TrendingUp size={16} className="text-success" />
        <span className="text-xs font-bold text-ink">Profit L$11,000</span>
      </div>
    </div>
  );
}

export default function WelcomeDesktop() {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-8 py-4">
          <Brand to="/" size="lg" />
          <nav className="flex items-center gap-1 text-sm font-semibold text-ink-soft" aria-label="Page sections">
            <a href="#features" className="rounded-lg px-3 py-2 hover:bg-primary-soft hover:text-primary-dark">
              What it does
            </a>
            <a href="#how" className="rounded-lg px-3 py-2 hover:bg-primary-soft hover:text-primary-dark">
              How it works
            </a>
            <a href="#groups" className="rounded-lg px-3 py-2 hover:bg-primary-soft hover:text-primary-dark">
              For farmer groups
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <VoiceToggle compact />
            <Link to="/login" data-say={WORDS.haveAccount.say} className={buttonClass("secondary", "md")}>
              <LogIn size={16} aria-hidden="true" /> {WORDS.haveAccount.text}
            </Link>
            <Link to="/register" data-say={WORDS.newAccount.say} className={buttonClass("primary", "md")}>
              Get started <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <DemoAccessCard variant="strip" />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-primary-soft blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-40 h-[420px] w-[420px] rounded-full bg-amber-50 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-[1.15fr_1fr] items-center gap-16 px-8 pb-24 pt-16 xl:gap-24 xl:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3 py-1.5 text-xs font-bold text-primary-dark shadow-card">
              <Sprout size={14} aria-hidden="true" /> Made for smallholder farmers in Liberia
            </span>
            <h1
              className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-ink xl:text-6xl"
              data-say={WORDS.welcomeTitle.say}
            >
              Keep your farm records <span className="text-primary">on your phone.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              FarmBok helps you record your farm work, harvests, sales and costs, and see your profit. It works even
              when there is no network, and it can read the words out loud.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" data-say={WORDS.newAccount.say} className={buttonClass("primary", "lg", "px-7 text-lg")}>
                {WORDS.newAccount.text} <ArrowRight size={20} aria-hidden="true" />
              </Link>
              <Link to="/login" data-say={WORDS.haveAccount.say} className={buttonClass("secondary", "lg", "px-7 text-lg")}>
                {WORDS.haveAccount.text}
              </Link>
              <SpeakButton phrase={WORDS.welcomeTitle} />
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary shadow-card">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <PhonePreview />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-8 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">What it does</p>
            <h2 className="mt-2 text-3xl font-bold text-ink xl:text-4xl">Everything about your farm, in one place</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Simple pictures and big buttons on the phone. Clear pages and reports on a computer.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-5">
            {FEATURES.map(({ Icon, title, text, tone }) => (
              <article
                key={title}
                className="rounded-2xl border border-line bg-canvas/60 p-6 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-float"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>
                  <Icon size={24} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-8 py-20">
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-wider text-primary">How it works</p>
              <h2 className="mt-2 text-3xl font-bold text-ink xl:text-4xl">Start in a few minutes</h2>
            </div>
            <Link to="/register" className={buttonClass("primary", "md")}>
              {WORDS.newAccount.text} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ol className="mt-12 grid grid-cols-4 gap-5">
            {STEPS.map(({ title, text }, index) => (
              <li key={title} className="relative rounded-2xl bg-white p-6 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Farmer groups + call to action */}
      <section id="groups" className="mx-auto max-w-7xl scroll-mt-24 px-8 pb-20">
        <div className="grid grid-cols-[1.2fr_1fr] items-center gap-12 overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-12 text-white shadow-float">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              <Users size={14} aria-hidden="true" /> For farmer groups and cooperatives
            </span>
            <h2 className="mt-4 text-3xl font-bold leading-tight xl:text-4xl">Grow together with clear records</h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/80">
              Members keep their own records. The group sees totals for harvests and sales, and every member keeps
              control of their own information.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                data-say={WORDS.newAccount.say}
                className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-white px-7 text-lg font-bold text-primary-dark shadow-sm transition hover:bg-primary-soft"
              >
                {WORDS.newAccount.text} <ArrowRight size={20} aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                data-say={WORDS.haveAccount.say}
                className="inline-flex min-h-14 items-center rounded-xl border border-white/40 px-7 text-lg font-bold text-white transition hover:bg-white/10"
              >
                {WORDS.haveAccount.text}
              </Link>
            </div>
          </div>
          <ul className="space-y-3">
            {[
              "Records stay on the phone when there is no network",
              "Liberian and US dollars are never mixed",
              "Phone number and PIN keep each account private",
              "Works on simple phones, tablets and computers"
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">
                <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-200" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-8 py-8 text-sm text-ink-soft">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span>
              <span className="font-bold text-ink">FarmBok</span> · Farm records for every season
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/login" className="font-semibold hover:text-primary">
              Sign in
            </Link>
            <Link to="/register" className="font-semibold hover:text-primary">
              Create account
            </Link>
            <Link to="/admin/login" className="font-semibold hover:text-primary">
              Staff sign in
            </Link>
            <span>© {year}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
