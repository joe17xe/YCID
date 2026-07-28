// ============================================================
// Drapeau Unicode à partir d'un nom de pays saisi librement
// ============================================================
// `projects.country` est du texte libre (« Liban », « France »…). On le
// rapproche d'un code ISO 3166-1, puis on le convertit en indicateurs
// régionaux Unicode — un drapeau en caractères, pas une image (V1,
// arbitrage du 27/07 : « drapeau du pays, Unicode, pas d'emoji image »).
//
// La table couvre les pays du portefeuille et leurs graphies probables ;
// un pays inconnu rend `null`, et l'écran n'affiche simplement pas de
// drapeau — plutôt qu'un drapeau faux ou un carré de remplacement.

const COUNTRY_CODES: Record<string, string> = {
  liban: "LB",
  lebanon: "LB",
  france: "FR",
  yvelines: "FR",
  maroc: "MA",
  morocco: "MA",
  senegal: "SN",
  madagascar: "MG",
  tunisie: "TN",
  tunisia: "TN",
  togo: "TG",
  benin: "BJ",
  mali: "ML",
  cameroun: "CM",
  cameroon: "CM",
  "cote d'ivoire": "CI",
  "cote divoire": "CI",
  armenie: "AM",
  armenia: "AM",
  haiti: "HT",
}

// « Sénégal » et « senegal » désignent le même pays : on compare sans
// accents ni majuscules.
function normalize(raw: string): string {
  return raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function countryCode(country: string | null | undefined): string | null {
  if (!country) return null
  return COUNTRY_CODES[normalize(country)] ?? null
}

export function countryFlag(country: string | null | undefined): string | null {
  const code = countryCode(country)
  if (!code) return null
  // A→Z (0x41…) décalés vers les indicateurs régionaux (0x1F1E6…)
  return String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 0x41))
}
