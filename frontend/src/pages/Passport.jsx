import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { PageLoading } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { activityMeta, farmMeta, formatFarmSize } from "../lib/labels.js";
import { CircleCheck, CircleX } from "lucide-react";
import { CropIcon, GradeBadge } from "../components/Choices.jsx";
import { ICONS } from "../lib/icons.js";
import { GRADES, QUALITY_CHECKS, unitText } from "../lib/words.js";

// Public Harvest Passport: what a buyer sees after scanning a batch's QR code.
// No sign-in. Shows where the crop came from, the farm work before harvest and
// the quality grade — never the farmer's phone number or full name.
export default function Passport() {
  const { code } = useParams();
  const [passport, setPassport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/api/passport/${encodeURIComponent(code)}`)
      .then((result) => setPassport(result.passport))
      .catch((requestError) => setError(requestError.message));
  }, [code]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <Brand to="/" />
        <ICONS.search size={40} className="mx-auto text-ink-soft" aria-hidden="true" />
        <h1 className="text-xl font-bold text-ink">Passport not available</h1>
        <p className="max-w-sm text-sm text-ink-soft">{error}</p>
        <p className="max-w-sm text-xs text-ink-soft">
          If you just got this link, the farmer may need to turn on "Buyers can see it" and connect to the internet
          once. Then open the link again.
        </p>
      </div>
    );
  }
  if (!passport) return <PageLoading label="Opening the Harvest Passport…" />;

  const grade = passport.quality ? GRADES[passport.quality.grade] : null;
  const farmType = farmMeta(passport.farm.farmType);

  return (
    <div className="min-h-dvh bg-canvas px-5 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <Brand to="/" />
          <span className="rounded-full bg-primary-soft px-3 py-1 font-mono text-xs font-bold text-primary-dark">
            {passport.code}
          </span>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Harvest Passport</p>
          <div className="mt-2 flex items-center gap-4">
            <CropIcon name={passport.crop} size={36} />
            <div>
              <h1 className="text-2xl font-bold text-ink">{passport.crop}</h1>
              <p className="text-sm text-ink-soft">
                {passport.quantity} {unitText(passport.unit)} · harvested {formatDate(passport.harvestDate)}
              </p>
              {passport.quantitySold > 0 && (
                <p className="text-xs text-ink-soft">
                  {passport.quantitySold} {unitText(passport.unit)} already sold
                  {passport.quantityLeft !== undefined ? ` · ${passport.quantityLeft} left` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Where it was grown</h2>
          <p className="mt-2 text-sm text-ink">
            <ICONS.place size={14} className="mr-1 inline" aria-hidden="true" />
            {[passport.farm.community, passport.farm.district, passport.farm.county].filter(Boolean).join(", ")}, Liberia
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {farmType.label}
            {formatFarmSize(passport.farm) ? ` · ${formatFarmSize(passport.farm)}` : ""}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            <ICONS.farmer size={14} className="mr-1 inline" aria-hidden="true" />
            Farmer: {passport.farmer.firstName}
            {passport.farmer.groups.length > 0 ? ` · ${passport.farmer.groups.join(", ")}` : ""}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Quality</h2>
          {grade ? (
            <>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-lg font-bold text-ink">
                <GradeBadge grade={passport.quality.grade} words={grade} size="lg" />
                <span className="text-xs font-normal text-ink-soft">
                  checked {formatDate(passport.quality.checkedOn)}
                  {passport.quality.checkedBy ? ` by ${passport.quality.checkedBy}` : ""}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUALITY_CHECKS.filter((check) => passport.quality.checks[check.value] !== undefined).map((check) => (
                  <span
                    key={check.value}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      passport.quality.checks[check.value] ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    }`}
                  >
                    {passport.quality.checks[check.value] ? <CircleCheck size={12} aria-hidden="true" /> : <CircleX size={12} aria-hidden="true" />}{" "}
                    {check.text}
                  </span>
                ))}
              </div>
              {passport.quality.moisturePercent !== null && (
                <p className="mt-2 text-xs text-ink-soft">Moisture: {passport.quality.moisturePercent}%</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Not checked yet.</p>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Farm work in the year before harvest</h2>
          {passport.farmWork.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No farm work recorded.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {passport.farmWork.map((work, index) => {
                const meta = activityMeta(work.activityType);
                return (
                  <li key={`${work.date}-${index}`} className="flex items-start gap-3 text-sm">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                      <meta.Icon size={16} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{meta.englishLabel || meta.label}</strong> · {formatDate(work.date)}
                      {work.inputUsed && (
                        <span className="block text-xs text-ink-soft">
                          Used: {work.inputUsed}
                          {work.quantity !== null ? ` (${work.quantity} ${work.unit || ""})` : ""}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="text-center text-xs leading-relaxed text-ink-soft">{passport.notice}</p>
      </div>
    </div>
  );
}
