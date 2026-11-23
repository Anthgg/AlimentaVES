import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { CommunityKitchen } from '../types'
import { formatNumber } from '../utils/format'
import { Icon } from './Icon'

function hasCoordinates(kitchen: CommunityKitchen): boolean {
  return typeof kitchen.latitude === 'number'
    && typeof kitchen.longitude === 'number'
    && Number.isFinite(kitchen.latitude)
    && Number.isFinite(kitchen.longitude)
    && Math.abs(kitchen.latitude) <= 90
    && Math.abs(kitchen.longitude) <= 180
}

function openStreetMapUrl(kitchen: CommunityKitchen): string | null {
  if (!hasCoordinates(kitchen)) return null
  const latitude = kitchen.latitude as number
  const longitude = kitchen.longitude as number
  const params = new URLSearchParams({ mlat: String(latitude), mlon: String(longitude) })
  return 'https://www.openstreetmap.org/?' + params.toString() + '#map=16/' + latitude + '/' + longitude
}

function openStreetMapEmbedUrl(kitchen: CommunityKitchen): string | null {
  if (!hasCoordinates(kitchen)) return null
  const latitude = kitchen.latitude as number
  const longitude = kitchen.longitude as number
  const latitudeOffset = 0.006
  const longitudeOffset = 0.008
  const bounds = [
    Math.max(-180, longitude - longitudeOffset),
    Math.max(-90, latitude - latitudeOffset),
    Math.min(180, longitude + longitudeOffset),
    Math.min(90, latitude + latitudeOffset),
  ].join(',')
  const params = new URLSearchParams({ bbox: bounds, layer: 'mapnik', marker: latitude + ',' + longitude })
  return 'https://www.openstreetmap.org/export/embed.html?' + params.toString()
}

export function CommunityKitchensPage() {
  const [kitchens, setKitchens] = useState<CommunityKitchen[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadKitchens = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await api.listCommunityKitchens({ limit: 500 })
      setKitchens(rows)
      setSelectedId((current) => rows.some((row) => row.id === current)
        ? current
        : rows.find(hasCoordinates)?.id ?? rows[0]?.id ?? null)
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadKitchens() }, [loadKitchens])

  const filteredKitchens = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-PE')
    if (!term) return kitchens
    return kitchens.filter((kitchen) => (kitchen.name + ' ' + kitchen.district).toLocaleLowerCase('es-PE').includes(term))
  }, [kitchens, search])

  const selectedKitchen = filteredKitchens.find((kitchen) => kitchen.id === selectedId) ?? filteredKitchens[0] ?? null
  const embedUrl = selectedKitchen ? openStreetMapEmbedUrl(selectedKitchen) : null
  const mapUrl = selectedKitchen ? openStreetMapUrl(selectedKitchen) : null
  const locatedCount = kitchens.filter(hasCoordinates).length

  return (
    <section className="content-section page-section kitchen-section" aria-labelledby="kitchens-title">
      <div className="page-heading kitchen-heading">
        <div>
          <p className="eyebrow eyebrow-dark">DIRECTORIO COMUNITARIO · VILLA EL SALVADOR</p>
          <h1 id="kitchens-title">Comedores populares</h1>
          <p>Consulta los registros públicos y explora en el mapa las ubicaciones disponibles de cada comedor.</p>
        </div>
        <button className="button button-outline" type="button" onClick={() => void loadKitchens()} disabled={loading}>
          <Icon name="refresh" size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Actualizando' : 'Actualizar lista'}
        </button>
      </div>

      <div className="kitchen-note" role="note">
        <Icon name="pin" size={18} />
        <p>La ubicación y el estado proceden de la fuente pública del proyecto. No representan una verificación de operación actual.</p>
      </div>

      {loading && kitchens.length === 0 ? (
        <div className="empty-state" role="status"><span className="loading-mark" /><p>Cargando comedores desde la API…</p></div>
      ) : error && kitchens.length === 0 ? (
        <div className="empty-state" role="alert">
          <span className="empty-symbol"><Icon name="refresh" size={22} /></span>
          <h3>No se pudo cargar el directorio.</h3>
          <p>{error}</p>
          <button className="button button-outline" type="button" onClick={() => void loadKitchens()}>Reintentar</button>
        </div>
      ) : kitchens.length === 0 ? (
        <div className="empty-state">
          <span className="empty-symbol"><Icon name="pin" size={22} /></span>
          <h3>Aún no hay comedores registrados.</h3>
          <p>Cuando el backend tenga registros disponibles, aparecerán en este directorio.</p>
          <button className="button button-outline" type="button" onClick={() => void loadKitchens()}>Volver a consultar</button>
        </div>
      ) : (
        <>
          <div className="kitchens-toolbar">
            <label className="search-field kitchen-search">
              <Icon name="search" size={18} />
              <span className="sr-only">Buscar comedor o distrito</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o distrito" />
            </label>
            <span className="kitchen-count" aria-live="polite">
              {filteredKitchens.length} {filteredKitchens.length === 1 ? 'comedor' : 'comedores'} · {kitchens.length ? locatedCount + ' con coordenadas' : ''}
            </span>
          </div>

          {filteredKitchens.length === 0 ? (
            <div className="empty-state">
              <span className="empty-symbol"><Icon name="search" size={22} /></span>
              <h3>No encontramos coincidencias.</h3>
              <p>Prueba con otro nombre o distrito.</p>
              <button className="button button-outline" type="button" onClick={() => setSearch('')}>Limpiar búsqueda</button>
            </div>
          ) : (
            <div className="kitchens-layout">
              <div className="kitchen-results" aria-label="Resultados de comedores populares">
                {filteredKitchens.map((kitchen) => {
                  const selected = selectedKitchen?.id === kitchen.id
                  const mapsUrl = openStreetMapUrl(kitchen)
                  return (
                    <article key={kitchen.id} className={'kitchen-row' + (selected ? ' kitchen-row-selected' : '')}>
                      <button type="button" className="kitchen-select" aria-pressed={selected} onClick={() => setSelectedId(kitchen.id)}>
                        <span className="kitchen-row-marker"><Icon name="pin" size={18} /></span>
                        <span className="kitchen-row-copy">
                          <strong>{kitchen.name}</strong>
                          <span>{kitchen.district}</span>
                        </span>
                        <Icon name="arrow" size={16} className="kitchen-row-arrow" />
                      </button>
                      {selected && (
                        <div className="kitchen-row-details">
                          {kitchen.address
                            ? <p>{kitchen.address}</p>
                            : <p>La fuente no publica una dirección detallada; usa el punto geográfico registrado.</p>}
                          {kitchen.modality && <span className="kitchen-meta">{kitchen.modality}</span>}
                          {kitchen.source_status && <span className="kitchen-meta">Estado en fuente: {kitchen.source_status}</span>}
                          {kitchen.users_count !== null && <span className="kitchen-meta">Usuarios reportados: {formatNumber(kitchen.users_count)}</span>}
                          {mapsUrl
                            ? <a className="kitchen-map-link" href={mapsUrl} target="_blank" rel="noreferrer">Abrir OpenStreetMap <Icon name="arrow" size={15} /></a>
                            : <span className="kitchen-no-coordinates">Este registro no tiene coordenadas.</span>}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>

              <aside className="kitchen-map-card" aria-label="Mapa del comedor seleccionado">
                <div className="kitchen-map-heading">
                  <span className="eyebrow eyebrow-dark">UBICACIÓN SELECCIONADA</span>
                  {selectedKitchen && <h2>{selectedKitchen.name}</h2>}
                  {selectedKitchen && <p>{selectedKitchen.district}</p>}
                </div>
                <div className="kitchen-map-surface">
                  {embedUrl && selectedKitchen ? (
                    <iframe
                      key={selectedKitchen.id}
                      title={'Mapa de ' + selectedKitchen.name}
                      src={embedUrl}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : selectedKitchen && mapUrl ? (
                    <div className="kitchen-map-placeholder">
                      <span className="kitchen-map-pin"><Icon name="pin" size={25} /></span>
                      <span className="eyebrow eyebrow-dark">PUNTO REGISTRADO</span>
                      <strong>{selectedKitchen.latitude?.toFixed(5)}, {selectedKitchen.longitude?.toFixed(5)}</strong>
                      <p>Abre esta ubicación en OpenStreetMap para explorar el entorno.</p>
                      <a className="button button-dark" href={mapUrl} target="_blank" rel="noreferrer">Ver en OpenStreetMap <Icon name="arrow" size={16} /></a>
                    </div>
                  ) : (
                    <div className="kitchen-map-placeholder">
                      <span className="kitchen-map-pin"><Icon name="pin" size={25} /></span>
                      <strong>Sin coordenadas disponibles</strong>
                      <p>Este comedor no tiene una ubicación geográfica en el registro de origen.</p>
                    </div>
                  )}
                </div>
                {selectedKitchen?.verified_at
                  ? <p className="kitchen-map-disclaimer">Mapa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Registro consultado desde la API; verificado: {new Date(selectedKitchen.verified_at).toLocaleDateString('es-PE')}.</p>
                  : <p className="kitchen-map-disclaimer">Mapa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Ubicación según la fuente pública; sin verificación operativa por AlimentaVES.</p>}
              </aside>
            </div>
          )}
        </>
      )}
    </section>
  )
}
