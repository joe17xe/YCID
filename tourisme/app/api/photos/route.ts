import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'

/* Le catalogue des images déjà déposées dans public/photos. Il ne
   révèle rien : ces fichiers sont servis publiquement de toute façon.
   Il sert au back-office à proposer une grille où choisir, plutôt que
   de demander à l'éditeur de taper un chemin de mémoire. */

const IMAGES = /\.(jpe?g|png|webp|avif)$/i

export async function GET() {
  try {
    const dossier = join(process.cwd(), 'public', 'photos')
    const fichiers = (await readdir(dossier)).filter((f) => IMAGES.test(f)).sort()
    return NextResponse.json(fichiers.map((f) => `/photos/${f}`))
  } catch {
    // Dossier absent : une galerie vide, pas une erreur 500.
    return NextResponse.json([])
  }
}
