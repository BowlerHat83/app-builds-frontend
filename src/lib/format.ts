export function fmtNum(value: number | null | undefined, opts?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("en-GB", opts).format(value);
}

export function fmtInt(value: number | null | undefined): string {
  return fmtNum(value, { maximumFractionDigits: 0 });
}

export function fmtPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${fmtNum(value, { maximumFractionDigits: digits })}%`;
}

export function fmtMs(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function fmtCurrencyGBP(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value);
}

export function fmtDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  return String(value);
}

export function truncate(value: string | null | undefined, max = 60): string {
  if (!value) return "–";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function hostnameOf(url: string | null | undefined): string {
  if (!url) return "–";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
