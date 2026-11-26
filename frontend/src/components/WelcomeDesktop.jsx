import {
  ArrowRight,
  Bell,
  CircleCheck,
  CloudOff,
  FileText,
  LogIn,
  PawPrint,
  QrCode as QrIcon,
  ShieldCheck,
  Smartphone,
  Store,
  Sprout,
  TrendingUp,
  Users,
  Volume2
} from "lucide-react";
import { Link } from "react-router-dom";
import Brand, { BrandMark } from "./Brand.jsx";
import { QrCode } from "./Choices.jsx";
import { SpeakButton, VoiceToggle } from "./Voice.jsx";
import { buttonClass } from "./ui.jsx";
import { WORDS } from "../lib/words.js";
import DemoAccessCard from "./DemoAccessCard.jsx";
import { Photo, PhotoCredits } from "./Photo.jsx";
import { PHOTOS } from "../lib/homePhotos.js";

// The welcome page on a computer screen (1024px and wider). The phone keeps
// its own simple welcome page; this one has room to show what the app does.

const FEATURES = [
  { Icon: Sprout, title: "Crops and animals", text: "Each planting and animal group has its own records, start to harvest." },
  { Icon: FileText, title: "Reports to share", text: "A clear farm report as PDF or for Excel, for your group, buyer or bank." },
  { Icon: TrendingUp, title: "Compare seasons", text: "See if this season did better than the last one, in plain words." },
  { Icon: Bell, title: "Messages and reminders", text: "Reminders for farm work and news from your group or the ministry." },
  { Icon: Volume2, title: "Talks to you", text: "Every page can be read out loud for farmers who cannot read." },
  { Icon: QrIcon, title: "Checked by staff", text: "Agriculture staff check harvests so buyers can trust the grade." }
];

// The three main things, each told with a real photo.
const STORIES = [
  {
    photo: PHOTOS.farmer,
    label: "Record",
    title: "Farm work, day by day",
    text: "Planting, weeding, spraying, feeding. Tap the pictures; typing is optional. It saves on the phone first."
  },
  {
    photo: PHOTOS.plantain,
    label: "Track",
    title: "Harvests, money and profit",
    text: "See what you harvested, sold and still have in store. L$ and US$ are kept apart, and profit is worked out for you."
  },
  {
    photo: PHOTOS.transport,
    label: "Sell",
    title: "Harvest Passport for buyers",
    text: "A QR code and printed tag show buyers where your crop came from and that it was checked."
  }
];

const STEPS = [
  { title: "Make your account", text: "Your name, phone number and a secret PIN of 4 to 6 numbers." },
  { title: "Add your farm", text: "Pick what you grow or raise, and where the farm is." },
  { title: "Record as you work", text: "Work, harvests, sales and costs." },
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
            <Link to="/market" className="rounded-lg px-3 py-2 hover:bg-primary-soft hover:text-primary-dark">
              Market
            </Link>
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

      {/* Hero: a real photo of a Liberian rice farm */}
      <Photo photo={PHOTOS.rice} eager sizes="100vw" className="min-h-[640px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/10"
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-[1.15fr_1fr] items-center gap-16 px-8 pb-24 pt-16 xl:gap-24 xl:pt-20">
          <div className="text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
              <Sprout size={14} aria-hidden="true" /> Made for smallholder farmers in Liberia
            </span>
            <h1
              className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight xl:text-6xl"
              data-say={WORDS.welcomeTitle.say}
            >
              Keep your farm records <span className="text-emerald-300">on your phone.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">
              FarmBok helps you record your farm work, harvests, sales and costs, and see your profit. It works even
              when there is no network, it can be access on smartphone, and local (button) phone - by dialing a code.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" data-say={WORDS.newAccount.say} className={buttonClass("primary", "lg", "px-7 text-lg")}>
                {WORDS.newAccount.text} <ArrowRight size={20} aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                data-say={WORDS.haveAccount.say}
                className="inline-flex min-h-14 items-center rounded-xl border-2 border-white/60 px-7 text-lg font-bold text-white transition hover:bg-white/10"
              >
                {WORDS.haveAccount.text}
              </Link>
              <SpeakButton phrase={WORDS.welcomeTitle} className="bg-white/90" />
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <PhonePreview />
        </div>
      </Photo>

      {/* Features: three photo stories, then the rest in a short list */}
      <section id="features" className="scroll-mt-24 bg-white">
        <div className="mx-auto max-w-7xl px-8 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">What it does</p>
            <h2 className="mt-2 text-3xl font-bold text-ink xl:text-4xl">Everything about your farm, in one place</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Simple pictures and big buttons on the phone. Clear pages and reports on a computer.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-6">
            {STORIES.map(({ photo, label, title, text }) => (
              <article key={title} className="group overflow-hidden rounded-3xl border border-line bg-white shadow-card transition hover:-translate-y-1 hover:shadow-float">
                <Photo photo={photo} sizes="(min-width: 1280px) 400px, 33vw" className="aspect-[4/3]">
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-primary-dark shadow-card">
                    {label}
                  </span>
                </Photo>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</p>
                </div>
              </article>
            ))}
          </div>
          <ul className="mt-10 grid grid-cols-3 gap-x-8 gap-y-5 border-t border-line pt-10">
            {FEATURES.map(({ Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-bold text-ink">{title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Market band */}
      <section className="border-y border-line bg-canvas">
        <div className="mx-auto grid max-w-7xl grid-cols-2 items-stretch gap-0 px-8 py-20">
          <Photo photo={PHOTOS.market} sizes="(min-width: 1280px) 620px, 50vw" className="min-h-[360px] rounded-l-3xl" />
          <div className="flex flex-col justify-center rounded-r-3xl bg-white p-12 shadow-card">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <Store size={16} aria-hidden="true" /> FarmBok market
            </p>
            <h2 className="mt-2 text-3xl font-bold leading-tight text-ink">Harvests for sale and fair market prices</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Buyers can see checked harvests from farmers across Liberia and send a request, without seeing the
              farmer's phone number. Farmers can see what crops sell for in their county before they sell.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/market" className={buttonClass("primary", "md")}>
                See harvests for sale <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/market?tab=prices" className={buttonClass("secondary", "md")}>
                Market prices
              </Link>
            </div>
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
        <Photo photo={PHOTOS.rubber} sizes="(min-width: 1280px) 1216px, 100vw" className="rounded-3xl shadow-float">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-primary-dark/95 via-primary-dark/85 to-primary-dark/60" />
        <div className="relative grid grid-cols-[1.2fr_1fr] items-center gap-12 p-12 text-white">
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
        </Photo>
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
        {/* <div className="mx-auto max-w-7xl px-8 pb-8">
          <PhotoCredits />
        </div> */}
      </footer>
    </div>
  );
}
