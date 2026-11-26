import { Crosshair, Loader2, MapPinned, Trash2 } from "lucide-react";
import { useState } from "react";
import { MapBox } from "./FarmMap.jsx";
import { SpeakButton } from "./Voice.jsx";

const SAY_HELP = {
  say: "Stand on your farm and touch the button. The phone will save where the farm is. Buyers can then find your farm area."
};

function gpsError(error) {
  if (!error) return "This phone cannot find its place.";
  if (error.code === 1) return "Location is blocked. Allow location for FarmBok in your phone settings, then try again.";
  if (error.code === 3) return "The phone took too long. Go outside, wait a little, and try again.";
  return "The phone could not find its place. Go outside and try again.";
}

// Saves the GPS point of the farm. Works without network (GPS only needs sky).
// The farmer decides separately whether buyers may see the farm area.
export default function FarmLocationPicker({ location, showOnMap, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  function capture() {
    if (!supported) {
      setError(gpsError(null));
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        const { latitude, longitude, accuracy } = position.coords;
        if (latitude < 3.5 || latitude > 9.5 || longitude < -12.5 || longitude > -6.5) {
          setError("This place is not in Liberia. Save it while you are on the farm.");
          return;
        }
        onChange({
          location: {
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
            accuracy: Math.round(accuracy),
            savedAt: new Date().toISOString()
          },
          showOnMap
        });
      },
      (gps) => {
        setBusy(false);
        setError(gpsError(gps));
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="label" data-say={SAY_HELP.say}>
          Farm location <span className="font-normal text-ink-soft">(you can leave it)</span>
        </p>
        <SpeakButton phrase={SAY_HELP} className="h-8 w-8" />
      </div>
      <p className="text-sm text-ink-soft">Stand on your farm and touch the button. It works without network.</p>

      {location ? (
        <div className="mt-3 space-y-2">
          <MapBox location={location} className="h-40" />
          <p className="text-xs text-ink-soft">
            Saved{location.accuracy ? `, correct to about ${location.accuracy} m` : ""}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={capture}
              disabled={busy}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-white text-sm font-bold text-ink"
            >
              {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Crosshair size={18} aria-hidden="true" />}
              Save again here
            </button>
            <button
              type="button"
              onClick={() => onChange({ location: null, showOnMap: false })}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-white text-sm font-bold text-rose-700"
            >
              <Trash2 size={18} aria-hidden="true" /> Remove
            </button>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-canvas p-3" data-say="Show my farm area to buyers on the Harvest Passport. Only about one kilometre, not the exact place.">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-primary"
              checked={showOnMap}
              onChange={(event) => onChange({ location, showOnMap: event.target.checked })}
            />
            <span className="text-sm">
              <span className="block font-bold text-ink">Show my farm area to buyers</span>
              <span className="block text-ink-soft">
                On the Harvest Passport map, rounded to about 1 km. Your exact place stays private.
              </span>
            </span>
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={capture}
          disabled={busy}
          data-say="Save my farm location. Stand on the farm first."
          className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/40 bg-primary-soft text-base font-bold text-primary-dark disabled:opacity-70"
        >
          {busy ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <MapPinned size={20} aria-hidden="true" />}
          {busy ? "Finding the farm…" : "Save my farm location"}
        </button>
      )}
      {error && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{error}</p>}
    </section>
  );
}
