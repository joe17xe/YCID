'use client'
import { useEffect, useRef } from 'react'
import maplibregl, { LngLatBounds, type Map as MlMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LineString, Position } from '@/lib/types'

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
    // inaccessibles), on retombe sur un fond uni — la trace et les
    // étapes restent dessinées, l'essentiel survit.
    const secours = window.setTimeout(() => {
      if (!map.isStyleLoaded()) {
        map.setStyle({
          version: 8,
          sources: {},
          layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#e9e6da' } }],
        })
      }
    }, 3500)

    map.on('load', () => {
      for (const t of traces) {
        map.addSource(`trace-${t.id}`, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: t.line },
        })
        map.addLayer({
          id: `trace-halo-${t.id}`,
          type: 'line',
          source: `trace-${t.id}`,
          paint: { 'line-color': '#f6f4ea', 'line-width': 7, 'line-opacity': 0.85 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })
        map.addLayer({
          id: `trace-${t.id}`,
          type: 'line',
          source: `trace-${t.id}`,
          paint: {
            'line-color': '#1e5741',
            'line-width': 3.5,
            ...(t.provisoire ? { 'line-dasharray': [2.2, 1.6] } : {}),
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
