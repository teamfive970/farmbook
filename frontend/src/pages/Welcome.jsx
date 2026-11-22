import { ArrowRight, CloudOff, NotebookPen, ShieldCheck, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import DemoAccessCard from "../components/DemoAccessCard.jsx";
import WelcomeDesktop from "../components/WelcomeDesktop.jsx";
import { SpeakButton, VoiceToggle, useSpeakOnOpen } from "../components/Voice.jsx";
import { buttonClass } from "../components/ui.jsx";
import { WORDS } from "../lib/words.js";

// Short sentences in simple Liberian English. Each one can be heard.
const POINTS = [
  {
    Icon: NotebookPen,
    title: "Keep your farm work",
    text: "Planting, weeding, feeding, all of it.",
    say: "Keep all your farm work in your phone. Planting, weeding, feeding, all of it."
  },
  {
    Icon: CloudOff,
    title: "No network? No problem",
    text: "It will stay on your phone and go later.",
    say: "Network not there? No problem. Your work will stay on your phone and go on the internet later."
  },
  {
    Icon: ShieldCheck,
    title: "Only you can see it",
    text: "Your phone number and secret PIN keep it safe.",
    say: "Only you can see your work. Your phone number and your secret PIN keep it safe."
  }
];

export default function Welcome() {
  useSpeakOnOpen(WORDS.welcomeTitle);
  return (
    <>
    {/* Computer screens get their own page; the phone page below is unchanged. */}
    <div className="hidden lg:block">
      <WelcomeDesktop />
    </div>
    <div className="relative min-h-dvh overflow-hidden bg-canvas lg:hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-soft blur-2xl"
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-8 lg:max-w-6xl lg:grid lg:grid-cols-2 lg:grid-rows-[auto_auto_auto_1fr] lg:items-start lg:gap-x-16 lg:px-10 lg:pt-16 xl:max-w-7xl xl:gap-x-24">
        <div className="flex items-center justify-between gap-2 lg:col-start-1 lg:row-start-1">
          <Brand to="/" size="lg" />
          <SpeakButton phrase={WORDS.welcomeTitle} />
        </div>

        {/* The voice switch comes first, so someone who cannot read finds it. */}
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-white p-3 shadow-card lg:col-start-1 lg:row-start-2 lg:mt-8">
          <p className="text-sm font-semibold leading-snug text-ink">
            <Volume2 size={18} className="mr-1 inline text-primary" aria-hidden="true" />
            Can't read? Touch here. The phone will talk to you.
          </p>
          <VoiceToggle />
        </div>

        <div className="mt-8 lg:col-start-1 lg:row-start-3" data-say={WORDS.welcomeTitle.say}>
          <h1 className="text-3xl font-bold leading-tight text-ink lg:text-4xl">{WORDS.welcomeTitle.text}</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Even when network not there.
          </p>
        </div>

        <ul className="mt-6 space-y-3 lg:col-start-1 lg:row-start-4 lg:mt-8">
          {POINTS.map(({ Icon, title, text, say }) => (
            <li key={title} className="flex gap-3 rounded-2xl bg-white p-4 shadow-card" data-say={say}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon size={22} aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-bold text-ink">{title}</p>
                <p className="mt-0.5 text-sm leading-snug text-ink-soft">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-3 pt-10 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mt-0 lg:self-center lg:rounded-3xl lg:border lg:border-line lg:bg-white lg:p-8 lg:pt-8 lg:shadow-float">
          <p className="hidden text-lg font-bold text-ink lg:block">Start keeping your farm records</p>
          <Link
            to="/register"
            data-say={WORDS.newAccount.say}
            className={buttonClass("primary", "lg", "w-full text-lg")}
          >
            {WORDS.newAccount.text}
            <ArrowRight size={20} />
          </Link>
          <Link
            to="/login"
            data-say={WORDS.haveAccount.say}
            className={buttonClass("secondary", "lg", "w-full text-lg")}
          >
            {WORDS.haveAccount.text}
          </Link>
          <div className="pt-3">
            <DemoAccessCard />
          </div>
          <p className="pt-2 text-center text-xs text-ink-soft">FarmBok · Farm records for every season</p>
        </div>
      </div>
    </div>
    </>
  );
}
