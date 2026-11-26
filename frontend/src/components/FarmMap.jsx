import { ExternalLink, MapPin, Navigation } from "lucide-react";

// Map links that work on any phone, with no map keys.
export function directionsUrl({ latitude, longitude }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function placeSearchUrl(parts) {
  const text = [...parts.filter(Boolean), "Liberia"].join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

function osmEmbed({ latitude, longitude }, spread) {
  const bbox = [longitude - spread, latitude - spread * 0.8, longitude + spread, latitude + spread * 0.8]
    .map((value) => value.toFixed(5))
    .join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
}

// A small map (OpenStreetMap). Needs network; without it the box shows the
// place in words and the link still works later.
export function MapBox({ location, approximate = false, label = "Farm location", className = "" }) {
  const spread = approximate ? 0.03 : 0.008;
  return (
    <div className={`relative overflow-hidden rounded-xl border border-line bg-emerald-50 ${className}`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-semibold text-emerald-900">
        <MapPin size={22} aria-hidden="true" />
        {location.latitude.toFixed(approximate ? 2 : 5)}, {location.longitude.toFixed(approximate ? 2 : 5)}
      </div>
      <iframe
        title={label}
        src={osmEmbed(location, spread)}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="relative h-full w-full border-0"
      />
      {approximate && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow-card">
          Farm area, about 1 km
        </span>
      )}
    </div>
  );
}

// For buyers on the Harvest Passport: the farm area and a directions button,
// or, when the farmer has not shared a point, a search for the town.
export function PassportMap({ farm }) {
  const place = [farm.community, farm.district, farm.county ? `${farm.county} County` : null];
  if (!farm.location) {
    return (
      <a
        href={placeSearchUrl(place)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary"
      >
        <MapPin size={16} aria-hidden="true" /> Find {farm.community || "the town"} on the map
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <MapBox location={farm.location} approximate className="h-48" label="Farm area map" />
      <div className="flex flex-wrap gap-2">
        <a
          href={directionsUrl(farm.location)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white"
        >
          <Navigation size={16} aria-hidden="true" /> Directions to the farm area
        </a>
      </div>
      <p className="text-xs text-ink-soft">
        The point is rounded to about 1 km to keep the farmer's home private. Contact the farmer for the exact place.
      </p>
    </div>
  );
}
