import { query } from "../config/database.js";
import { COUNTIES } from "../lib/constants.js";
import { badRequest } from "../lib/errors.js";
import { firstNameOnly } from "../lib/text.js";

// The market: what FarmBok farmers have for sale, and what crops are selling
// for. Both are public and built only from what farmers chose to share or
// recorded themselves:
//   * Harvests for sale: batches whose Harvest Passport the farmer turned on,
//     with some left to sell (not ones that failed their quality check). Same privacy as the passport: first name and
//     community only, never a phone number.
//   * Prices: the typical price per unit from recent sales, shown only when
//     enough sales from enough different farmers back it, so no single
//     farmer's price can be worked out.

const FOR_SALE_DAYS = 180;
const PAGE_SIZE = 24;
const PRICE_DAYS = 60;
const minSales = () => Math.max(Number(process.env.MARKET_MIN_SALES || 3), 1);
const minFarmers = () => Math.max(Number(process.env.MARKET_MIN_FARMERS || 3), 2);

function tidy(text) {
  const value = String(text || "").trim();
  return value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value;
}

function optionalCounty(value) {
  if (value === undefined || value === null || value === "" || value === "all") return null;
  const county = COUNTIES.find((item) => item.toLowerCase() === String(value).trim().toLowerCase());
  if (!county) throw badRequest("Choose a county from the list.", { field: "county" });
  return county;
}

function optionalCrop(value) {
  if (value === undefined || value === null || value === "" || value === "all") return null;
  const crop = String(value).trim().toLowerCase();
  if (crop.length > 60) throw badRequest("Crop name is too long.", { field: "crop" });
  return crop;
}

export async function listHarvestsForSale(filters = {}) {
  const county = optionalCounty(filters.county);
  const crop = optionalCrop(filters.crop);
  const grade = filters.grade && ["A", "B", "C"].includes(String(filters.grade).toUpperCase())
    ? String(filters.grade).toUpperCase()
    : null;
  const page = Math.min(Math.max(Number.parseInt(filters.page, 10) || 1, 1), 50);

  const { rows } = await query(
    `WITH open AS (
       SELECT h.id, h.passport_code, h.crop, h.quantity, h.unit, h.harvest_date, h.farmer_id,
              f.county, f.district, f.community, fr.full_name,
              h.quantity - LEAST(h.quantity, COALESCE((
                SELECT sum(s.quantity) FROM sales s
                WHERE s.harvest_id = h.id AND s.deleted_at IS NULL AND s.unit = h.unit
              ), 0)) AS quantity_left,
              (SELECT q.grade FROM quality_inspections q
               WHERE q.harvest_id = h.id AND q.deleted_at IS NULL
               ORDER BY q.inspection_date DESC, q.created_at DESC LIMIT 1) AS grade
       FROM harvests h
       JOIN farms f ON f.id = h.farm_id
       JOIN farmers fr ON fr.id = h.farmer_id AND NOT fr.is_demo
       WHERE h.passport_public = true AND h.deleted_at IS NULL AND fr.status = 'active'
         AND h.harvest_date >= CURRENT_DATE - $1::int
     )
     SELECT *, count(*) OVER () AS total FROM open
     WHERE quantity_left > 0
       AND (grade IS NULL OR grade <> 'rejected')
       AND ($2::text IS NULL OR county = $2)
       AND ($3::text IS NULL OR lower(trim(crop)) = $3)
       AND ($4::text IS NULL OR grade = $4)
     ORDER BY harvest_date DESC, passport_code
     LIMIT $5 OFFSET $6`,
    [FOR_SALE_DAYS, county, crop, grade, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );

  // What there is to filter by, from everything on offer (not just this page).
  const { rows: options } = await query(
    `SELECT lower(trim(h.crop)) AS crop, f.county, count(*)::int AS n
     FROM harvests h JOIN farms f ON f.id = h.farm_id JOIN farmers fr ON fr.id = h.farmer_id AND NOT fr.is_demo
     WHERE h.passport_public = true AND h.deleted_at IS NULL AND fr.status = 'active'
       AND h.harvest_date >= CURRENT_DATE - $1::int
       AND h.quantity > COALESCE((SELECT sum(s.quantity) FROM sales s
                                  WHERE s.harvest_id = h.id AND s.deleted_at IS NULL AND s.unit = h.unit), 0)
     GROUP BY 1, 2`,
    [FOR_SALE_DAYS]
  );
  const crops = [...new Set(options.map((row) => row.crop))].sort().map(tidy);
  const counties = [...new Set(options.map((row) => row.county))].sort();

  const groups = rows.length
    ? await query(
        `SELECT m.farmer_id, c.name FROM cooperative_members m JOIN cooperatives c ON c.id = m.cooperative_id
         WHERE m.farmer_id = ANY($1::uuid[]) AND m.status = 'active' AND c.status = 'active' ORDER BY c.name`,
        [[...new Set(rows.map((row) => row.farmer_id))]]
      )
    : { rows: [] };
  const groupsOf = new Map();
  for (const row of groups.rows) groupsOf.set(row.farmer_id, [...(groupsOf.get(row.farmer_id) || []), row.name]);

  const total = rows[0] ? Number(rows[0].total) : 0;
  return {
    harvests: rows.map((row) => ({
      passportCode: row.passport_code,
      crop: tidy(row.crop),
      quantity: Number(row.quantity),
      quantityLeft: Number(row.quantity_left),
      unit: row.unit,
      harvestDate: row.harvest_date,
      grade: row.grade || null,
      place: { county: row.county, district: row.district, community: row.community },
      farmer: { firstName: firstNameOnly(row.full_name), groups: groupsOf.get(row.farmer_id) || [] }
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    hasMore: page * PAGE_SIZE < total,
    filters: { crops, counties }
  };
}

// Typical prices: middle price and the usual range (the middle half of sales).
export async function getMarketPrices(filters = {}) {
  const county = optionalCounty(filters.county);
  const params = [PRICE_DAYS, county];
  const { rows } = await query(
    `WITH priced AS (
       SELECT lower(trim(s.crop)) AS crop, s.unit, s.currency, s.farmer_id, s.sale_date,
              COALESCE(s.unit_price, s.total_amount / NULLIF(s.quantity, 0)) AS price,
              CASE WHEN s.sale_date > CURRENT_DATE - $1::int THEN 'now' ELSE 'before' END AS period
       FROM sales s JOIN farmers fr ON fr.id = s.farmer_id AND NOT fr.is_demo
       WHERE s.deleted_at IS NULL AND fr.status = 'active'
         AND s.sale_date > CURRENT_DATE - (2 * $1::int) AND s.sale_date <= CURRENT_DATE
         AND ($2::text IS NULL OR fr.county = $2)
     )
     SELECT crop, unit, currency, period,
            count(*)::int AS sales,
            count(DISTINCT farmer_id)::int AS farmers,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median,
            percentile_cont(0.25) WITHIN GROUP (ORDER BY price) AS low,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY price) AS high,
            max(sale_date) AS latest
     FROM priced WHERE price IS NOT NULL AND price > 0
     GROUP BY crop, unit, currency, period`,
    params
  );
  const enough = (row) => row && row.sales >= minSales() && row.farmers >= minFarmers();
  const round = (value) => Math.round(Number(value) * 100) / 100;
  const key = (row) => `${row.crop}|${row.unit}|${row.currency}`;
  const before = new Map(rows.filter((row) => row.period === "before" && enough(row)).map((row) => [key(row), row]));
  const prices = rows
    .filter((row) => row.period === "now" && enough(row))
    .map((row) => {
      const previous = before.get(key(row));
      const median = round(row.median);
      const previousMedian = previous ? round(previous.median) : null;
      return {
        crop: tidy(row.crop),
        unit: row.unit,
        currency: row.currency,
        median,
        low: round(row.low),
        high: round(row.high),
        sales: row.sales,
        farmers: row.farmers,
        latestSale: row.latest,
        previousMedian,
        changePercent: previousMedian ? Math.round(((median - previousMedian) / previousMedian) * 100) : null
      };
    })
    .sort((a, b) => a.crop.localeCompare(b.crop) || b.sales - a.sales);

  const { rows: places } = await query(
    `SELECT DISTINCT fr.county FROM sales s JOIN farmers fr ON fr.id = s.farmer_id AND NOT fr.is_demo
     WHERE s.deleted_at IS NULL AND fr.status = 'active' AND s.sale_date > CURRENT_DATE - $1::int
     ORDER BY 1`,
    [PRICE_DAYS]
  );

  return {
    county,
    days: PRICE_DAYS,
    rule: { minSales: minSales(), minFarmers: minFarmers() },
    prices,
    counties: places.map((row) => row.county)
  };
}
