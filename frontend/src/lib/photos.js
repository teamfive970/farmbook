import { openDB } from "idb";
import { useEffect, useState } from "react";
import { api, fetchBlob } from "./api.js";

// Photos: harvest proof and the farmer's profile photo.
//
// 1. The phone makes each photo smaller (longest side 1280 px) before it is
//    sent. Drawing it again also removes hidden data such as GPS position.
// 2. Harvest photos taken without network wait in a small queue on the phone
//    (IndexedDB) and are sent when the network comes back.
// 3. Photos are only shown to others on a public Harvest Passport.

const MAX_SIDE = 1280;
const MAX_BYTES = 1.4 * 1024 * 1024;
export const MAX_PER_HARVEST = 4;

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older phones: fall back to an <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A photo from the camera or gallery, made small and clean for sending.
export async function preparePhoto(file, { maxSide = MAX_SIDE, square = false } = {}) {
  if (!file || !String(file.type).startsWith("image/")) throw new Error("Choose a photo.");
  const bitmap = await loadBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  let sx = 0;
  let sy = 0;
  let sw = width;
  let sh = height;
  if (square) {
    const side = Math.min(width, height);
    sx = (width - side) / 2;
    sy = (height - side) / 2;
    sw = side;
    sh = side;
  }
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d").drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  for (const quality of [0.82, 0.7, 0.55]) {
    let blob = await canvasBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await canvasBlob(canvas, "image/jpeg", quality);
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("This photo is too big. Try another one.");
}

// ---------------------------------------------------------------------------
// Waiting photos (taken without network)
// ---------------------------------------------------------------------------

function outbox(userId) {
  return openDB(`farmbok-photos-${userId}`, 1, {
    upgrade(db) {
      const store = db.createObjectStore("outbox", { keyPath: "clientId" });
      store.createIndex("harvest", "harvestClientId");
    }
  });
}

export function newPhotoId() {
  const random = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `photo-${random}`;
}

export async function queueHarvestPhoto(userId, harvestClientId, blob) {
  const db = await outbox(userId);
  const item = { clientId: newPhotoId(), harvestClientId, blob, type: blob.type, createdAt: new Date().toISOString() };
  await db.put("outbox", item);
  return item;
}

export async function waitingPhotos(userId, harvestClientId) {
  try {
    const db = await outbox(userId);
    return await db.getAllFromIndex("outbox", "harvest", harvestClientId);
  } catch {
    return [];
  }
}

export async function removeWaitingPhoto(userId, clientId) {
  const db = await outbox(userId);
  await db.delete("outbox", clientId);
}

let flushing = null;

// Sends waiting photos. A photo whose harvest is not sent yet stays waiting.
export function sendWaitingPhotos(userId, token) {
  if (!userId || !token) return Promise.resolve(0);
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    try {
      const db = await outbox(userId);
      const items = await db.getAll("outbox");
      for (const item of items) {
        try {
          await api.post(
            `/api/photos?${new URLSearchParams({ kind: "harvest", harvestClientId: item.harvestClientId, clientId: item.clientId })}`,
            undefined,
            { token, rawBody: new Blob([item.blob], { type: item.type }) }
          );
          await db.delete("outbox", item.clientId);
          sent += 1;
        } catch (error) {
          if (error.isNetworkError) break;
          if (error.status === 409 || error.status >= 500) continue;
          // Refused for good (too many photos, harvest deleted): drop it.
          await db.delete("outbox", item.clientId);
        }
      }
    } catch {
      // IndexedDB not available: nothing waiting.
    }
    if (sent) window.dispatchEvent(new Event("farmbok:photos-sent"));
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

// ---------------------------------------------------------------------------
// Showing the farmer's own photos (they need the session, so they are fetched)
// ---------------------------------------------------------------------------

const urls = new Map();

export function usePhotoUrl(photoId, token) {
  const [url, setUrl] = useState(() => (photoId ? urls.get(photoId) || null : null));
  useEffect(() => {
    if (!photoId || !token) {
      setUrl(null);
      return undefined;
    }
    if (urls.has(photoId)) {
      setUrl(urls.get(photoId));
      return undefined;
    }
    let active = true;
    fetchBlob(`/api/photos/${photoId}`, { token })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        urls.set(photoId, objectUrl);
        if (active) setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [photoId, token]);
  return url;
}

export function useBlobUrl(blob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!blob) return undefined;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}
