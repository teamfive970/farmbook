import { AppWindow, BookOpen, ExternalLink, PlayCircle, UserRound, WifiOff } from "lucide-react";
import { SpeakButton, useSpeakOnOpen } from "../../components/Voice.jsx";
import { PageHeader } from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { adviceFor } from "../../lib/advisory.js";
import { allFarmCrops } from "../../lib/farmCrops.js";
import { WORDS } from "../../lib/words.js";

const KIND = {
  person: { Icon: UserRound, label: "Talk to someone", tone: "bg-emerald-100 text-emerald-800" },
  app: { Icon: AppWindow, label: "Free app", tone: "bg-sky-100 text-sky-800" },
  videos: { Icon: PlayCircle, label: "Videos", tone: "bg-rose-100 text-rose-800" },
  guide: { Icon: BookOpen, label: "Guide", tone: "bg-amber-100 text-amber-800" }
};

function AdviceCard({ item }) {
  const kind = KIND[item.kind] || KIND.guide;
  return (
    <li className="flex flex-col rounded-2xl bg-white p-4 shadow-card" data-say={item.say}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kind.tone}`}>
          <kind.Icon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{kind.label}</p>
          <h3 className="text-base font-bold leading-snug text-ink">{item.name}</h3>
          <p className="text-xs text-ink-soft">{item.by}</p>
        </div>
        <SpeakButton phrase={{ say: item.say }} className="h-9 w-9" />
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink">{item.text}</p>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary-soft px-4 text-sm font-bold text-primary-dark"
      >
        {item.linkText} <ExternalLink size={15} aria-hidden="true" />
      </a>
    </li>
  );
}

function Group({ title, items }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-ink">{title}</h2>
      <ul className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <AdviceCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

// "Farm advice": extension officers and free advice for the farmer's crops.
export default function Advice() {
  const { farms } = useFarmerData();
  const { online } = useSync();
  const crops = allFarmCrops(farms);
  const { forMyCrops, general, other } = adviceFor(crops);
  useSpeakOnOpen(WORDS.adviceTitle);

  return (
    <div className="space-y-5 lg:mx-auto lg:max-w-5xl">
      <PageHeader
        title={WORDS.adviceTitle.text}
        subtitle="Free help from extension officers and trusted farm experts."
        say={WORDS.adviceTitle}
        backTo="/app"
      />
      {!online && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          <WifiOff size={16} aria-hidden="true" /> These links need network. Open them when you are online.
        </p>
      )}
      {crops.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-soft">Your crops:</span>
          {crops.map((crop) => (
            <span key={crop} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-ink shadow-card">
              {crop}
            </span>
          ))}
        </div>
      )}
      <Group title="For your crops" items={forMyCrops} />
      <Group title="For every farmer" items={general} />
      <Group title="Other crops" items={other} />
      <p className="text-center text-xs text-ink-soft">
        FarmBok is not part of these services. They are free to use, but data on your phone may cost money.
      </p>
    </div>
  );
}
