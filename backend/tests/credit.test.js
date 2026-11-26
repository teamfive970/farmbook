import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, query, resetDatabase, startServer } from "./helpers.js";

let server;
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

before(async () => {
  server = await startServer();
});
beforeEach(resetDatabase);
after(async () => {
  await server.close();
  await closeDatabase();
});

async function setup() {
  const reg = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { fullName: "Musu Kollie", phoneNumber: "0775556001", county: "Bong", district: "Jorquelleh", community: "Gbarnga", pin: "1122", confirmPin: "1122" }
  });
  const { rows } = await query("SELECT id FROM farmers WHERE phone_number = '+231775556001'");
  const id = rows[0].id;
  const sale = await query(
    `INSERT INTO sales (farmer_id, client_id, crop, quantity, unit, unit_price, total_amount, currency, sale_date)
     VALUES ($1, 'sale-credit-0001', 'Rice', 10, 'bags', 3000, 30000, 'LRD', $2) RETURNING id`,
    [id, daysAgo(20)]
  );
  await query(
    `INSERT INTO payments (farmer_id, client_id, sale_id, sale_client_id, amount, paid_date) VALUES ($1, 'pay-credit-0001', $2, 'sale-credit-0001', 30000, $3)`,
    [id, sale.rows[0].id, daysAgo(18)]
  );
  await query(
    `INSERT INTO expenses (farmer_id, client_id, expense_date, category, amount, currency) VALUES ($1, 'exp-credit-0001', $2, 'seeds', 4000, 'LRD')`,
    [id, daysAgo(60)]
  );
  await query(
    `INSERT INTO expenses (farmer_id, client_id, expense_date, category, amount, currency) VALUES ($1, 'exp-credit-0002', $2, 'tools', 9000, 'LRD')`,
    [id, daysAgo(500)]
  );
  return { token: reg.body.token, id };
}

test("a farmer makes a lender link; the lender sees 12 months of records", async () => {
  const { token } = await setup();
  const made = await api(server.baseUrl, "/api/credit-shares", { method: "POST", token, body: { lenderName: "LEAP Microfinance", days: 30 } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const { code } = made.body.share;
  assert.match(code, /^CR-[A-Z0-9]{10}$/);
  assert.equal(made.body.share.status, "active");

  const seen = await api(server.baseUrl, `/api/credit/${code}`);
  assert.equal(seen.status, 200, JSON.stringify(seen.body));
  const record = seen.body.record;
  assert.equal(record.farmer.name, "Musu Kollie");
  assert.equal(record.farmer.phone, "+231775556001");
  assert.equal(record.monthly.length, 12);
  assert.deepEqual(record.totals.in, { LRD: 30000, USD: 0 });
  assert.deepEqual(record.totals.out, { LRD: 4000, USD: 0 }, "costs older than 12 months are left out");
  assert.deepEqual(record.totals.profit, { LRD: 26000, USD: 0 });
  assert.deepEqual(record.sales, [{ currency: "LRD", count: 1, value: 30000, buyers: 0, fullyPaid: 1 }]);
  assert.equal(seen.body.share.lenderName, "LEAP Microfinance");

  const list = await api(server.baseUrl, "/api/credit-shares", { token });
  assert.equal(list.body.shares[0].viewCount, 1);
});

test("without contact, the lender sees first name and county only", async () => {
  const { token } = await setup();
  const made = await api(server.baseUrl, "/api/credit-shares", { method: "POST", token, body: { includeContact: false, days: 7 } });
  const seen = await api(server.baseUrl, `/api/credit/${made.body.share.code}`);
  assert.equal(seen.body.record.farmer.name, "Musu");
  assert.equal(seen.body.record.farmer.phone, null);
  assert.equal(seen.body.record.farmer.place, "Bong");
  assert.equal(JSON.stringify(seen.body).includes("775556001"), false);
});

test("stopped, expired and wrong links do not work; bad input is refused", async () => {
  const { token, id } = await setup();
  const made = await api(server.baseUrl, "/api/credit-shares", { method: "POST", token, body: {} });
  const stop = await api(server.baseUrl, `/api/credit-shares/${made.body.share.id}/stop`, { method: "POST", token });
  assert.equal(stop.body.share.status, "stopped");
  assert.equal((await api(server.baseUrl, `/api/credit/${made.body.share.code}`)).status, 404);

  const old = await api(server.baseUrl, "/api/credit-shares", { method: "POST", token, body: { days: 7 } });
  await query("UPDATE credit_shares SET expires_at = now() - interval '1 minute' WHERE id = $1", [old.body.share.id]);
  assert.equal((await api(server.baseUrl, `/api/credit/${old.body.share.code}`)).status, 404);

  assert.equal((await api(server.baseUrl, "/api/credit/CR-AAAAAAAAAA")).status, 404);
  assert.equal((await api(server.baseUrl, "/api/credit/hello")).status, 404);
  assert.equal((await api(server.baseUrl, "/api/credit-shares", { method: "POST", token, body: { days: 365 } })).status, 400);
  assert.equal((await api(server.baseUrl, "/api/credit-shares", { method: "POST", token, body: { includeContact: "yes" } })).status, 400);
  assert.equal((await api(server.baseUrl, "/api/credit-shares")).status, 401);

  // Another farmer cannot stop my link.
  const other = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { fullName: "Jallah Kpoto", phoneNumber: "0775556002", county: "Bomi", district: "D", community: "C", pin: "1122", confirmPin: "1122" }
  });
  const mine = await api(server.baseUrl, "/api/credit-shares", { method: "POST", token, body: {} });
  assert.equal((await api(server.baseUrl, `/api/credit-shares/${mine.body.share.id}/stop`, { method: "POST", token: other.body.token })).status, 404);

  // An inactive farmer's links stop.
  await query("UPDATE farmers SET status = 'inactive' WHERE id = $1", [id]);
  assert.equal((await api(server.baseUrl, `/api/credit/${mine.body.share.code}`)).status, 404);
});
