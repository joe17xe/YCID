'use client'
import { useEffect, useRef } from 'react'
import maplibregl, { LngLatBounds, type Map as MlMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LineString, Position } from '@/lib/types'
import { harmoniserFond } from './harmoniser'

// Fond de carte : OpenFreeMap (vectoriel, sans clé, sans limite déclarée)
// par défaut — surchargeable par territoire/déploiement via env.
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty'

export type MapMarker = {
  id: string
  position: Position
  label?: string
  kind?: 'depart' | 'etape' | 'poi' | 'position'
  no?: number
}

export type MapTrace = {
  id: string
  line: LineString
  provisoire?: boolean
}

export default function MapView({
  center,
  zoom = 13.5,
  traces = [],
  markers = [],
  fit = true,
  className = '',
  onMapReady,
}: {
  center: Position
  zoom?: number
  traces?: MapTrace[]
  markers?: MapMarker[]
  fit?: boolean
  className?: string
  onMapReady?: (map: MlMap) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)

  useEffect(() => {
    if (!el.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: el.current,
      style: STYLE_URL,
      center,
      zoom,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }))

    // Connectivité de montagne : si le style ne charge pas (tuiles
    // inaccessibles), on retombe sur un fond calcaire — la trace et les
    // étapes restent dessinées, l'essentiel survit.
    const secours = window.setTimeout(() => {
      if (!map.isStyleLoaded()) {
        map.setStyle({
          version: 8,
          sources: {},
          layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#eae7d9' } }],
        })
      }
    }, 3500)

    const dessiner = () => {
      // Le fond d'abord : on le reteinte avant de poser la trace dessus,
      // pour qu'elle garde toute sa vivacité.
      harmoniserFond(map)

      for (const t of traces) {
        const src = `va-trace-${t.id}`
        if (map.getSource(src)) continue
        map.addSource(src, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: t.line },
        })
        // Gaine claire : la trace se détache de n'importe quel fond.
        map.addLayer({
          id: `va-gaine-${t.id}`,
          type: 'line',
          source: src,
          paint: { 'line-color': '#f6f4ea', 'line-width': 8, 'line-opacity': 0.9 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })
        map.addLayer({
          id: `va-trace-l-${t.id}`,
          type: 'line',
          source: src,
          paint: {
            'line-color': '#14503a',
            'line-width': 4,
            ...(t.provisoire ? { 'line-dasharray': [2.2, 1.5] } : {}),
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })
      }

      if (fit && (traces.length || markers.length)) {
        const bounds = new LngLatBounds()
        traces.forEach((t) => t.line.coordinates.forEach((c) => bounds.extend(c)))
        markers.forEach((m) => bounds.extend(m.position))
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 15.5, duration: 0 })
      }
      onMapReady?.(map)
    }

    map.on('load', dessiner)
    // Le repli de secours change le style : on redessine par-dessus.
    map.on('styledata', () => {
      if (map.isStyleLoaded() && !map.getSource(`va-trace-${traces[0]?.id}`)) dessiner()
    })

    for (const m of markers) {
      const node = document.createElement('div')
      if (m.kind === 'etape' && m.no != null) {
        node.className = 'va-marker-etape'
        node.textContent = String(m.no)
      } else if (m.kind === 'position') {
        node.className = 'va-marker-position'
      } else {
        node.className = m.kind === 'depart' ? 'va-marker-depart' : 'va-marker-poi'
      }
      const marker = new maplibregl.Marker({ element: node }).setLngLat(m.position)
      if (m.label) marker.setPopup(new maplibregl.Popup({ offset: 14 }).setText(m.label))
      marker.addTo(map)
    }

    return () => {
      window.clearTimeout(secours)
      map.remove()
      mapRef.current = null
    }
    // Les données sont figées au montage : la page recharge à chaque navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={el} className={className} />
}
