import { Camera, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { MAX_PER_HARVEST, preparePhoto, useBlobUrl } from "../lib/photos.js";

function Thumb({ blob, onRemove }) {
  const url = useBlobUrl(blob);
  return (
    <li className="relative aspect-square overflow-hidden rounded-xl bg-emerald-50">
      {url && <img src={url} alt="Harvest" className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this photo"
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rose-700 shadow"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

// Choose harvest photos before the harvest is saved. They are kept on the
// phone with the harvest and sent with it.
export default function PhotoPicker({ photos, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(event) {
    const files = [...(event.target.files || [])].slice(0, MAX_PER_HARVEST - photos.length);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const blobs = [];
      for (const file of files) blobs.push(await preparePhoto(file));
      onChange([...photos, ...blobs]);
    } catch (problem) {
      setError(problem.message || "Could not use this photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {photos.length > 0 && (
        <ul className="mb-3 grid grid-cols-4 gap-2">
          {photos.map((blob, index) => (
            <Thumb key={index} blob={blob} onRemove={() => onChange(photos.filter((_, i) => i !== index))} />
          ))}
        </ul>
      )}
      {photos.length < MAX_PER_HARVEST && (
        <>
          <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={add} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            data-say="Take a photo of the harvest."
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft text-sm font-bold text-primary-dark disabled:opacity-70"
          >
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
            {photos.length ? "Add another photo" : "Take a photo of the harvest"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}
    </div>
  );
}
