import { ArrowRight, CloudOff, NotebookPen, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { buttonClass } from "../components/ui.jsx";

const POINTS = [
  {
    Icon: NotebookPen,
    title: "Record farm work in seconds",
    text: "Planting, weeding, feeding, vaccination and more."
  },
  {
    Icon: CloudOff,
    title: "Works without internet",
    text: "Records are saved on your phone first, then sync when you are online."
  },
  {
    Icon: ShieldCheck,
    title: "Your records, your account",
    text: "Sign in with your phone number and PIN to see your history."
  }
];

export default function Welcome() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-soft blur-2xl"
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-10">
        <Brand to="/" size="lg" />

        <div className="mt-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-card">
            For smallholder farmers in Liberia
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-ink">
            Simple farm records that work for you.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Keep track of planting, feeding and other farm work. Minders saves each record on your
            phone and syncs it when you have internet.
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {POINTS.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-2xl bg-white p-4 shadow-card">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-sm leading-snug text-ink-soft">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-3 pt-10">
          <Link to="/register" className={buttonClass("primary", "lg", "w-full")}>
            Create your account
            <ArrowRight size={18} />
          </Link>
          <Link to="/login" className={buttonClass("secondary", "lg", "w-full")}>
            I already have an account
          </Link>
          <p className="pt-2 text-center text-xs text-ink-soft">
            Minders · Farm records for every season
          </p>
        </div>
      </div>
    </div>
  );
}
