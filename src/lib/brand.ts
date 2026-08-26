// Centralized co-branding tokens. This is a collaboration between Bowler Hat
// and AllTru, so both logos/names appear together in the header and both PDF
// downloads. Colors below are sampled directly from the real logo files in
// `public/logos/` (bowlerhat.png / alltru.png) - not guessed. Bowler Hat's
// brand blue (#007aff) is distinct from the dashboard's existing functional
// teal (used for score rings/badges/active tabs), so brand identity and
// semantic "good/pass" color stay independently meaningful. AllTru's mint
// (#17ffd6) is close to that functional teal by coincidence of their own
// brand, not a stand-in for it.
//
// Both logos are now transparent-background and need a light backing chip
// to stay legible on the dark dashboard - see BrandLockup.tsx, which sits
// them together in one shared light chip rather than two separate ones.
// bowlerhat.png started as a fully opaque navy lockup (white wordmark on a
// solid navy rectangle, cropped from a larger header banner); it's been
// reprocessed into a transparent PNG with the wordmark recolored to the
// same navy (#293643) it used to sit on top of, so it now reads as dark ink
// on light instead of light ink on dark - the hat icon's blue (#007aff) is
// pixel-identical to the original, untouched.

export interface BrandDef {
  name: string;
  color: string;
  colorRgb: [number, number, number]; // for jsPDF, which wants 0-255 RGB triples
  logoUrl: string;
  logoNeedsLightBacking: boolean;
  logoAspect: number; // width / height, for reserving layout space before the image loads
}

export const BOWLER_HAT: BrandDef = {
  name: "Bowler Hat",
  color: "#007aff",
  colorRgb: [0, 122, 255],
  logoUrl: "/logos/bowlerhat.png",
  logoNeedsLightBacking: true,
  // Cropped to just the icon + wordmark combination graphic - the original
  // upload was a full header banner (diagonal stripe, extra padding) that
  // wasn't meant to be the logo itself.
  logoAspect: 206 / 36,
};

export const ALLTRU: BrandDef = {
  name: "AllTru",
  color: "#17ffd6",
  colorRgb: [23, 255, 214],
  logoUrl: "/logos/alltru.png",
  logoNeedsLightBacking: true,
  logoAspect: 320 / 121,
};

export const REPORT_TITLE = "SEO & Marketing Audit";
