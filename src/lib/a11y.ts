/** Display preferences for low-vision users, persisted in a small non-sensitive cookie. */
export const A11Y_COOKIE = "saathi_display";

export const TEXT_SIZES = ["md", "lg", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const CONTRASTS = ["normal", "high"] as const;
export type Contrast = (typeof CONTRASTS)[number];

export interface DisplayPrefs {
  textSize: TextSize;
  contrast: Contrast;
}

export const DEFAULT_PREFS: DisplayPrefs = { textSize: "md", contrast: "normal" };

const isTextSize = (value: string | undefined): value is TextSize =>
  (TEXT_SIZES as readonly string[]).includes(value ?? "");
const isContrast = (value: string | undefined): value is Contrast =>
  (CONTRASTS as readonly string[]).includes(value ?? "");

/** Reads the display-preference cookie; anything unexpected falls back to the defaults. */
export function parseA11y(raw: string | undefined | null): DisplayPrefs {
  if (!raw) return DEFAULT_PREFS;
  const [size, contrast] = raw.split(".");
  return {
    textSize: isTextSize(size) ? size : DEFAULT_PREFS.textSize,
    contrast: isContrast(contrast) ? contrast : DEFAULT_PREFS.contrast,
  };
}

export function serializeA11y(p: DisplayPrefs): string {
  return `${p.textSize}.${p.contrast}`;
}
