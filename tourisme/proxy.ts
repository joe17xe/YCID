import { NextResponse, type NextRequest } from 'next/server'

// ?lang=ar|fr|en sur n'importe quelle URL : pose le cookie de langue et
// nettoie l'URL. C'est ce qui permet aux QR (panneaux, kiosque) et aux
// liens partagés d'ouvrir l'app dans la bonne langue.
export function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang')
  if (lang === 'ar' || lang === 'fr' || lang === 'en') {
    const url = request.nextUrl.clone()
    url.searchParams.delete('lang')
    const response = NextResponse.redirect(url)
    response.cookies.set('VA_LOCALE', lang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    return response
  }
  return NextResponse.next()
}

export const config = {
  // Tout sauf les fichiers statiques et l'interne Next
  matcher: ['/((?!_next|photos|icons|sw\\.js|manifest|favicon).*)'],
}
