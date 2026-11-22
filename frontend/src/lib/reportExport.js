// Turns the farmer's report (farmReport.js) into files: a CSV that opens in
// Excel or Google Sheets, and a laid-out A4 PDF. Both are made on the phone,
// so they work without network.

import { PdfDoc } from "./pdf.js";
import { formatMoney } from "./ledger.js";
import { longDate } from "./farmReport.js";

const CURRENCY_NAME = { LRD: "Liberian dollars (L$)", USD: "US dollars (US$)" };

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function cell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Stop spreadsheet apps from running text as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const amount = (value) => (Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(2));

export function reportCsv(report) {
  const lines = [];
  const row = (...cells) => lines.push(cells.map(cell).join(","));
  const blank = () => lines.push("");
  const section = (title, header, rows) => {
    blank();
    row(title.toUpperCase());
    if (!rows.length) {
      row("Nothing in this time");
      return;
    }
    row(...header);
    rows.forEach((cells) => row(...cells));
  };

  row("FarmBok farm report");
  row("Farmer", report.farmer.name);
  if (report.farmer.phone) row("Phone", report.farmer.phone);
  if (report.farmer.place) row("Place", report.farmer.place);
  row("Farms", report.scope);
  row("Time", report.periodText);
  row("From", report.period.from || "");
  row("To", report.period.to || "");
  row("Made on", report.madeOn.slice(0, 10));
  row("Note", "Profit = total income - total expenses. Liberian and US dollars are kept apart.");

  section(
    "Summary",
    ["Currency", "Total sales", "Total income", "Total expenses", "Profit"],
    report.currencies.map((currency) => {
      const t = report.totals[currency];
      return [currency, amount(t.sold), amount(t.income), amount(t.spent), amount(t.profit)];
    })
  );
  section(
    "Records counted",
    ["Sales", "Expenses", "Harvests", "Work done", "Crops planted", "Animal groups"],
    [[report.counts.sales, report.counts.expenses, report.counts.harvests, report.counts.work, report.counts.crops, report.counts.animalGroups]]
  );
  if (report.byFarm.length) {
    section(
      "Money by farm",
      ["Farm", "Currency", "Total sales", "Total income", "Total expenses", "Profit"],
      report.byFarm.map((r) => [r.name, r.currency, amount(r.sold), amount(r.income), amount(r.spent), amount(r.profit)])
    );
  }
  section(
    "Money by crop or animal group",
    ["Crop or animals", "Type", "Farm", "Currency", "Total sales", "Total income", "Total expenses", "Profit"],
    report.byProduction.map((r) => [r.name, r.kind, r.farm, r.currency, amount(r.sold), amount(r.income), amount(r.spent), amount(r.profit)])
  );
  section(
    "Expenses by type",
    ["Spent on", "Currency", "Amount", "Share of expenses (%)"],
    report.costsByCategory.map((r) => [r.name, r.currency, amount(r.total), r.share])
  );
  section(
    "Harvests",
    ["Crop or product", "Unit", "Harvests", "Harvested", "Sold", "Still in store"],
    report.harvests.map((r) => [r.crop, r.unit, r.batches, r.harvested, r.sold, r.left])
  );
  section(
    "Crops planted",
    ["Crop", "Farm", "Planted on", "Place", "Status"],
    report.crops.map((r) => [r.name, r.farm, r.planted, r.place, r.status])
  );
  section(
    "Animals",
    ["Animal group", "Farm", "Born or bought", "Died", "Sold", "Eaten or given", "How many now", "Status"],
    report.animals.map((r) => [r.name, r.farm, r.added, r.died, r.sold, r.otherOut, r.now, r.status])
  );
  section("Work done", ["Work", "Times"], report.work.map((r) => [r.name, r.count]));
  if (report.resourceMovements?.length) {
    section(
      "Resources moved",
      ["Date", "What", "From", "To", "Amount"],
      report.resourceMovements.map((r) => [r.date, r.what, r.from, r.to, r.quantity])
    );
  }
  section(
    "Sales",
    ["Date", "What", "Quantity", "Unit", "Buyer", "Farm", "Currency", "Total", "Paid", "Still to pay"],
    report.sales.map((r) => [r.date, r.item, r.quantity, r.unit, r.buyer, r.farm, r.currency, amount(r.total), amount(r.paid), amount(r.toPay)])
  );
  section(
    "Expenses",
    ["Date", "Spent on", "Farm", "For", "Currency", "Amount", "Notes"],
    report.expenses.map((r) => [r.date, r.category, r.farm, r.forWhat, r.currency, amount(r.amount), r.notes])
  );

  // The BOM makes Excel read the file as UTF-8.
  return `﻿${lines.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const COLOR = {
  primary: "#198754",
  primaryDark: "#14532d",
  primarySoft: "#e8f5e9",
  ink: "#1f2937",
  soft: "#6b7280",
  line: "#e3e9e4",
  zebra: "#f8faf8",
  success: "#15803d",
  danger: "#b91c1c",
  expense: "#be123c"
};

const MARGIN = 40;
const FOOTER = 34;

export function reportPdf(report) {
  const doc = new PdfDoc({ title: `Farm report - ${report.farmer.name}`, author: report.farmer.name });
  const width = doc.width - MARGIN * 2;
  const bottom = doc.height - MARGIN - FOOTER;
  let y = MARGIN;

  const newPage = () => {
    doc.addPage();
    // A slim band so every page shows whose report it is.
    doc.text(`Farm report · ${report.farmer.name}`, MARGIN, MARGIN, { size: 8.5, bold: true, color: COLOR.primaryDark });
    doc.text(report.periodText, doc.width - MARGIN, MARGIN, { size: 8.5, color: COLOR.soft, align: "right", maxWidth: width / 2 });
    doc.line(MARGIN, MARGIN + 6, doc.width - MARGIN, MARGIN + 6, { color: COLOR.line });
    y = MARGIN + 22;
  };
  const ensure = (space) => {
    if (y + space > bottom) newPage();
  };

  // ---- Header -------------------------------------------------------------
  doc.rect(0, 0, doc.width, 104, { fill: COLOR.primary });
  doc.text("FARM REPORT", MARGIN, 34, { size: 9, bold: true, color: "#c8ecd6" });
  doc.text(report.farmer.name || "Farmer", MARGIN, 60, { size: 22, bold: true, color: "#ffffff", maxWidth: width - 150 });
  doc.text([report.farmer.place, report.farmer.phone].filter(Boolean).join("  ·  "), MARGIN, 80, {
    size: 9.5,
    color: "#e8f5e9",
    maxWidth: width - 150
  });
  doc.text("FarmBok", doc.width - MARGIN, 34, { size: 12, bold: true, color: "#ffffff", align: "right" });
  doc.text("Farm records", doc.width - MARGIN, 48, { size: 8.5, color: "#c8ecd6", align: "right" });

  y = 124;
  const meta = [
    ["Time", report.periodText],
    ["Farms", report.scope],
    ["Made on", longDate(report.madeOn)]
  ];
  const metaShares = [0.5, 0.3, 0.2];
  let metaX = MARGIN;
  meta.forEach(([label, value], index) => {
    const metaWidth = width * metaShares[index];
    doc.text(label.toUpperCase(), metaX, y, { size: 7.5, bold: true, color: COLOR.soft });
    doc.text(value, metaX, y + 14, { size: 10, bold: true, color: COLOR.ink, maxWidth: metaWidth - 10 });
    metaX += metaWidth;
  });
  y += 34;

  // ---- Money tiles --------------------------------------------------------
  const heading = (title, note) => {
    ensure(46);
    y += 10;
    doc.rect(MARGIN, y - 9, 3, 12, { fill: COLOR.primary });
    doc.text(title, MARGIN + 9, y + 1, { size: 12, bold: true, color: COLOR.ink });
    if (note) doc.text(note, doc.width - MARGIN, y + 1, { size: 8, color: COLOR.soft, align: "right", maxWidth: width / 2 });
    y += 14;
  };

  heading("Money summary", "Profit = total income - total expenses");
  const tileGap = 8;
  const tileWidth = (width - tileGap * 3) / 4;
  for (const currency of report.currencies) {
    const t = report.totals[currency];
    ensure(78);
    doc.text(CURRENCY_NAME[currency], MARGIN, y + 2, { size: 8.5, bold: true, color: COLOR.soft });
    y += 8;
    const tiles = [
      ["Total sales", t.sold, COLOR.ink, "#ffffff"],
      ["Total income", t.income, COLOR.success, "#ffffff"],
      ["Total expenses", t.spent, COLOR.expense, "#ffffff"],
      [t.profit >= 0 ? "Profit" : "Loss", Math.abs(t.profit), t.profit >= 0 ? COLOR.success : COLOR.danger, t.profit >= 0 ? "#ecfdf3" : "#fef2f2"]
    ];
    tiles.forEach(([label, value, color, fill], index) => {
      const x = MARGIN + (tileWidth + tileGap) * index;
      doc.rect(x, y, tileWidth, 52, { fill, stroke: COLOR.line, radius: 6 });
      doc.text(label, x + 10, y + 17, { size: 8.5, color: COLOR.soft });
      doc.text(formatMoney(value, currency), x + 10, y + 38, { size: 14, bold: true, color, maxWidth: tileWidth - 16 });
    });
    y += 64;
  }

  // Counts in one quiet line.
  const c = report.counts;
  ensure(20);
  doc.text(
    [plural(c.sales, "sale"), plural(c.expenses, "expense"), plural(c.harvests, "harvest"), plural(c.work, "work record"), plural(c.crops, "crop"), plural(c.animalGroups, "animal group")].join("  ·  "),
    MARGIN,
    y + 4,
    { size: 8.5, color: COLOR.soft, maxWidth: width }
  );
  y += 12;

  // ---- Tables -------------------------------------------------------------
  // columns: [{ title, width (share), align, money?, bold? }]
  const table = (title, note, columns, rows, { totals } = {}) => {
    heading(title, note);
    if (!rows.length) {
      ensure(22);
      doc.text("Nothing in this time.", MARGIN, y + 8, { size: 9, color: COLOR.soft });
      y += 18;
      return;
    }
    const share = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / share) * width);
    const lefts = widths.map((_, index) => MARGIN + widths.slice(0, index).reduce((sum, value) => sum + value, 0));
    const rowHeight = 18;
    const drawHeader = () => {
      doc.rect(MARGIN, y, width, rowHeight, { fill: COLOR.primarySoft });
      columns.forEach((column, index) => {
        const x = column.align === "right" ? lefts[index] + widths[index] - 6 : lefts[index] + 6;
        doc.text(column.title, x, y + 12, { size: 7.8, bold: true, color: COLOR.primaryDark, align: column.align, maxWidth: widths[index] - 10 });
      });
      y += rowHeight;
    };
    ensure(rowHeight * 2 + 4);
    drawHeader();
    const drawRow = (cells, { fill, bold = false, color } = {}) => {
      if (y + rowHeight > bottom) {
        newPage();
        doc.text(`${title} (continued)`, MARGIN, y + 2, { size: 10, bold: true, color: COLOR.ink });
        y += 12;
        drawHeader();
      }
      if (fill) doc.rect(MARGIN, y, width, rowHeight, { fill });
      cells.forEach((value, index) => {
        const column = columns[index];
        const x = column.align === "right" ? lefts[index] + widths[index] - 6 : lefts[index] + 6;
        const cellColor = typeof color === "function" ? color(index, value) : color;
        doc.text(value ?? "", x, y + 12, {
          size: 8.6,
          bold: bold || column.bold,
          color: cellColor || COLOR.ink,
          align: column.align,
          maxWidth: widths[index] - 10
        });
      });
      y += rowHeight;
    };
    rows.forEach((row, index) => drawRow(row.cells || row, { fill: index % 2 ? COLOR.zebra : null, color: row.color }));
    if (totals) totals.forEach((row) => drawRow(row.cells || row, { fill: "#eef2ef", bold: true, color: row.color }));
    doc.line(MARGIN, y, MARGIN + width, y, { color: COLOR.line });
    y += 6;
  };

  const money = (value, currency) => formatMoney(value, currency);
  const profitColor = (profitIndex) => (index, value) =>
    index === profitIndex ? (String(value).startsWith("-") ? COLOR.danger : COLOR.success) : null;
  const signed = (value, currency) => (value < 0 ? `-${money(Math.abs(value), currency)}` : money(value, currency));
  const moneyColumns = [
    { title: "Total sales", width: 1.15, align: "right" },
    { title: "Income", width: 1.15, align: "right" },
    { title: "Expenses", width: 1.15, align: "right" },
    { title: "Profit", width: 1.15, align: "right", bold: true }
  ];

  if (report.byFarm.length) {
    table(
      "Money by farm",
      "Expenses not tied to a farm are left out here",
      [{ title: "Farm", width: 2.2 }, ...moneyColumns],
      report.byFarm.map((r) => ({
        cells: [r.name, money(r.sold, r.currency), money(r.income, r.currency), money(r.spent, r.currency), signed(r.profit, r.currency)],
        color: profitColor(4)
      }))
    );
  }

  table(
    "Money by crop or animal group",
    "",
    [{ title: "Crop or animals", width: 2.2 }, { title: "Farm", width: 1.4 }, ...moneyColumns],
    report.byProduction.map((r) => ({
      cells: [`${r.name} (${r.kind})`, r.farm, money(r.sold, r.currency), money(r.income, r.currency), money(r.spent, r.currency), signed(r.profit, r.currency)],
      color: profitColor(5)
    }))
  );

  // Expenses by type, with a small bar for each share.
  heading("Where the money went", "Share of total expenses");
  if (!report.costsByCategory.length) {
    ensure(22);
    doc.text("Nothing in this time.", MARGIN, y + 8, { size: 9, color: COLOR.soft });
    y += 18;
  } else {
    const labelWidth = 130;
    const valueWidth = 90;
    const barWidth = width - labelWidth - valueWidth - 40;
    for (const r of report.costsByCategory) {
      ensure(20);
      doc.text(r.name, MARGIN, y + 11, { size: 9, color: COLOR.ink, maxWidth: labelWidth - 8 });
      doc.rect(MARGIN + labelWidth, y + 3, barWidth, 9, { fill: "#f1f5f2", radius: 3 });
      doc.rect(MARGIN + labelWidth, y + 3, Math.max((barWidth * r.share) / 100, 2), 9, { fill: COLOR.expense, radius: 3 });
      doc.text(`${r.share}%`, MARGIN + labelWidth + barWidth + 30, y + 11, { size: 8.5, color: COLOR.soft, align: "right" });
      doc.text(money(r.total, r.currency), doc.width - MARGIN, y + 11, { size: 9, bold: true, color: COLOR.ink, align: "right" });
      y += 18;
    }
    y += 4;
  }

  table(
    "Harvests",
    "Bags, kilo and other units are kept apart",
    [
      { title: "Crop or product", width: 2 },
      { title: "Unit", width: 1 },
      { title: "Harvests", width: 0.8, align: "right" },
      { title: "Harvested", width: 1, align: "right" },
      { title: "Sold", width: 1, align: "right" },
      { title: "In store", width: 1, align: "right" }
    ],
    report.harvests.map((r) => [r.crop, r.unit, String(r.batches), num(r.harvested), num(r.sold), num(r.left)])
  );

  if (report.crops.length) {
    table(
      "Crops planted",
      "",
      [{ title: "Crop", width: 2.2 }, { title: "Farm", width: 1.6 }, { title: "Planted on", width: 1.2 }, { title: "Place", width: 1 }, { title: "Status", width: 0.9 }],
      report.crops.map((r) => [r.name, r.farm, longDate(r.planted), r.place, r.status])
    );
  }

  if (report.animals.length) {
    table(
      "Animals",
      "Changes in this time; 'Now' is today's count",
      [
        { title: "Animal group", width: 2 },
        { title: "Farm", width: 1.4 },
        { title: "Born/bought", width: 1, align: "right" },
        { title: "Died", width: 0.7, align: "right" },
        { title: "Sold", width: 0.7, align: "right" },
        { title: "Eaten/given", width: 1, align: "right" },
        { title: "Now", width: 0.7, align: "right", bold: true }
      ],
      report.animals.map((r) => [r.name, r.farm, change(r.added, "+"), change(r.died, "-"), change(r.sold, "-"), change(r.otherOut, "-"), String(r.now)])
    );
  }

  if (report.work.length) {
    table("Work done", "", [{ title: "Work", width: 3 }, { title: "Times", width: 1, align: "right" }], report.work.map((r) => [r.name, String(r.count)]));
  }

  if (report.resourceMovements?.length) {
    table(
      "Resources moved",
      "Manure to the crops, or crop leftovers to the animals",
      [
        { title: "Date", width: 1.1 },
        { title: "What", width: 2.2 },
        { title: "From", width: 2 },
        { title: "To", width: 2 },
        { title: "Amount", width: 1.2, align: "right" }
      ],
      report.resourceMovements.map((r) => [longDate(r.date), r.what, r.from, r.to, r.quantity || "-"])
    );
  }

  // Sales and expenses lists, with totals per currency at the bottom.
  const saleTotals = report.currencies
    .map((currency) => {
      const list = report.sales.filter((r) => r.currency === currency);
      if (!list.length) return null;
      const sum = (field) => list.reduce((total, r) => total + r[field], 0);
      return ["Total", "", "", plural(list.length, "sale"), money(sum("total"), currency), money(sum("paid"), currency), money(sum("toPay"), currency)];
    })
    .filter(Boolean);
  table(
    "Sales",
    "",
    [
      { title: "Date", width: 1.05 },
      { title: "What", width: 1.6 },
      { title: "Amount", width: 1.05, align: "right" },
      { title: "Buyer", width: 1.4 },
      { title: "Total", width: 1.1, align: "right", bold: true },
      { title: "Paid", width: 1.1, align: "right" },
      { title: "Still to pay", width: 1.1, align: "right" }
    ],
    report.sales.map((r) => [
      longDate(r.date),
      r.item,
      `${num(r.quantity)} ${r.unit}`,
      r.buyer || "-",
      money(r.total, r.currency),
      money(r.paid, r.currency),
      r.toPay > 0 ? money(r.toPay, r.currency) : "-"
    ]),
    { totals: saleTotals }
  );

  const expenseTotals = report.currencies
    .map((currency) => {
      const list = report.expenses.filter((r) => r.currency === currency);
      if (!list.length) return null;
      return ["Total", plural(list.length, "expense"), "", "", money(list.reduce((t, r) => t + r.amount, 0), currency)];
    })
    .filter(Boolean);
  table(
    "Expenses",
    "",
    [
      { title: "Date", width: 1.05 },
      { title: "Spent on", width: 1.3 },
      { title: "Farm", width: 1.4 },
      { title: "For", width: 1.6 },
      { title: "Amount", width: 1.15, align: "right", bold: true }
    ],
    report.expenses.map((r) => [longDate(r.date), r.category, r.farm, r.forWhat || "-", money(r.amount, r.currency)]),
    { totals: expenseTotals }
  );

  // ---- Footer on every page ------------------------------------------------
  doc.eachPage((page, pages) => {
    const footY = doc.height - MARGIN + 6;
    doc.line(MARGIN, footY - 12, doc.width - MARGIN, footY - 12, { color: COLOR.line });
    doc.text("Made with FarmBok. Numbers come from the records saved on this phone.", MARGIN, footY, { size: 7.5, color: COLOR.soft });
    doc.text(`Page ${page} of ${pages}`, doc.width - MARGIN, footY, { size: 7.5, color: COLOR.soft, align: "right" });
  });

  return doc.save();
}

function change(value, sign) {
  return value ? `${sign}${value}` : "0";
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function num(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? number.toLocaleString("en-US") : number.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
