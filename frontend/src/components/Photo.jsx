import { useState } from "react";
import { PHOTO_CREDITS } from "../lib/homePhotos.js";

// A photo that fills its box. The box has a green farm-coloured background,
// so if the photo cannot load (no network) the page still looks finished.
export function Photo({ photo, className = "", sizes = "100vw", eager = false, children }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-emerald-700 via-primary to-lime-800 ${className}`}>
      {!failed && (
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes={sizes}
          alt={photo.alt}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: photo.position }}
        />
      )}
      {children}
    </div>
  );
}

export function PhotoCredits({ className = "" }) {
  if (!PHOTO_CREDITS.length) return null;
  return (
    <p className={`text-[11px] leading-relaxed text-ink-soft ${className}`}>
      Photo credits:{" "}
      {PHOTO_CREDITS.map(({ credit, page }, index) => (
        <span key={page}>
          <a href={page} target="_blank" rel="noreferrer" className="underline decoration-line hover:text-primary">
            {credit}
          </a>
          {index < PHOTO_CREDITS.length - 1 ? " · " : ""}
        </span>
      ))}
    </p>
  );
}
