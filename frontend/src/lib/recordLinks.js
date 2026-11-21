// Where each kind of record is opened, so problems can link straight to it.
export function recordPath(kind, record) {
  if (!record) return null;
  switch (kind) {
    case "harvests":
      return `/app/harvests/${record.clientId}`;
    case "inspections":
      return record.harvestClientId ? `/app/harvests/${record.harvestClientId}/check/${record.clientId}` : null;
    case "sales":
      return `/app/money/sales/${record.clientId}`;
    case "payments":
      return record.saleClientId ? `/app/money/sales/${record.saleClientId}` : null;
    case "expenses":
      return `/app/money/spend/${record.clientId}`;
    case "buyers":
      return `/app/money/buyers/${record.clientId}`;
    case "productions":
      return `/app/productions/${record.clientId}`;
    case "animalEvents":
      return record.productionClientId ? `/app/productions/${record.productionClientId}` : null;
    case "farms":
      return record.id ? `/app/farms/${record.id}` : null;
    default:
      return null;
  }
}
