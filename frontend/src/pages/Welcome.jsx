import { ArrowRight, ChevronRight, Store, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import DemoAccessCard from "../components/DemoAccessCard.jsx";
import { Photo, PhotoCredits } from "../components/Photo.jsx";
import WelcomeDesktop from "../components/WelcomeDesktop.jsx";
import { SpeakButton, VoiceToggle, useSpeakOnOpen } from "../components/Voice.jsx";
import { buttonClass } from "../components/ui.jsx";
import { PHOTOS } from "../lib/homePhotos.js";
import { WORDS } from "../lib/words.js";

// Short sentences in simple Liberian English. Each one can be heard.
const POINTS = [
  {
    photo: PHOTOS.farmer,
    title: "Keep your farm work",
    text: "Planting, weeding, feeding, all of it.",
    say: "Keep all your farm work in your phone. Planting, weeding, feeding, all of it."
  },
  {
    photo: PHOTOS.transport,
    title: "No network? No problem",
    text: "It will stay on your phone and go later.",
    say: "Network not there? No problem. Your work will stay on your phone and go on the internet later."
  },
  {
    photo: PHOTOS.plantain,
    title: "Only you can see it",
    text: "Your phone number and secret PIN keep it safe.",
    say: "Only you can see your work. Your phone number and your secret PIN keep it safe."
  }
];

export default function Welcome() {
  useSpeakOnOpen(WORDS.welcomeTitle);
  return (
    <>
      {/* Computer screens get their own page. */}
      <div className="hidden lg:block">
        <WelcomeDesktop />
      </div>

      <div className="min-h-dvh bg-canvas lg:hidden">
        {/* Photo hero */}
        <Photo photo={PHOTOS.rice} eager sizes="100vw" className="h-[60dvh] max-h-[560px] min-h-[400px]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/80"
          />
          <div className="absolute inset-x-0 top-0 mx-auto flex max-w-md items-center justify-between gap-2 px-5 pt-5">
            <span className="rounded-2xl bg-white/95 px-3 py-1.5 shadow-card">
              <Brand to="/" />
            </span>
            <SpeakButton phrase={WORDS.welcomeTitle} className="bg-white/95 shadow-card" />
          </div>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md px-5 pb-14 text-white" data-say={WORDS.welcomeTitle.say}>
            <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              Made for farmers in Liberia
            </span>
            <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] tracking-tight drop-shadow-sm">
              {WORDS.welcomeTitle.text}
            </h1>
            <p className="mt-2 text-base font-medium text-white/90">Even when network not there.</p>
          </div>
        </Photo>

        <div className="relative mx-auto -mt-8 max-w-md px-5 pb-8">
          {/* The voice switch comes first, so someone who cannot read finds it. */}
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-float">
            <p className="text-sm font-semibold leading-snug text-ink">
              <Volume2 size={18} className="mr-1 inline text-primary" aria-hidden="true" />
              Can't read? Touch here. The phone will talk to you.
            </p>
            <VoiceToggle />
          </div>

          <div className="mt-5 space-y-3">
            <Link to="/register" data-say={WORDS.newAccount.say} className={buttonClass("primary", "lg", "w-full text-lg")}>
              {WORDS.newAccount.text}
              <ArrowRight size={20} />
            </Link>
            <Link to="/login" data-say={WORDS.haveAccount.say} className={buttonClass("secondary", "lg", "w-full text-lg")}>
              {WORDS.haveAccount.text}
            </Link>
          </div>

          <h2 className="mt-9 text-lg font-bold text-ink">What FarmBok does for you</h2>
          <ul className="mt-3 space-y-3">
            {POINTS.map(({ photo, title, text, say }) => (
              <li key={title} className="flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-2 pr-4 shadow-card" data-say={say}>
                <Photo photo={photo} sizes="96px" className="h-24 w-24 shrink-0 rounded-xl" />
                <div>
                  <p className="text-base font-bold text-ink">{title}</p>
                  <p className="mt-0.5 text-sm leading-snug text-ink-soft">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Market: a photo card that opens the public market page */}
          <Link
            to="/market"
            data-say="See harvests for sale and market prices."
            className="mt-6 block overflow-hidden rounded-2xl shadow-card"
          >
            <Photo photo={PHOTOS.market} sizes="(max-width: 448px) 100vw, 448px" className="h-40">
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/80">
                    <Store size={14} aria-hidden="true" /> FarmBok market
                  </p>
                  <p className="mt-0.5 text-lg font-bold leading-tight">Harvests for sale & market prices</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary-dark">
                  <ChevronRight size={20} aria-hidden="true" />
                </span>
              </div>
            </Photo>
          </Link>

          <div className="mt-6">
            <DemoAccessCard />
          </div>

          <p className="pt-6 text-center text-xs font-semibold text-ink-soft">FarmBok · Farm records for every season</p>
          <PhotoCredits className="mt-2 text-center" />
        </div>
      </div>
    </>
  );
}
