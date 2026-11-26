import { CircleCheck, CircleX, Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { PageLoading } from "../components/ui.jsx";
import ContactFarmer from "../components/ContactFarmer.jsx";
import { PassportMap } from "../components/FarmMap.jsx";
import { api, apiUrl } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { activityMeta, farmMeta, formatFarmSize } from "../lib/labels.js";
import { CropIcon, GradeBadge } from "../components/Choices.jsx";
import { ICONS } from "../lib/icons.js";
import { GRADES, QUALITY_CHECKS, unitText } from "../lib/words.js";

// Photos the farmer took of this harvest. Tap one to see it bigger.
function PassportPhotos({ photos, crop }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="text-sm font-bold text-ink">Photos of this harvest</h2>
      <p className="text-xs text-ink-soft">Taken by the farmer.</p>
      <ul className={`mt-3 grid gap-2 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpen(photo)}
              className={`block w-full overflow-hidden rounded-xl bg-emerald-50 ${photos.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}
              aria-label={`See photo ${index + 1} bigger`}
            >
              <img src={apiUrl(photo.url)} alt={`${crop} harvest, photo ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-label="Harvest photo">
          <img src={apiUrl(open.url)} alt={`${crop} harvest`} className="max-h-full max-w-full rounded-xl object-contain" />
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

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

        {passport.photos?.length > 0 && <PassportPhotos photos={passport.photos} crop={passport.crop} />}

        {passport.canContact && (
          <ContactFarmer
            code={passport.code}
            crop={passport.crop}
            unit={passport.unit}
            firstName={passport.farmer.firstName}
          />
        )}

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
          <PassportMap farm={passport.farm} />
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
        <Link
          to="/market"
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-line bg-white px-4 py-3 text-sm font-bold text-primary"
        >
          <Store size={18} aria-hidden="true" /> See more harvests for sale
        </Link>
      </div>
    </div>
  );
}
