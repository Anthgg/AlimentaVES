import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import { FoodVisual } from '../components/FoodVisual'
import { MotionReveal } from '../components/MotionReveal'
import { hasValidCoordinates, openStreetMapUrl } from '../lib/kitchen-location'
import type { AppPage } from '../app/navigation'
import { api, ApiError, resolveMediaUrl } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { formatNumber } from '../utils/format'
import type { CommunityKitchen, CommunityKitchenClaim, CommunityKitchenProfile, CommunityKitchenStats, KitchenPhoto } from '../types'

const PAGE_SIZE = 10
const LeafletKitchenMap = lazy(() => import('../components/LeafletKitchenMap').then((module) => ({ default: module.LeafletKitchenMap })))

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha registrada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function CommunityKitchensPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const { user } = useAuth()
  const [kitchens, setKitchens] = useState<CommunityKitchen[]>([])
  const [stats, setStats] = useState<CommunityKitchenStats | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [district, setDistrict] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<CommunityKitchenProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [photos, setPhotos] = useState<KitchenPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosError, setPhotosError] = useState('')
  const [claimBusy, setClaimBusy] = useState(false)
  const [claim, setClaim] = useState<CommunityKitchenClaim | null>(null)
  const [claimError, setClaimError] = useState('')
  const [claimNotice, setClaimNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [catalogResult, statsResult] = await Promise.allSettled([
      api.listCommunityKitchens({ limit: 500, offset: 0 }),
      api.communityKitchenStats(),
    ])
    if (catalogResult.status === 'fulfilled') {
      setKitchens(catalogResult.value)
      setSelectedId((current) => catalogResult.value.some((item) => item.id === current) ? current : catalogResult.value.find(hasValidCoordinates)?.id ?? catalogResult.value[0]?.id ?? null)
    } else setError(friendlyError(catalogResult.reason))
    if (statsResult.status === 'fulfilled') setStats(statsResult.value)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const districts = useMemo(() => [...new Set(kitchens.map((item) => item.district.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-PE')), [kitchens])
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-PE')
    return kitchens.filter((item) => {
      const textMatch = !term || `${item.name} ${item.district} ${item.source_code} ${item.ubigeo}`.toLocaleLowerCase('es-PE').includes(term)
      const districtMatch = !district || item.district.toLocaleLowerCase('es-PE') === district.toLocaleLowerCase('es-PE')
      return textMatch && districtMatch
    })
  }, [district, kitchens, search])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const selectedKitchen = filtered.find((item) => item.id === selectedId) ?? null
  const located = filtered.filter(hasValidCoordinates)

  useEffect(() => {
    if (!selectedKitchen && filtered.length > 0) setSelectedId(filtered[0].id)
    if (selectedKitchen) setClaim(null)
  }, [selectedKitchen?.id, filtered])

  useEffect(() => {
    if (!selectedKitchen) {
      setProfile(null); setPhotos([]); setProfileLoading(false); setPhotosLoading(false)
      return
    }
    let active = true
    setProfile(null)
    setPhotos([])
    setProfileError('')
    setPhotosError('')
    setProfileLoading(true)
    setPhotosLoading(true)
    void api.publicKitchenProfile(selectedKitchen.id).then((value) => { if (active) setProfile(value) }).catch((cause: unknown) => {
      if (!active) return
      if (!(cause instanceof ApiError && cause.status === 404)) setProfileError(friendlyError(cause))
    }).finally(() => { if (active) setProfileLoading(false) })
    void api.listKitchenPhotos(selectedKitchen.id).then((value) => { if (active) setPhotos(value) }).catch((cause: unknown) => { if (active) setPhotosError(friendlyError(cause)) }).finally(() => { if (active) setPhotosLoading(false) })
    return () => { active = false }
  }, [selectedKitchen?.id])

  const selectKitchen = (id: number) => {
    if (claimBusy) return
    const index = filtered.findIndex((item) => item.id === id)
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE))
    setSelectedId(id)
    setClaim(null)
    setClaimError('')
    setClaimNotice('')
  }

  const claimKitchen = async () => {
    if (!selectedKitchen || claimBusy) return
    if (!user) { onNavigate('login'); return }
    if (user.role !== 'donor') return
    setClaimBusy(true); setClaimError(''); setClaimNotice('')
    try {
      const result = await api.claimKitchen(selectedKitchen.id)
      setClaim(result)
      setClaimNotice(`La API recibió tu solicitud con estado «${result.status}» el ${formatDate(result.submitted_at)}. Esta respuesta inmediata se conserva solo en pantalla.`)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) setClaimError('La API informó que ya existe un reclamo pendiente o que esta cuenta ya tiene una membresía. No hay una ruta para recuperar el estado propio después de recargar.')
      else setClaimError(friendlyError(cause))
    } finally { setClaimBusy(false) }
  }

  return <section className="np-page np-kitchens-page" aria-labelledby="nature-view-title">
    <MotionReveal className="np-page-reveal"><div className="np-page-intro np-reveal"><div><p className="np-eyebrow"><span />DIRECTORIO COMUNITARIO · VILLA EL SALVADOR</p><h1 id="nature-view-title" tabIndex={-1}>Comedores populares.</h1><p>Consulta registros públicos del directorio, selecciona una ficha y explora sus coordenadas si están disponibles.</p></div><button className="np-button np-button-outline" type="button" onClick={() => void load()} disabled={loading || claimBusy}><Icon name="refresh" size={16} />{loading ? 'Actualizando…' : 'Actualizar lista'}</button></div></MotionReveal>
    <div className="np-kitchen-summary np-reveal"><div><span className="np-stat-icon"><Icon name="people" size={19} /></span><strong>{stats ? formatNumber(stats.total) : loading ? '…' : '—'}</strong><span>registros públicos</span></div><div><span className="np-stat-icon"><Icon name="pin" size={19} /></span><strong>{stats ? formatNumber(stats.located) : loading ? '…' : '—'}</strong><span>con coordenadas</span></div><p>El estado publicado por la fuente no confirma operación actual.</p></div>
    {error && <div className="np-page-alert" role="alert"><div><strong>No se pudo cargar el directorio.</strong><p>{error}</p></div><button type="button" className="np-button np-button-outline np-button-small" onClick={() => void load()} disabled={loading}>Reintentar</button></div>}
    <div className="np-kitchens-toolbar np-reveal"><search className="np-search-box" aria-label="Buscar registros de comedores"><Icon name="search" size={19} /><label className="np-visually-hidden" htmlFor="kitchen-search">Buscar por comedor, distrito, código o UBIGEO</label><input id="kitchen-search" type="search" value={search} disabled={claimBusy} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Nombre, distrito, código o UBIGEO" /></search><div className="np-filter-group"><label htmlFor="kitchen-district">Distrito</label><select id="kitchen-district" value={district} disabled={claimBusy} onChange={(event) => { setDistrict(event.target.value); setPage(0) }}><option value="">Todos los distritos</option>{districts.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><span className="np-results-count" aria-live="polite">{loading ? 'Consultando…' : `${filtered.length} registros`}</span></div>
    {loading && kitchens.length === 0 ? <div className="np-empty-state" role="status"><span className="np-loading-indicator" /><h2>Consultando comedores en el backend…</h2></div> : null}
    {!loading && !error && filtered.length === 0 && <div className="np-empty-state"><FoodVisual file="verduras-frescas.png" alt="Ilustración decorativa de verduras" className="np-empty-food-visual" caption="Ilustración · el directorio no devolvió registros." /><h2>{kitchens.length ? 'No encontramos coincidencias.' : 'El backend no devolvió registros.'}</h2><p>{kitchens.length ? 'Prueba otro nombre, código, UBIGEO o distrito.' : 'Cuando existan registros públicos disponibles, aparecerán aquí.'}</p>{kitchens.length > 0 && <button className="np-button np-button-outline" type="button" onClick={() => { setSearch(''); setDistrict('') }}>Limpiar filtros</button>}</div>}
    {filtered.length > 0 && <div className="np-kitchens-workarea">
      <section className="np-kitchen-results-panel" aria-labelledby="kitchen-results-title"><div className="np-kitchen-results-heading"><div><p className="np-eyebrow"><span />REGISTRO PÚBLICO</p><h2 id="kitchen-results-title">Resultados del directorio</h2></div><span>{visible.length} en esta página</span></div><ul className="np-live-kitchen-list">{visible.map((kitchen) => <li key={kitchen.id}><article className={`np-live-kitchen-card ${selectedId === kitchen.id ? 'is-selected' : ''}`}><button type="button" className="np-live-kitchen-select" aria-pressed={selectedId === kitchen.id} disabled={claimBusy} onClick={() => selectKitchen(kitchen.id)}><span className="np-kitchen-marker" aria-hidden="true"><Icon name="pin" size={18} /></span><span className="np-live-kitchen-copy"><strong>{kitchen.name}</strong><span>{kitchen.district} · Código {kitchen.source_code}</span></span><Icon name="arrow" size={17} /></button><div className="np-live-kitchen-labels"><span>{kitchen.modality || 'Modalidad no informada'}</span><span>{kitchen.source_status ? `Fuente: ${kitchen.source_status}` : 'Estado de fuente no informado'}</span>{hasValidCoordinates(kitchen) && <span>Con coordenadas</span>}</div></article></li>)}</ul>
        {filtered.length > PAGE_SIZE && <nav className="np-pagination" aria-label="Paginación de comedores"><button type="button" className="np-button np-button-outline np-button-small" disabled={page === 0 || claimBusy} onClick={() => setPage((current) => Math.max(0, current - 1))}>Anterior</button><span>Página {page + 1} de {pageCount}</span><button type="button" className="np-button np-button-outline np-button-small" disabled={page + 1 >= pageCount || claimBusy} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Siguiente</button></nav>}
      </section>
      <aside className="np-kitchen-detail-panel" aria-labelledby="kitchen-detail-title">
        <div className="np-kitchen-detail-heading"><p className="np-eyebrow"><span />FICHA DEL REGISTRO</p>{selectedKitchen ? <><h2 id="kitchen-detail-title">{selectedKitchen.name}</h2><span className="np-kitchen-code">Código {selectedKitchen.source_code}</span></> : <h2 id="kitchen-detail-title">Selecciona un comedor</h2>}</div>
        {selectedKitchen && <>
          <dl className="np-kitchen-source-facts"><div><dt>Distrito</dt><dd>{selectedKitchen.district}</dd></div><div><dt>UBIGEO</dt><dd>{selectedKitchen.ubigeo}</dd></div><div><dt>Modalidad en la fuente</dt><dd>{selectedKitchen.modality || 'No informada'}</dd></div><div><dt>Estado publicado por la fuente</dt><dd>{selectedKitchen.source_status || 'No informado'}</dd></div>{selectedKitchen.users_count !== null && <div><dt>Usuarios agregados reportados por la fuente</dt><dd>{formatNumber(selectedKitchen.users_count)}</dd></div>}{selectedKitchen.verified_at && <div><dt>Fecha de verificación registrada</dt><dd>{formatDate(selectedKitchen.verified_at)}</dd></div>}</dl>
          <p className="np-source-warning"><Icon name="info" size={17} />Este registro proviene de una fuente pública. Ni el estado ni una fecha registrada confirman que el comedor opere actualmente.</p>
          {selectedKitchen.address && <div className="np-kitchen-address"><strong>Dirección publicada</strong><p>{selectedKitchen.address}</p></div>}
          {hasValidCoordinates(selectedKitchen) && <div className="np-kitchen-coordinates"><span>Coordenadas WGS84 registradas</span><strong>{selectedKitchen.latitude.toFixed(5)}, {selectedKitchen.longitude.toFixed(5)}</strong><a href={openStreetMapUrl(selectedKitchen) ?? undefined} target="_blank" rel="noreferrer">Abrir en OpenStreetMap <Icon name="arrow" size={15} /></a></div>}
          <section className="np-public-profile" aria-labelledby="public-profile-title"><h3 id="public-profile-title">Perfil institucional publicado</h3>{profileLoading ? <p role="status">Consultando perfil…</p> : profileError ? <p className="np-inline-error" role="alert">{profileError}</p> : profile ? <><span className="np-profile-status">Perfil publicado</span>{profile.description && <p>{profile.description}</p>}<dl>{profile.operating_hours && <div><dt>Horario</dt><dd>{profile.operating_hours}</dd></div>}{profile.institutional_location && <div><dt>Ubicación institucional</dt><dd>{profile.institutional_location}</dd></div>}{profile.needs && <div><dt>Necesidades</dt><dd>{profile.needs}</dd></div>}</dl></> : <p>Este comedor no tiene una ficha institucional pública publicada.</p>}</section>
          <section className="np-public-photos" aria-labelledby="public-photos-title"><div className="np-public-photos-heading"><h3 id="public-photos-title">Fotografías aprobadas</h3>{photos.length > 0 && <span>{photos.length}</span>}</div>{photosLoading ? <p role="status">Consultando fotografías…</p> : photosError ? <p className="np-inline-error" role="alert">{photosError}</p> : photos.length === 0 ? <p>La API no devolvió imágenes públicas aprobadas para esta ficha.</p> : <div className="np-public-photo-grid">{photos.map((photo) => <figure key={photo.id}><img src={resolveMediaUrl(photo.url)} alt={`Fotografía aprobada del comedor · categoría ${photo.category}`} loading="lazy" /><figcaption>{photo.category}</figcaption></figure>)}</div>}</section>
          {user?.role === 'donor' && <div className="np-claim-action"><h3>¿Representas este comedor?</h3><p>La solicitud no acredita representación; un administrador debe verificarla antes de activar la membresía.</p>{claimNotice && <p className="np-inline-status" role="status">{claimNotice}</p>}{claimError && <p className="np-inline-error" role="alert">{claimError}</p>}<button className="np-button np-button-dark np-button-wide" type="button" onClick={() => void claimKitchen()} disabled={claimBusy || Boolean(claim)}>{claimBusy ? 'Enviando…' : claim ? `Solicitud recibida · ${claim.status}` : 'Solicitar vinculación'}</button><small>No hay una ruta para consultar tus reclamos después de recargar. Si ya existe uno, la API responderá 409.</small></div>}
          {!user && <button className="np-button np-button-outline np-button-wide" type="button" onClick={() => onNavigate('login')}>Inicia sesión para solicitar vinculación</button>}
          <p className="np-kitchen-source-link"><a href={selectedKitchen.source_url} target="_blank" rel="noreferrer">Consultar fuente original <Icon name="arrow" size={15} /></a><span>Descargado {formatDate(selectedKitchen.downloaded_at)}</span></p>
        </>}
      </aside>
      <section className="np-kitchen-map-panel" aria-labelledby="kitchen-map-title"><div className="np-kitchen-map-heading"><div><p className="np-eyebrow"><span />UBICACIONES DEL DIRECTORIO</p><h2 id="kitchen-map-title">Mapa de registros con coordenadas.</h2><p>Los marcadores vienen de latitud y longitud recibidas del backend; solo se muestran ubicaciones válidas.</p></div><span className="np-map-count">{formatNumber(located.length)} con coordenadas</span></div><Suspense fallback={<div className="np-map-unavailable" role="status"><span className="np-loading-indicator" /><h3>Cargando mapa…</h3><p>Las teselas se solicitarán al abrir el directorio, sin precarga.</p></div>}><LeafletKitchenMap kitchens={located} selectedId={selectedId} selectedKitchen={selectedKitchen} onSelect={selectKitchen} /></Suspense></section>
    </div>}
    <p className="np-disclaimer">Los registros son públicos y sus estados fueron informados por la fuente. AlimentaVES no ha verificado que estos comedores continúen operando.</p>
  </section>
}
