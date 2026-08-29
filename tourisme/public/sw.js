/* Visit Azour — service worker.
   Trois familles de caches :
   - va-shell-vN : l'enveloppe (pages visitées, assets Next, photos, icônes)
   - va-pack-<slug>-vX : les packs sentier téléchargés par le visiteur
     (gérés par la page, versionnés par le champ `version` du parcours)
   - va-tiles : les tuiles de carte, mises en cache au fil de la consultation
   Hors-ligne : navigation réseau d'abord, puis cache (packs compris),
   puis l'accueil en dernier recours. */
const SHELL = 'va-shell-v1'
const TILES = 'va-tiles'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('va-shell-') && n !== SHELL)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

const estTuile = (url) =>
  url.hostname.includes('openfreemap.org') ||
  url.hostname.includes('tile.openstreetmap.org') ||
  url.pathname.endsWith('.pbf')

const estAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/photos/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname.startsWith('/api/gpx/')

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Tuiles et polices : cache d'abord, réseau en complément
  if (estTuile(url) || url.hostname.includes('fonts.g')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copie = res.clone()
              caches.open(TILES).then((c) => c.put(req, copie))
            }
            return res
          }),
      ),
    )
    return
  }

  // Assets et GPX : cache d'abord (immuables ou versionnés)
  if (url.origin === self.location.origin && estAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copie = res.clone()
              caches.open(SHELL).then((c) => c.put(req, copie))
            }
            return res
          }),
      ),
    )
    return
  }

  // Navigations : réseau d'abord, sinon cache (packs inclus), sinon l'accueil
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copie = res.clone()
            caches.open(SHELL).then((c) => c.put(req, copie))
          }
          return res
        })
        .catch(async () => {
          const hit = await caches.match(req, { ignoreSearch: true })
          return hit || caches.match('/')
        }),
    )
  }
})
