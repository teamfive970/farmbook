import { ClipboardList, Fence, House, KeyRound, Loader2, MapPin, Plus, Smartphone, UserRound, Users, Wallet } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import Brand from "./Brand.jsx";
import { CloudSentIcon } from "./ui.jsx";
import { VoiceToggle } from "./Voice.jsx";
import { ICONS } from "../lib/icons.js";
import { WORDS } from "../lib/words.js";

const NAV = [
  { to: "/app", words: WORDS.navHome, Icon: House, end: true },
  { to: "/app/farms", words: WORDS.navFarms, Icon: Fence },
  { to: "/app/history", words: WORDS.navRecords, Icon: ClipboardList },
  { to: "/app/money", words: WORDS.navMoney, Icon: Wallet },
  { to: "/app/profile", words: WORDS.navMe, Icon: UserRound }
];

// Extra shortcuts shown only in the desktop side menu (there is room there).
const DESK_MORE = [
  { to: "/app/harvests", words: { text: "Harvests", say: "See your harvests." }, Icon: ICONS.harvest },
  { to: "/app/report", words: WORDS.reportOpen, Icon: ICONS.report },
  { to: "/app/money/buyers", words: { text: "My buyers", say: "See your buyers." }, Icon: Users }
];

// Forms read best in a narrower column on a wide screen.
const FORM_PAGE = /\/(new|edit|record|check)(\/|$)|\/check\/|\/money\/(sell|spend)|\/animal-events\/|\/money\/buyers\/./;

function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function DeskLink({ to, words, Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      data-say={words.say}
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[15px] font-semibold transition ${
          isActive ? "bg-primary-soft text-primary-dark" : "text-ink-soft hover:bg-canvas hover:text-primary"
        }`
      }
    >
      <Icon size={20} aria-hidden="true" />
      <span className="truncate">{words.text}</span>
    </NavLink>
  );
}

export default function FarmerLayout() {
  const { syncing, online, pendingCount } = useSync();
  const { user, needsOnlineSignIn, lock } = useAuth();
  const pendingAccount = Boolean(user?.pendingRegistration);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const formPage = FORM_PAGE.test(pathname || "");
  const place = [user?.community, user?.county].filter(Boolean).join(", ");
  const switchPerson = () => {
    lock();
    navigate("/who");
  };

  // Same three pictures as on each record: phone = on this phone, cloud with a
  // tick = all sent. Words stay short; the picture carries the meaning.
  const syncState = syncing
    ? { words: WORDS.sending, label: WORDS.sending.text, Icon: Loader2, tone: "bg-sky-50 text-sky-700" }
    : needsOnlineSignIn && online
      ? {
          words: WORDS.enterPinToSend,
          label: pendingAccount ? "Send account" : "PIN",
          Icon: KeyRound,
          tone: "bg-orange-100 text-orange-700"
        }
      : pendingCount > 0
        ? { words: WORDS.onPhoneCount(pendingCount), label: WORDS.onPhoneCount(pendingCount).text, Icon: Smartphone, tone: "bg-slate-100 text-slate-700" }
        : !online
          ? { words: WORDS.noNetwork, label: WORDS.noNetwork.text, Icon: Smartphone, tone: "bg-slate-100 text-slate-700" }
          : { words: WORDS.allSent, label: WORDS.allSent.text, Icon: CloudSentIcon, tone: "bg-success/10 text-success" };

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-white lg:flex xl:w-72">
        <div className="px-5 pb-4 pt-6">
          <Brand to="/app" size="lg" />
        </div>
        <div className="mx-4 flex items-center gap-3 rounded-2xl bg-canvas p-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
            {initials(user?.fullName) || <UserRound size={20} aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-ink">{user?.fullName || "Farmer"}</span>
            {place && (
              <span className="flex items-center gap-1 truncate text-xs text-ink-soft">
                <MapPin size={12} aria-hidden="true" /> {place}
              </span>
            )}
          </span>
        </div>
        <div className="px-4 pt-4">
          <Link
            to="/app/record"
            data-say={WORDS.recordWork.say}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-card transition hover:bg-primary-dark"
          >
            <Plus size={18} aria-hidden="true" /> {WORDS.recordWork.text}
          </Link>
        </div>
        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
          {NAV.map((item) => (
            <DeskLink key={item.to} {...item} />
          ))}
          <p className="px-3.5 pb-1 pt-5 text-[11px] font-bold uppercase tracking-wider text-ink-soft/70">More</p>
          {DESK_MORE.map((item) => (
            <DeskLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="space-y-3 border-t border-line px-4 py-4">
          <Link
            to={needsOnlineSignIn && online ? "/login" : "/app/sync"}
            className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold ${syncState.tone}`}
            aria-label={syncState.label}
            data-say={syncState.words.say}
          >
            <syncState.Icon size={20} className={syncing ? "animate-spin" : ""} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{syncState.label}</span>
          </Link>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={switchPerson}
              data-say={WORDS.switchPerson.say}
              className="inline-flex min-h-11 flex-1 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-soft hover:bg-canvas hover:text-primary"
            >
              <Users size={18} aria-hidden="true" /> {WORDS.switchPerson.text}
            </button>
            <VoiceToggle compact />
          </div>
        </div>
      </aside>

      <div className="lg:pl-64 xl:pl-72">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/95 backdrop-blur lg:hidden">
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
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 md:px-6 lg:max-w-none lg:px-8 xl:px-12">
              <p className="text-sm font-medium leading-relaxed text-amber-900" data-say={WORDS.enterPinToSend.say}>
                {pendingAccount
                  ? "Your account and work are saved on this phone. Enter your PIN once to send them."
                  : WORDS.enterPinToSend.text}
              </p>
              <Link
                to="/login"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-amber-900 shadow-card hover:bg-amber-100"
              >
                <KeyRound size={16} aria-hidden="true" />{" "}
                {pendingAccount ? "Send my account" : "Enter PIN"}
              </Link>
            </div>
          </div>
        )}

        <main className={`mx-auto max-w-2xl px-4 pb-32 pt-5 md:pb-12 md:pt-8 lg:px-8 lg:pb-16 lg:pt-10 xl:px-12 ${formPage ? "lg:max-w-3xl" : "lg:max-w-[1600px]"}`}>
          <Outlet />
        </main>
      </div>

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
