import { passportPhotoIds } from "./photoService.js";
import { query } from "../config/database.js";
import { badRequest, notFound } from "../lib/errors.js";
import { firstNameOnly } from "../lib/text.js";

// Harvest Passport: what a buyer sees after scanning a batch's QR code.
// Shown only when the farmer turned the passport on for that batch. It never
// includes a phone number, full name or exact location (a map point is only
// shown when the farmer allows it, rounded to about 1 km),
// and it is clearly marked as farmer-recorded (not a certification).
export async function getPassport(code) {
  if (typeof code !== "string" || !/^LR-[A-Z0-9]{10}$/.test(code.trim().toUpperCase())) {
    throw badRequest("This passport code is not valid.");
  }
  const { rows } = await query(
    `SELECT h.*, f.farm_name, f.county, f.district, f.community, f.farm_type, f.size, f.size_unit,
            f.main_crop_or_livestock, f.latitude, f.longitude, f.show_on_map, fr.full_name, fr.id AS owner_id
     FROM harvests h
     JOIN farms f ON f.id = h.farm_id
     JOIN farmers fr ON fr.id = h.farmer_id
     WHERE h.passport_code = $1 AND h.passport_public = true AND h.deleted_at IS NULL
       AND fr.status = 'active'`,
    [code.trim().toUpperCase()]
  );
  const harvest = rows[0];
  if (!harvest) throw notFound("This Harvest Passport is not available.");

  const inspection = await query(
    `SELECT inspection_date, grade, checks, moisture_percent, inspector
     FROM quality_inspections
     WHERE harvest_id = $1 AND deleted_at IS NULL
     ORDER BY inspection_date DESC, created_at DESC LIMIT 1`,
    [harvest.id]
  );
  // Farm work in the year before the harvest: what was planted and which
  // fertilizer or medicine was used, for traceability.
  const activities = await query(
    `SELECT activity_type, activity_date, input_used, quantity, unit
     FROM farm_activities
     WHERE farm_id = $1 AND deleted_at IS NULL
       AND activity_date BETWEEN ($2::date - 365) AND $2::date
     ORDER BY activity_date ASC LIMIT 60`,
    [harvest.farm_id, harvest.harvest_date]
  );
  const groups = await query(
    `SELECT c.name FROM cooperative_members m JOIN cooperatives c ON c.id = m.cooperative_id
     WHERE m.farmer_id = $1 AND m.status = 'active' AND c.status = 'active' ORDER BY c.name`,
    [harvest.owner_id]
  );
  // Only sales in the batch's own unit are counted (sales from a batch take
  // its unit; very old records might not), and never more than the batch.
  const sold = await query(
    `SELECT COALESCE(sum(quantity), 0) AS quantity FROM sales
     WHERE harvest_id = $1 AND deleted_at IS NULL AND unit = $2`,
    [harvest.id, harvest.unit]
  );
  const quantitySold = Math.min(Number(sold.rows[0].quantity), Number(harvest.quantity));

  const latest = inspection.rows[0];
  const photoIds = await passportPhotoIds(harvest.id);
  return {
    passport: {
      code: harvest.passport_code,
      // Photos the farmer took of this harvest.
      photos: photoIds.map((id) => ({ id, url: `/api/passport/${harvest.passport_code}/photos/${id}` })),
      crop: harvest.crop,
      quantity: Number(harvest.quantity),
      unit: harvest.unit,
      harvestDate: harvest.harvest_date,
      quantitySold,
      quantityLeft: Math.max(Number(harvest.quantity) - quantitySold, 0),
      farmer: { firstName: firstNameOnly(harvest.full_name), groups: groups.rows.map((row) => row.name) },
      farm: {
        county: harvest.county,
        district: harvest.district,
        community: harvest.community,
        farmType: harvest.farm_type,
        size: harvest.size === null ? null : Number(harvest.size),
        sizeUnit: harvest.size_unit,
        // Only when the farmer chose to show it, and rounded to about 1 km.
        location:
          harvest.show_on_map && harvest.latitude !== null
            ? {
                latitude: Math.round(Number(harvest.latitude) * 100) / 100,
                longitude: Math.round(Number(harvest.longitude) * 100) / 100,
                approximate: true
              }
            : null
      },
      quality: latest
        ? {
            grade: latest.grade,
            checkedOn: latest.inspection_date,
            checks: latest.checks || {},
            moisturePercent: latest.moisture_percent === null ? null : Number(latest.moisture_percent),
            checkedBy: latest.inspector || null
          }
        : null,
      farmWork: activities.rows.map((row) => ({
        activityType: row.activity_type,
        date: row.activity_date,
        inputUsed: row.input_used,
        quantity: row.quantity === null ? null : Number(row.quantity),
        unit: row.unit
      })),
      notice:
        "Recorded by the farmer in the FarmBok app. This is not an official certification.",
      // Buyers can leave their number for the farmer (POST …/contact).
      canContact: true
    }
  };
}
