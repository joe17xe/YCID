// ============================================================
// Extraction d'adresses email depuis un collage brut
// ============================================================
// Sert à l'import en masse d'utilisateurs : on accepte tel quel un
// en-tête de courriel, une liste de diffusion ou un tableau, quels que
// soient les séparateurs (retour à la ligne, virgule, point-virgule).

export interface Recipient {
  email: string
  fullName: string
}

export function parseRecipients(raw: string): Recipient[] {
  const out = new Map<string, string>()
  const re = /(?:"?([^"<>;,\n]+?)"?\s*)?<?([\w.+-]+@[\w-]+\.[\w.-]+)>?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const email = m[2].toLowerCase()
    let name = (m[1] ?? '').trim().replace(/[;,]$/, '').trim()
    // « adresse <adresse> » : le libellé répète l'adresse, on l'ignore
    if (name.toLowerCase() === email || name.includes('@')) name = ''
    // À défaut, nom lisible dérivé de la partie locale (p.nom → P Nom)
    if (!name) {
      name = email.split('@')[0].split(/[._+-]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }
    if (!out.has(email)) out.set(email, name)
  }
  return [...out].map(([email, fullName]) => ({ email, fullName }))
}
