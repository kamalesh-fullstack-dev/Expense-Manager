type Cell = string | number | null | undefined;

// A leading = + - or @ would run as a formula when the file is opened in a spreadsheet.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(cell: Cell) {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return String(cell);

  const safe = FORMULA_START.test(cell) ? `'${cell}` : cell;

  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const toCsv = (headers: string[], rows: Cell[][]) =>
  [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
