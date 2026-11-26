import { Camera, Clock3, Loader2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { api } from "../lib/api.js";
import {
  MAX_PER_HARVEST,
  preparePhoto,
  queueHarvestPhoto,
  removeWaitingPhoto,
  sendWaitingPhotos,
  useBlobUrl,
  usePhotoUrl,
  waitingPhotos
} from "../lib/photos.js";
import { Section } from "./Choices.jsx";

const TITLE = {
  text: "Photos of the harvest",
  say: "Photos of the harvest. Take a picture of your crop as proof. Buyers see it on the Harvest Passport."
};

function SentPhoto({ photo, token, onOpen, onRemove }) {
  const url = usePhotoUrl(photo.id, token);
  return (
    <li className="relative aspect-square overflow-hidden rounded-xl bg-emerald-50">
      {url ? (
        <button type="button" onClick={() => onOpen(url)} className="h-full w-full" aria-label="See the photo bigger">
          <img src={url} alt="Harvest" className="h-full w-full object-cover" />
        </button>
      ) : (
        <span className="flex h-full items-center justify-center">
          <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(photo)}
        aria-label="Remove this photo"
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-rose-700 shadow"
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </li>
  );
}

function WaitingPhoto({ item, onRemove }) {
  const url = useBlobUrl(item.blob);
  return (
    <li className="relative aspect-square overflow-hidden rounded-xl bg-emerald-50">
      {url && <img src={url} alt="Harvest, waiting for network" className="h-full w-full object-cover opacity-80" />}
      <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-lg bg-amber-100/95 px-1 py-0.5 text-[10px] font-bold text-amber-900">
        <Clock3 size={11} aria-hidden="true" /> Waiting
      </span>
      <button
        type="button"
        onClick={() => onRemove(item)}
        aria-label="Remove this photo"
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-rose-700 shadow"
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </li>
  );
}

// Photo proof of a harvest batch. Works without network: photos wait on the
// phone and are sent later. Shown to buyers on the Harvest Passport.
export default function HarvestPhotos({ harvest, className = "" }) {
  const { user, token } = useAuth();
  const { online } = useSync();
  const toast = useToast();
  const input = useRef(null);
  const [sent, setSent] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(null);
  const serverId = harvest?.id && !String(harvest.id).startsWith("local-") ? harvest.id : null;

  const load = useCallback(async () => {
    if (!harvest?.clientId || !user?.id) return;
    setWaiting(await waitingPhotos(user.id, harvest.clientId));
    if (online && token && serverId) {
      try {
        const result = await api.get(`/api/photos?harvestId=${serverId}`, { token });
        setSent(result.photos);
      } catch {
        // Keep what we have.
      }
    }
  }, [harvest?.clientId, user?.id, online, token, serverId]);

  useEffect(() => {
    load();
    const again = () => load();
    window.addEventListener("farmbok:photos-sent", again);
    return () => window.removeEventListener("farmbok:photos-sent", again);
  }, [load]);

  const total = sent.length + waiting.length;

  async function addPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await preparePhoto(file);
      await queueHarvestPhoto(user.id, harvest.clientId, blob);
      if (online && serverId) {
        await sendWaitingPhotos(user.id, token);
        toast.success("Photo saved. Buyers can see it when the passport is on.");
      } else {
        toast.success("Photo saved on your phone. It will be sent when you are online.");
      }
      await load();
    } catch (error) {
      toast.error(error.message || "Could not save the photo.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSent(photo) {
    try {
      await api.delete(`/api/photos/${photo.id}`, { token });
      setSent((list) => list.filter((item) => item.id !== photo.id));
    } catch (error) {
      toast.error(error.isNetworkError ? "Removing a sent photo needs network." : error.message);
    }
  }

  async function removeWaiting(item) {
    await removeWaitingPhoto(user.id, item.clientId);
    setWaiting((list) => list.filter((row) => row.clientId !== item.clientId));
  }

  return (
    <Section title={TITLE} className={className}>
      <p className="text-sm text-ink-soft">
        Take a clear photo of the crop, the bags or the store. Buyers see these on the Harvest Passport. Up to {MAX_PER_HARVEST}.
      </p>
      {total > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {sent.map((photo) => (
            <SentPhoto key={photo.id} photo={photo} token={token} onOpen={setBig} onRemove={removeSent} />
          ))}
          {waiting.map((item) => (
            <WaitingPhoto key={item.clientId} item={item} onRemove={removeWaiting} />
          ))}
        </ul>
      )}
      {total < MAX_PER_HARVEST && (
        <>
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={addPhoto} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            data-say="Take a photo of the harvest."
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft text-sm font-bold text-primary-dark disabled:opacity-70"
          >
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
            {busy ? "Saving the photo…" : total ? "Add another photo" : "Take a photo of the harvest"}
          </button>
        </>
      )}
      {big && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-label="Harvest photo">
          <img src={big} alt="Harvest" className="max-h-full max-w-full rounded-xl object-contain" />
          <button
            type="button"
            onClick={() => setBig(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </Section>
  );
}
