const IST = 330;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const shift = (iso: string, offsetMin: number): Date => {
  const d = new Date(iso);
  return new Date(d.getTime() + offsetMin * 60_000);
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "12 Oct 2014, 10:30 IST" */
export const fmtIST = (iso: string): string => {
  const d = shift(iso, IST);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())} IST`;
};

/** "10:30 IST" */
export const fmtClockIST = (iso: string): string => {
  const d = shift(iso, IST);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`;
};

/** "12 Oct 2014, 05:00 UTC" */
export const fmtUTC = (iso: string): string => {
  const d = shift(iso, 0);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())} UTC`;
};

/** Short map label: "12 Oct 05:00Z" */
export const fmtZulu = (iso: string): string => {
  const d = shift(iso, 0);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )}Z`;
};

export const nowISO = (): string => new Date().toISOString();
