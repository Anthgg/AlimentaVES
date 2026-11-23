import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { CommunityKitchen } from '../types'
import { hasValidCoordinates, openStreetMapUrl } from '../lib/kitchen-location'

export function LeafletKitchenMap({ kitchens, selectedId, onSelect, selectedKitchen }: {
  kitchens: CommunityKitchen[]
  selectedId: number | null
  onSelect: (id: number) => void
  selectedKitchen: CommunityKitchen | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef<Map<number, L.CircleMarker>>(new Map())
  const onSelectRef = useRef(onSelect)
  const [tileState, setTileState] = useState<'loading' | 'ready' | 'error'>('loading')
  const located = kitchens.filter(hasValidCoordinates)

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    if (located.length === 0) return
    const container = containerRef.current
    if (!container) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const firstLocated = located[0]
    if (!firstLocated) return
    const map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: true,
      zoomAnimation: !prefersReducedMotion,
      fadeAnimation: !prefersReducedMotion,
      markerZoomAnimation: !prefersReducedMotion,
      preferCanvas: true,
    }).setView([firstLocated.latitude, firstLocated.longitude], 13)
    L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map)
    map.attributionControl.setPrefix(false)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      maxZoom: 19,
      keepBuffer: 0,
      updateWhenIdle: true,
      updateWhenZooming: false,
      detectRetina: false,
      crossOrigin: true,
    })
    tiles.on('tileload', () => setTileState((current) => current === 'error' ? current : 'ready'))
    tiles.on('tileerror', () => setTileState('error'))
    tiles.addTo(map)
    const markerLayer = L.layerGroup().addTo(map)
    mapRef.current = map
    markerLayerRef.current = markerLayer
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      tiles.off()
      markerLayer.clearLayers()
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
    }
  }, [located.length > 0])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current
    if (!map || !markerLayer) return
    markersRef.current.clear()
    markerLayer.clearLayers()
    located.forEach((kitchen) => {
      const selected = selectedId === kitchen.id
      const marker = L.circleMarker([kitchen.latitude, kitchen.longitude], {
        radius: selected ? 8 : 6,
        color: selected ? '#103f32' : '#fffefa',
        weight: selected ? 3 : 2,
        fillColor: selected ? '#e99359' : '#31835c',
        fillOpacity: .95,
      }).bindTooltip(kitchen.name, { direction: 'top', offset: [0, -7] })
      marker.on('click', () => onSelectRef.current(kitchen.id))
      marker.addTo(markerLayer)
      markersRef.current.set(kitchen.id, marker)
    })
  }, [kitchens, selectedId, located.length])

  useEffect(() => {
    if (!selectedKitchen || !hasValidCoordinates(selectedKitchen)) return
    const map = mapRef.current
    if (!map) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.setView([selectedKitchen.latitude, selectedKitchen.longitude], Math.max(14, map.getZoom()), { animate: !reduce, duration: reduce ? 0 : .35 })
  }, [selectedKitchen?.id, selectedKitchen?.latitude, selectedKitchen?.longitude])

  const externalUrl = selectedKitchen ? openStreetMapUrl(selectedKitchen) : null
  if (located.length === 0) return <div className="np-map-unavailable" role="status"><span><IconMarker /></span><h3>No hay coordenadas disponibles en estos resultados.</h3><p>El backend no devolvió latitud y longitud WGS84 para los registros filtrados.</p></div>
  return <div className="np-leaflet-panel">
    <div ref={containerRef} className="np-leaflet-map" role="region" aria-label="Mapa con ubicaciones registradas por el backend" />
    {tileState === 'error' && <div className="np-map-fallback" role="status"><strong>La cartografía externa no está disponible.</strong><span>Los marcadores representan solo coordenadas que devolvió el backend. Puedes abrir el registro seleccionado en OpenStreetMap.</span>{externalUrl && <a href={externalUrl} target="_blank" rel="noreferrer">Abrir OpenStreetMap <span aria-hidden="true">↗</span></a>}</div>}
    {tileState === 'loading' && <p className="np-map-load-note" role="status">Cargando teselas del área visible…</p>}
    <p className="np-map-attribution-note">Mapa &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Las ubicaciones no confirman operación actual.</p>
  </div>
}

function IconMarker() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></svg>
}
