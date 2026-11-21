import { ClipboardList, Fence, House, KeyRound, Loader2, Smartphone, UserRound, Users, Wallet } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import Brand from "./Brand.jsx";
import { CloudSentIcon } from "./ui.jsx";
import { VoiceToggle } from "./Voice.jsx";
import { WORDS } from "../lib/words.js";

const NAV = [
  { to: "/app", words: WORDS.navHome, Icon: House, end: true },
  { to: "/app/farms", words: WORDS.navFarms, Icon: Fence },
  { to: "/app/history", words: WORDS.navRecords, Icon: ClipboardList },
  { to: "/app/money", words: WORDS.navMoney, Icon: Wallet },
  { to: "/app/profile", words: WORDS.navMe, Icon: UserRound }
];

export default function FarmerLayout() {
  const { syncing, online, pendingCount } = useSync();
  const { needsOnlineSignIn, lock } = useAuth();
  const navigate = useNavigate();
  const switchPerson = () => {
    lock();
    navigate("/who");
  };

  // Same three pictures as on each record: phone = on this phone, cloud with a
  // tick = all sent. Words stay short; the picture carries the meaning.
  const syncState = syncing
    ? { words: WORDS.sending, label: WORDS.sending.text, Icon: Loader2, tone: "bg-sky-50 text-sky-700" }
    : needsOnlineSignIn && online
      ? { words: WORDS.enterPinToSend, label: "PIN", Icon: KeyRound, tone: "bg-orange-100 text-orange-700" }
      : pendingCount > 0
        ? { words: WORDS.onPhoneCount(pendingCount), label: WORDS.onPhoneCount(pendingCount).text, Icon: Smartphone, tone: "bg-slate-100 text-slate-700" }
        : !online
          ? { words: WORDS.noNetwork, label: WORDS.noNetwork.text, Icon: Smartphone, tone: "bg-slate-100 text-slate-700" }
          : { words: WORDS.allSent, label: WORDS.allSent.text, Icon: CloudSentIcon, tone: "bg-success/10 text-success" };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Brand to="/app" />
          <div className="flex items-center gap-1.5 md:hidden">
            <VoiceToggle compact />
            <button
              type="button"
              onClick={switchPerson}
              aria-label={WORDS.switchPerson.text}
              data-say={WORDS.switchPerson.say}
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white text-ink"
            >
              <Users size={20} aria-hidden="true" />
            </button>
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            <VoiceToggle compact />
            <button
              type="button"
              onClick={switchPerson}
              data-say={WORDS.switchPerson.say}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-soft hover:bg-white hover:text-primary"
            >
              <Users size={17} /> {WORDS.switchPerson.text}
            </button>
            {NAV.map(({ to, words, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                data-say={words.say}
                className={({ isActive }) =>
                  `inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-primary-soft text-primary-dark"
                      : "text-ink-soft hover:bg-white hover:text-primary"
                  }`
                }
              >
                <Icon size={17} />
                {words.text}
              </NavLink>
            ))}
          </nav>
          <Link
            to={needsOnlineSignIn && online ? "/login" : "/app/sync"}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${syncState.tone}`}
            aria-label={syncState.label}
            data-say={syncState.words.say}
          >
            <syncState.Icon size={17} className={syncing ? "animate-spin" : ""} />
            {syncState.label}
          </Link>
        </div>
      </header>

      {needsOnlineSignIn && online && (
        <div className="border-b border-warning/30 bg-warning/10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 md:px-6">
            <p className="text-sm font-medium leading-relaxed text-amber-900" data-say={WORDS.enterPinToSend.say}>
              {WORDS.enterPinToSend.text}
            </p>
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-amber-900 shadow-card hover:bg-amber-100"
            >
              <KeyRound size={16} aria-hidden="true" /> Enter PIN
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-5 md:pb-12 md:pt-8">
        <Outlet />
      </main>

      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur safe-bottom md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-1">
          {NAV.map(({ to, words, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-say={words.say}
              className={({ isActive }) =>
                `flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-bold transition ${
                  isActive ? "text-primary" : "text-ink-soft hover:text-primary"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                  {words.text}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
