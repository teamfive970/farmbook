import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { api } from "../lib/api.js";
import { initials } from "../lib/format.js";
import { preparePhoto, usePhotoUrl } from "../lib/photos.js";

// The farmer's profile photo, or their initials when there is none.
export default function FarmerAvatar({ className = "h-11 w-11 rounded-xl text-sm" }) {
  const { user, token } = useAuth();
  const url = usePhotoUrl(user?.photoId, token);
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-primary font-bold text-white ${className}`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(user?.fullName) || <UserRound size={20} aria-hidden="true" />
      )}
    </span>
  );
}

// On the Me page: take or choose a profile photo, or remove it.
export function ProfilePhotoControls() {
  const { user, token, setUser } = useAuth();
  const { online } = useSync();
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pending = Boolean(user?.pendingRegistration);

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await preparePhoto(file, { maxSide: 640, square: true });
      const result = await api.post("/api/photos?kind=profile", undefined, { token, rawBody: blob });
      setUser({ ...user, photoId: result.photo.id });
      toast.success("Your photo is saved.");
    } catch (error) {
      toast.error(error.isNetworkError ? "Changing your photo needs network." : error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!user?.photoId) return;
    setBusy(true);
    try {
      await api.delete(`/api/photos/${user.photoId}`, { token });
      setUser({ ...user, photoId: null });
      toast.success("Your photo is removed.");
    } catch (error) {
      toast.error(error.isNetworkError ? "Removing your photo needs network." : error.message);
    } finally {
      setBusy(false);
    }
  }

  if (pending) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={choose} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy || !online}
        data-say="Take or choose your photo."
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-line px-3 text-sm font-bold text-ink disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
        {user?.photoId ? "Change my photo" : "Add my photo"}
      </button>
      {user?.photoId && (
        <button
          type="button"
          onClick={remove}
          disabled={busy || !online}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-rose-200 px-3 text-sm font-bold text-rose-700 disabled:opacity-60"
        >
          <Trash2 size={16} aria-hidden="true" /> Remove
        </button>
      )}
      {!online && <p className="w-full text-xs text-ink-soft">Changing your photo needs network.</p>}
    </div>
  );
}
