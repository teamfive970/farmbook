import { createHash } from "node:crypto";
import { query, withTransaction } from "../config/database.js";
import { ApiError, badRequest, notFound } from "../lib/errors.js";
import { cleanImage } from "../lib/imageClean.js";
import { requireUuid } from "../lib/validation.js";

// Photos of a harvest (proof of the produce, shown on the Harvest Passport
// when the passport is public) and the farmer's profile photo.

export const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_PER_HARVEST = 4;
const MAX_PER_FARMER = 300;

function serialize(row) {
  return {
    id: row.id,
    kind: row.kind,
    harvestId: row.harvest_id,
    clientId: row.client_id,
    contentType: row.content_type,
    size: row.byte_size,
    createdAt: row.created_at
  };
}

async function findHarvest(farmerId, { harvestId, harvestClientId }, client = { query }) {
  if (harvestId) {
    requireUuid(harvestId, "harvestId", "harvest");
    const { rows } = await client.query(
      "SELECT id FROM harvests WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL",
      [harvestId, farmerId]
    );
    return rows[0] || null;
  }
  if (harvestClientId) {
    const { rows } = await client.query(
      "SELECT id FROM harvests WHERE client_id = $1 AND farmer_id = $2 AND deleted_at IS NULL",
      [String(harvestClientId).slice(0, 100), farmerId]
    );
    return rows[0] || null;
  }
  throw badRequest("Choose the harvest for this photo.", { field: "harvestId" });
}

export async function uploadPhoto(farmerId, params = {}, buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw badRequest("Send a photo.", { field: "photo" });
  if (buffer.length > MAX_BYTES) throw badRequest("This photo is too big. Try again; the app makes it smaller.", { field: "photo" });
  const kind = params.kind === "profile" ? "profile" : params.kind === "harvest" ? "harvest" : null;
  if (!kind) throw badRequest("Choose harvest or profile photo.", { field: "kind" });
  const clientId = params.clientId ? String(params.clientId).slice(0, 100) : null;

  const cleaned = cleanImage(buffer);
  if (!cleaned) throw badRequest("Only photos (JPEG or WebP) can be sent.", { field: "photo" });

  if (clientId) {
    const existing = await query("SELECT * FROM photos WHERE farmer_id = $1 AND client_id = $2", [farmerId, clientId]);
    if (existing.rows[0]) return { photo: serialize(existing.rows[0]) };
  }

  return withTransaction(async (client) => {
    const count = await client.query(
      "SELECT count(*)::int AS n FROM photos WHERE farmer_id = $1 AND deleted_at IS NULL",
      [farmerId]
    );
    if (count.rows[0].n >= MAX_PER_FARMER) throw badRequest("You have too many photos. Remove some old ones first.");

    let harvestId = null;
    if (kind === "harvest") {
      const harvest = await findHarvest(farmerId, params, client);
      if (!harvest) {
        if (params.harvestClientId) {
          throw new ApiError(409, "HARVEST_NOT_SENT", "Send the harvest first; the photo will follow.");
        }
        throw notFound("This harvest was not found.");
      }
      harvestId = harvest.id;
      const perHarvest = await client.query(
        "SELECT count(*)::int AS n FROM photos WHERE harvest_id = $1 AND deleted_at IS NULL",
        [harvestId]
      );
      if (perHarvest.rows[0].n >= MAX_PER_HARVEST) {
        throw badRequest(`A harvest can have ${MAX_PER_HARVEST} photos. Remove one first.`, { field: "photo" });
      }
    }

    const { rows } = await client.query(
      `INSERT INTO photos (farmer_id, kind, harvest_id, client_id, content_type, data, byte_size, sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, farmer_id, kind, harvest_id, client_id, content_type, byte_size, created_at`,
      [
        farmerId,
        kind,
        harvestId,
        clientId,
        cleaned.type,
        cleaned.data,
        cleaned.data.length,
        createHash("sha256").update(cleaned.data).digest("hex")
      ]
    );
    const photo = rows[0];
    if (kind === "profile") {
      await client.query(
        `UPDATE photos SET deleted_at = now()
         WHERE farmer_id = $1 AND kind = 'profile' AND id <> $2 AND deleted_at IS NULL`,
        [farmerId, photo.id]
      );
      await client.query("UPDATE farmers SET photo_id = $1, updated_at = now() WHERE id = $2", [photo.id, farmerId]);
    }
    return { photo: serialize(photo) };
  });
}

export async function listHarvestPhotos(farmerId, params = {}) {
  const harvest = await findHarvest(farmerId, params);
  if (!harvest) return { photos: [] };
  const { rows } = await query(
    `SELECT id, kind, harvest_id, client_id, content_type, byte_size, created_at FROM photos
     WHERE harvest_id = $1 AND farmer_id = $2 AND deleted_at IS NULL ORDER BY created_at`,
    [harvest.id, farmerId]
  );
  return { photos: rows.map(serialize) };
}

export async function getOwnPhoto(farmerId, id) {
  requireUuid(id, "id", "photo");
  const { rows } = await query(
    "SELECT content_type, data, sha256 FROM photos WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL",
    [id, farmerId]
  );
  if (!rows[0]) throw notFound("This photo was not found.");
  return rows[0];
}

export async function deletePhoto(farmerId, id) {
  requireUuid(id, "id", "photo");
  const { rows } = await query(
    `UPDATE photos SET deleted_at = now() WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL
     RETURNING kind`,
    [id, farmerId]
  );
  if (!rows[0]) throw notFound("This photo was not found.");
  if (rows[0].kind === "profile") {
    await query("UPDATE farmers SET photo_id = NULL, updated_at = now() WHERE id = $1 AND photo_id = $2", [farmerId, id]);
  }
  return { deleted: true };
}

// Public: a harvest photo, only through its public passport.
export async function getPassportPhoto(code, id) {
  requireUuid(id, "id", "photo");
  const { rows } = await query(
    `SELECT p.content_type, p.data, p.sha256 FROM photos p
     JOIN harvests h ON h.id = p.harvest_id
     JOIN farmers f ON f.id = h.farmer_id
     WHERE p.id = $1 AND h.passport_code = $2 AND h.passport_public = true
       AND h.deleted_at IS NULL AND p.deleted_at IS NULL AND f.status = 'active'`,
    [id, String(code || "").toUpperCase()]
  );
  if (!rows[0]) throw notFound("This photo was not found.");
  return rows[0];
}

export async function passportPhotoIds(harvestId) {
  const { rows } = await query(
    "SELECT id FROM photos WHERE harvest_id = $1 AND deleted_at IS NULL ORDER BY created_at LIMIT $2",
    [harvestId, MAX_PER_HARVEST]
  );
  return rows.map((row) => row.id);
}
