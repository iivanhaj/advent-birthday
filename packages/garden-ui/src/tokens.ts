/**
 * The palette: a single ink colour on soft paper, like a fine-line
 * illustration. Restraint is the point. Everything is drawn in `line`; the
 * only other colours are light (glass, lamp glow), kraft paper for the cards,
 * and the sky behind the building.
 *
 * theme.css mirrors these as Tailwind colours (bg-paper, text-line, ...).
 */
export const palette = {
  paper: "#FBF1EE", // the building, the page
  line: "#9E3B4C", // every line, all text
  glass: "#F3D9D6", // window glass by day
  glow: "#FBE3B0", // lamplight
  kraft: "#DCC19A", // tags and cards
  kraftInk: "#4A3424", // text on kraft
  night: "#1E1B3A", // night sky / torch darkness
} as const;

export type PaletteColor = keyof typeof palette;

/** Alternate colourways (swap `line`/`paper`/`glass` to re-ink the whole site). */
export const colourways = {
  rose: { line: "#9E3B4C", paper: "#FBF1EE", glass: "#F3D9D6" },
  sage: { line: "#3F6B45", paper: "#EFF4E7", glass: "#DCE8CF" },
  ink: { line: "#2E3E6B", paper: "#F1F2F6", glass: "#D9DFEE" },
} as const;

/** CSS variables the app's next/font loaders write to. */
export const fontVariables = {
  serif: "--font-playfair",
  display: "--font-righteous",
  hand: "--font-caveat",
  body: "--font-nunito",
} as const;
