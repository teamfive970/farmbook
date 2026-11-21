// Crop plantings and animal groups (the guide's production records), worked
// out on the phone so they show without network.

export const ANIMAL_ADD_EVENTS = ["born", "bought", "given_in"];
export const ANIMAL_REMOVE_EVENTS = ["died", "sold", "eaten", "given_out"];

export function eventsFor(production, events = []) {
  return events
    .filter((event) => event.productionClientId === production.clientId)
    .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)));
}

// Count now = start + born/bought/given in − died/sold/eaten/given out.
// Same rule as the server (animalCount in resourceService.js).
export function animalCount(production, events = []) {
  let count = Number(production?.startCount || 0);
  for (const event of eventsFor(production, events)) {
    count += ANIMAL_ADD_EVENTS.includes(event.eventType) ? Number(event.quantity) : -Number(event.quantity);
  }
  return count;
}

export function animalTotals(production, events = []) {
  const totals = { born: 0, bought: 0, given_in: 0, died: 0, sold: 0, eaten: 0, given_out: 0 };
  for (const event of eventsFor(production, events)) totals[event.eventType] += Number(event.quantity);
  return totals;
}

export function productionsForFarm(farm, productions = []) {
  if (!farm) return [];
  return productions
    .filter((item) => item.farmClientId === farm.clientId)
    .sort((a, b) =>
      a.status === b.status ? String(b.startDate).localeCompare(String(a.startDate)) : a.status === "active" ? -1 : 1
    );
}

export function productionTitle(production) {
  if (!production) return "";
  return production.label ? `${production.name} · ${production.label}` : production.name;
}

// Records that point at a planting or group (directly, or through a harvest).
export function linkedRecords(production, records = {}, activities = []) {
  const harvests = (records.harvests || []).filter((item) => item.productionClientId === production.clientId);
  const harvestIds = new Set(harvests.map((item) => item.clientId));
  const fromHere = (item) => item.productionClientId === production.clientId || harvestIds.has(item.harvestClientId);
  return {
    harvests,
    sales: (records.sales || []).filter(fromHere),
    expenses: (records.expenses || []).filter(fromHere),
    activities: activities.filter((item) => item.productionClientId === production.clientId),
    events: eventsFor(production, records.animalEvents || [])
  };
}
