import {
  ArrowRight,
  ClipboardList,
  ClipboardPlus,
  GraduationCap,
  CloudOff,
  ChevronRight,
  CloudUpload,
  Megaphone,
  Plus
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import ActivityItem from "../../components/ActivityItem.jsx";
import { EmptyState, PageLoading } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useNotifications } from "../../contexts/NotificationContext.jsx";
import { MessagesBell } from "../../components/MessagesBell.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { firstName } from "../../lib/format.js";
import { farmMeta } from "../../lib/labels.js";
import { farmMoney, formatMoney } from "../../lib/ledger.js";
import { animalCount } from "../../lib/production.js";
import { WORDS } from "../../lib/words.js";
import { SpeakButton, useSpeakOnOpen } from "../../components/Voice.jsx";
import WeatherCard from "../../components/WeatherCard.jsx";
import { ICONS } from "../../lib/icons.js";
import { farmSupportsAnimals } from "../../lib/farmTypes.js";

export default function Dashboard() {
  const { user, needsOnlineSignIn } = useAuth();
  const { online, pendingCount, syncing, syncNow } = useSync();
  const { activities, farms, records, loading } = useFarmerData();
  // Animal farms record what the animals give (eggs, milk) as production.
  const canProduce = farms.some((farm) => farmSupportsAnimals(farm.farmType));
  const { unread } = useNotifications();
  const hello = WORDS.hello(firstName(user.fullName));
  useSpeakOnOpen(hello);

  // One line per farm for the overall picture: what it has and what money
  // it made. Each farm's own page has the full story.
  const farmCards = useMemo(() => {
    const moneyByFarm = farmMoney(records);
    return farms.map((farm) => {
      const plantings = records.productions.filter((item) => item.farmClientId === farm.clientId);
      const crops = plantings.filter((item) => item.productionKind !== "animal");
      const animals = plantings
        .filter((item) => item.productionKind === "animal")
        .reduce((sum, group) => sum + animalCount(group, records.animalEvents), 0);
      const money = moneyByFarm.filter((row) => row.farmClientId === farm.clientId);
      return { farm, crops: crops.length, animals, money };
    });
  }, [farms, records]);

  if (loading && activities.length === 0 && farms.length === 0) {
    return <PageLoading label="Opening your farm records…" />;
  }

  const recent = activities.slice(0, 3);
  const waiting =
    activities.filter((item) => item.syncStatus !== "synced").length +
    farms.filter((farm) => farm.syncStatus && farm.syncStatus !== "synced").length;

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0">
      <div className="flex items-start justify-between gap-3 lg:col-span-12">
        <div data-say={hello.say}>
          <h1 className="text-2xl font-bold text-ink">{hello.text}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {user.county} · {user.district}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SpeakButton phrase={hello} />
          <MessagesBell className="md:hidden" />
        </div>
      </div>

      {unread > 0 && (
        <Link
          to="/app/messages"
          data-say={`You get ${unread} new ${unread === 1 ? "message" : "messages"}. Touch to read.`}
          className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 lg:col-span-12"
        >
          <Megaphone size={20} className="shrink-0 text-sky-700" aria-hidden="true" />
          <span className="flex-1 text-sm font-bold text-sky-900">
            {unread} new {unread === 1 ? "message" : "messages"}
          </span>
          <ChevronRight size={18} className="text-sky-700" aria-hidden="true" />
        </Link>
      )}

      {needsOnlineSignIn ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 lg:col-span-12">
          <CloudUpload size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-sm leading-snug text-amber-800" data-say={WORDS.enterPinToSend.say}>
            {user.pendingRegistration
              ? "Your account and work are safe on this phone. "
              : "Your work is safe on this phone. "}
            <Link to="/login" className="font-semibold underline">
              Enter your PIN
            </Link>{" "}
            when you are online, so {user.pendingRegistration ? "they" : "it"} can be sent.
          </p>
        </div>
      ) : !online ? (
        <div
          className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 lg:col-span-12"
          data-say={WORDS.noNetwork.say}
        >
          <CloudOff size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{WORDS.noNetwork.text}</p>
            <p className="mt-0.5 text-xs leading-snug text-amber-800/80">
              No problem. Your work will stay on your phone and go later.
            </p>
          </div>
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 lg:col-span-12">
          <div className="flex items-start gap-3">
            <CloudUpload size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <p className="text-sm font-medium text-amber-800" data-say={WORDS.onPhoneCount(pendingCount).say}>
              {pendingCount} still on your phone, going soon.
            </p>
          </div>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm disabled:opacity-60"
          >
            {syncing ? "Sending…" : "Send now"}
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-medium text-success lg:col-span-12"
          data-say={WORDS.allSent.say}
        >
          All your work gone on the internet. It safe.
        </div>
      )}

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white shadow-float lg:col-span-12 xl:col-span-8 lg:flex lg:flex-col lg:justify-center lg:self-stretch">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
          <ClipboardPlus size={16} /> Today
        </div>
        <h2 className="mt-2 text-xl font-bold leading-tight">What work did you do today?</h2>
        <p className="mt-1 text-sm leading-snug text-white/80">Tap the pictures. No typing.</p>
        <Link
          to="/app/record"
          data-say={WORDS.recordWork.say}
          className="mt-4 inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-lg font-bold text-primary-dark transition hover:bg-primary-soft"
        >
          <Plus size={24} /> {WORDS.recordWork.text}
        </Link>
      </section>

      <div className="space-y-5 lg:col-span-12 xl:col-span-4 xl:space-y-3">
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-3">
        <Link to="/app/farms" data-say={WORDS.farmsCount(farms.length).say} className="rounded-2xl bg-white p-4 shadow-card transition hover:-translate-y-0.5">
          <p className="text-xs font-medium text-ink-soft">Farms</p>
          <p className="mt-1 text-2xl font-bold text-ink">{farms.length}</p>
          <ICONS.farm size={16} className="mt-2 text-primary" aria-hidden="true" />
        </Link>
        <Link to="/app/history" data-say={WORDS.workCount(activities.length).say} className="rounded-2xl bg-white p-4 shadow-card transition hover:-translate-y-0.5">
          <p className="text-xs font-medium text-ink-soft">Work</p>
          <p className="mt-1 text-2xl font-bold text-ink">{activities.length}</p>
          <ClipboardList size={16} className="mt-2 text-primary" />
        </Link>
        <Link to="/app/sync" data-say={WORDS.onPhoneCount(waiting).say} className="rounded-2xl bg-white p-4 shadow-card transition hover:-translate-y-0.5">
          <p className="text-xs font-medium text-ink-soft">On phone</p>
          <p className={`mt-1 text-2xl font-bold ${waiting > 0 ? "text-amber-600" : "text-ink"}`}>
            {waiting}
          </p>
          <CloudUpload size={16} className={`mt-2 ${waiting > 0 ? "text-amber-500" : "text-primary"}`} />
        </Link>
      </div>
        <WeatherCard county={farms.find((farm) => farm.county)?.county || user.county} />
        <Link
          to="/app/advice"
          data-say={WORDS.adviceOpen.say}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <GraduationCap size={22} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">{WORDS.adviceOpen.text}</span>
            <span className="block text-xs text-ink-soft">Extension officers, videos and help for your crops</span>
          </span>
          <ChevronRight size={18} className="text-ink-soft" aria-hidden="true" />
        </Link>
      </div>

      {farmCards.length > 0 && (
        <section className="lg:col-span-12 xl:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Your farms</h2>
            <Link to="/app/farms" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              See all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {farmCards.map(({ farm, crops, animals, money }) => {
              const meta = farmMeta(farm.farmType);
              return (
                <Link
                  key={farm.id}
                  to={`/app/farms/${farm.id}`}
                  data-say={`${farm.farmName}. ${crops} crop${crops === 1 ? "" : "s"}, ${animals} animal${animals === 1 ? "" : "s"}.`}
                  className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-card transition hover:border-primary/30"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                    <meta.Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{farm.farmName}</span>
                    <span className="block text-xs text-ink-soft">
                      {crops} crop{crops === 1 ? "" : "s"} · {animals} animal{animals === 1 ? "" : "s"}
                    </span>
                    {money.length > 0 ? (
                      money.map((row) => (
                        <span key={row.currency} className="mt-1 block text-xs text-ink-soft">
                          Income {formatMoney(row.income, row.currency)} ·{" "}
                          <span className={row.profit >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
                            Profit {row.profit < 0 ? "−" : ""}
                            {formatMoney(Math.abs(row.profit), row.currency)}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="mt-1 block text-xs text-ink-soft">No money recorded yet</span>
                    )}
                  </span>
                  <ArrowRight size={18} className="mt-1 shrink-0 text-ink-soft" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className={`grid gap-3 lg:col-span-12 xl:col-span-4 lg:grid-cols-4 xl:grid-cols-2 lg:self-stretch ${canProduce ? "grid-cols-2" : "grid-cols-3"}`}>
        <Link
          to="/app/harvests"
          data-say={WORDS.harvestTitle.say}
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-amber-50 p-3 text-center shadow-card"
        >
          <ICONS.harvest size={30} className="text-amber-800" aria-hidden="true" />
          <span className="text-sm font-bold text-amber-900">{WORDS.navHarvest.text}</span>
        </Link>
        {canProduce && (
          <Link
            to="/app/record?type=production"
            data-say={WORDS.productionTitle.say}
            className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-yellow-50 p-3 text-center shadow-card"
          >
            <ICONS.production size={30} className="text-yellow-800" aria-hidden="true" />
            <span className="text-sm font-bold text-yellow-900">{WORDS.productionTitle.text}</span>
          </Link>
        )}
        <Link
          to="/app/money"
          data-say={WORDS.moneyTitle.say}
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-50 p-3 text-center shadow-card"
        >
          <ICONS.money size={30} className="text-emerald-800" aria-hidden="true" />
          <span className="text-sm font-bold text-emerald-900">{WORDS.navMoney.text}</span>
        </Link>
        <Link
          to="/app/group"
          data-say={WORDS.groupTitle.say}
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-sky-50 p-3 text-center shadow-card"
        >
          <ICONS.group size={30} className="text-sky-800" aria-hidden="true" />
          <span className="text-sm font-bold text-sky-900">{WORDS.groupTitle.text}</span>
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:col-span-12 xl:col-span-8">
        <Link
          to="/app/farms/new"
          data-say={WORDS.addFarm.say}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition hover:border-primary/30"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Plus size={20} />
          </span>
          <span className="text-sm font-semibold text-ink">{WORDS.addFarm.text}</span>
        </Link>
        <Link
          to="/app/history"
          data-say={WORDS.seeWork.say}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition hover:border-primary/30"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ClipboardList size={20} />
          </span>
          <span className="text-sm font-semibold text-ink">{WORDS.seeWork.text}</span>
        </Link>
      </section>

      <Link
        to="/app/report"
        data-say={WORDS.reportOpen.say}
        className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition hover:border-primary/30 lg:col-span-12 xl:col-span-4"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <ICONS.report size={20} aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-ink">{WORDS.reportOpen.text}</span>
          <span className="block text-xs text-ink-soft">Summary · PDF · Excel</span>
        </span>
        <ArrowRight size={18} className="text-ink-soft" aria-hidden="true" />
      </Link>

      <section className="lg:col-span-12">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">{WORDS.recentWork.text}</h2>
          {activities.length > 0 && (
            <Link
              to="/app/history"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              See all <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={WORDS.noWorkYet.text}
            description="Touch the button and put the first work you do."
            action={
              <Link
                to="/app/record"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                <Plus size={16} /> {WORDS.recordWork.text}
              </Link>
            }
          />
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
            {recent.map((activity) => (
              <ActivityItem key={activity.clientId} activity={activity} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
