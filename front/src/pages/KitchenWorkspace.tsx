import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError, resolveMediaUrl } from '../lib/api'
import type {
  CommunityKitchen,
  CommunityKitchenClaim,
  CommunityKitchenProfile,
  CommunityKitchenProfileInput,
  Donation,
  DonationRequest,
  KitchenPhoto,
  PhotoCategory,
  RequestStatus,
} from '../types'
import { FoodVisual } from '../components/FoodVisual'
import './kitchen-workspace.css'

type Message = { tone: 'success' | 'error' | 'info'; text: string }
type ProfileForm = { description: string; operating_hours: string; institutional_location: string; needs: string }

const emptyProfile: ProfileForm = { description: '', operating_hours: '', institutional_location: '', needs: '' }
const categories: Array<{ value: PhotoCategory; label: string }> = [
  { value: 'profile', label: 'Perfil' },
  { value: 'cover', label: 'Portada' },
  { value: 'gallery', label: 'Galería' },
  { value: 'food', label: 'Alimentos' },
]

function errorText(error: unknown, context: 'claim' | 'profile' | 'photo' | 'request' | 'catalog'): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Tu sesión venció o dejó de ser válida. Inicia sesión nuevamente.'
    if (error.status === 403) return context === 'profile' || context === 'photo' || context === 'request'
      ? 'La cuenta autenticada no tiene una membresía activa para este comedor. El backend no permitió la acción.'
      : 'La cuenta no tiene permiso para esta acción.'
    if (error.status === 404 && context === 'profile') return 'Este comedor todavía no tiene un perfil público. Puedes proponer una primera versión para revisión.'
    if (error.status === 404 && context === 'catalog') return 'El comedor seleccionado ya no está disponible en el catálogo. Actualiza la lista.'
    if (error.status === 409 && context === 'claim') return 'Ya existe un reclamo pendiente para esta cuenta o la cuenta ya pertenece a un comedor. No se puede recuperar el reclamo anterior desde la API.'
    if (error.status === 409 && context === 'profile') return 'Hay una versión pendiente de revisión. El backend no ofrece una ruta para recuperar la versión pendiente propia; no se creó otro envío.'
    if (error.status === 409 && context === 'request') return 'La donación ya no admite otra solicitud pendiente para este comedor. Actualiza la lista para consultar el estado actual.'
    if (error.status === 413) return 'La imagen supera el límite permitido de 8 MiB.'
    if (error.status === 415) return 'El servidor solo acepta imágenes JPEG, PNG o WebP.'
    if (error.status === 422) return `Revisa los campos enviados: ${error.message}`
    return error.message
  }
  if (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return 'No se pudo conectar con la API. Comprueba que el backend esté disponible e inténtalo nuevamente.'
  }
  return error instanceof Error ? error.message : `No se pudo completar la acción de ${context}.`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha registrada'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function roleName(role: string): string {
  if (role === 'kitchen') return 'comedor'
  if (role === 'donor') return 'donante'
  if (role === 'admin') return 'administración'
  return 'cuenta'
}

function FieldMessage({ message }: { message: Message | null }) {
  if (!message) return null
  const role = message.tone === 'error' ? 'alert' : 'status'
  return <p className={`npkw-message npkw-message-${message.tone}`} role={role}>{message.text}</p>
}

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div className="npkw-section-title"><p className="npkw-eyebrow">{eyebrow}</p><h2>{title}</h2>{copy && <p>{copy}</p>}</div>
}

export interface KitchenWorkspaceProps {
  onNavigate?: (page: string) => void
}

export function KitchenWorkspace({ onNavigate }: KitchenWorkspaceProps) {
  const { user, loading: sessionLoading, reloadUser } = useAuth()
  const [catalog, setCatalog] = useState<CommunityKitchen[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [catalogQuery, setCatalogQuery] = useState('')
  const [appliedCatalogQuery, setAppliedCatalogQuery] = useState('')
  const [catalogPage, setCatalogPage] = useState(0)
  const [selectedKitchenId, setSelectedKitchenId] = useState<number | null>(null)
  const [claim, setClaim] = useState<CommunityKitchenClaim | null>(null)
  const [claimBusy, setClaimBusy] = useState(false)
  const [claimMessage, setClaimMessage] = useState<Message | null>(null)
  const [profile, setProfile] = useState<CommunityKitchenProfile | null>(null)
  const [knownProfileId, setKnownProfileId] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileLoadError, setProfileLoadError] = useState<Message | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState<Message | null>(null)
  const [photos, setPhotos] = useState<KitchenPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosError, setPhotosError] = useState('')
  const [photoCategory, setPhotoCategory] = useState<PhotoCategory>('gallery')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMessage, setPhotoMessage] = useState<Message | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [requests, setRequests] = useState<DonationRequest[]>([])
  const [requestStatus, setRequestStatus] = useState<RequestStatus | ''>('')
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestsError, setRequestsError] = useState('')
  const [selectedDonationId, setSelectedDonationId] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestMessage, setRequestMessage] = useState<Message | null>(null)
  const [membershipMessage, setMembershipMessage] = useState<Message | null>(null)

  const pageSize = 50
  const offset = catalogPage * pageSize
  const selectedKitchen = useMemo(() => catalog.find((item) => item.id === selectedKitchenId) ?? null, [catalog, selectedKitchenId])
  const selectedDonation = useMemo(() => donations.find((item) => item.id === selectedDonationId) ?? null, [donations, selectedDonationId])
  const visibleRequests = useMemo(() => requests.filter((item) => !requestStatus || item.status === requestStatus), [requests, requestStatus])
  const canManageKitchen = user?.role === 'kitchen'

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const rows = await api.listCommunityKitchens({ name: appliedCatalogQuery || undefined, limit: pageSize, offset })
      setCatalog(rows)
      setSelectedKitchenId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null)
    } catch (error) {
      setCatalogError(errorText(error, 'catalog'))
    } finally {
      setCatalogLoading(false)
    }
  }, [appliedCatalogQuery, offset])

  useEffect(() => { void loadCatalog() }, [loadCatalog])

  useEffect(() => {
    if (!canManageKitchen || !selectedKitchenId) {
      setProfile(null)
      setKnownProfileId('')
      setPhotos([])
      setRequests([])
      setDonations([])
      return
    }
    let current = true
    setProfile(null)
    setKnownProfileId('')
    setProfileForm(emptyProfile)
    setPhotos([])
    setRequests([])
    setDonations([])
    setProfileLoading(true)
    setProfileLoadError(null)
    setProfileMessage(null)
    setPhotosLoading(true)
    setPhotosError('')
    setRequestsLoading(true)
    setRequestsError('')
    setMembershipMessage(null)
    Promise.all([
      api.publicKitchenProfile(selectedKitchenId).then((value) => {
        if (!current) return
        setProfile(value)
        setKnownProfileId(value.id)
        setProfileForm({
          description: value.description ?? '',
          operating_hours: value.operating_hours ?? '',
          institutional_location: value.institutional_location ?? '',
          needs: value.needs ?? '',
        })
      }).catch((error: unknown) => {
        if (!current) return
        if (error instanceof ApiError && error.status === 404) {
          setProfile(null)
          setKnownProfileId('')
          setProfileForm(emptyProfile)
          setProfileLoadError({ tone: 'info', text: 'Todavía no hay una ficha pública para este comedor. Puedes enviar una primera versión con datos institucionales para revisión.' })
        } else {
          setProfileLoadError({ tone: 'error', text: errorText(error, 'profile') })
        }
      }).finally(() => { if (current) setProfileLoading(false) }),
      api.listKitchenPhotos(selectedKitchenId).then((value) => { if (current) setPhotos(value) }).catch((error: unknown) => { if (current) setPhotosError(errorText(error, 'photo')) }).finally(() => { if (current) setPhotosLoading(false) }),
      api.listDonationRequests().then((value) => { if (current) setRequests(value) }).catch((error: unknown) => { if (current) setRequestsError(errorText(error, 'request')) }).finally(() => { if (current) setRequestsLoading(false) }),
      api.listDonations('available').then((value) => { if (current) { setDonations(value); setSelectedDonationId((id) => value.some((item) => item.id === id) ? id : value[0]?.id ?? '') } }).catch(() => { if (current) setDonations([]) }),
    ]).then(() => {
      if (current && user?.role === 'kitchen') setMembershipMessage({ tone: 'info', text: 'La API valida tu membresía al enviar cambios o solicitudes. Elegir un registro no confirma que administras ese comedor.' })
    })
    return () => { current = false }
  }, [canManageKitchen, selectedKitchenId, user?.role])

  const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedKitchenId || claimBusy) return
    setClaimBusy(true)
    setClaimMessage(null)
    try {
      const result = await api.claimKitchen(selectedKitchenId)
      setClaim(result)
      setClaimMessage({ tone: 'success', text: `La API recibió el reclamo con estado «${result.status}» el ${formatDate(result.submitted_at)}. Este resultado inmediato solo se conserva en pantalla; no hay una ruta para consultar tu reclamo después de recargar.` })
    } catch (error) {
      setClaimMessage({ tone: 'error', text: errorText(error, 'claim') })
    } finally {
      setClaimBusy(false)
    }
  }

  const checkMembership = async () => {
    setMembershipMessage({ tone: 'info', text: 'Consultando el rol actual de la sesión…' })
    try {
      const updated = await reloadUser()
      setMembershipMessage({ tone: 'info', text: updated?.role === 'kitchen' ? 'La sesión ya tiene rol de comedor. El backend aún debe confirmar la membresía para cada acción.' : 'La sesión sigue registrada como donante. La aprobación de un reclamo no se refleja hasta que el backend actualice el rol de la cuenta.' })
    } catch (error) {
      setMembershipMessage({ tone: 'error', text: errorText(error, 'claim') })
    }
  }

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedKitchenId || profileBusy) return
    const cleaned: CommunityKitchenProfileInput = {
      description: profileForm.description.trim() || null,
      operating_hours: profileForm.operating_hours.trim() || null,
      institutional_location: profileForm.institutional_location.trim() || null,
      needs: profileForm.needs.trim() || null,
    }
    if (!cleaned.description && !cleaned.operating_hours && !cleaned.institutional_location && !cleaned.needs) {
      setProfileMessage({ tone: 'error', text: 'Completa al menos un campo institucional antes de enviar.' })
      return
    }
    setProfileBusy(true)
    setProfileMessage(null)
    try {
      const saved = await api.submitKitchenProfile(selectedKitchenId, cleaned)
      setProfile(saved)
      setKnownProfileId(saved.id)
      setProfileMessage({ tone: 'success', text: `La API recibió esta versión con estado «${saved.status}» el ${formatDate(saved.submitted_at)}. La versión pendiente puede adjuntar fotos en esta sesión. La API no ofrece una ruta para recuperar versiones pendientes propias al volver a cargar.` })
    } catch (error) {
      setProfileMessage({ tone: 'error', text: errorText(error, 'profile') })
    } finally {
      setProfileBusy(false)
    }
  }

  const submitPhoto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedKitchenId || !knownProfileId || !photoFile || photoBusy) return
    if (photoFile.size > 8 * 1024 * 1024) {
      setPhotoMessage({ tone: 'error', text: 'El archivo supera el límite de 8 MiB. Selecciona una imagen más pequeña.' })
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(photoFile.type)) {
      setPhotoMessage({ tone: 'error', text: 'Selecciona una imagen JPEG, PNG o WebP.' })
      return
    }
    setPhotoBusy(true)
    setPhotoMessage(null)
    try {
      const uploaded = await api.uploadKitchenPhoto(selectedKitchenId, knownProfileId, photoCategory, photoFile)
      setPhotoFile(null)
      const input = document.getElementById('npkw-photo-file') as HTMLInputElement | null
      if (input) input.value = ''
      setPhotoMessage({ tone: 'success', text: `La API recibió la fotografía con estado «${uploaded.status}» el ${formatDate(uploaded.uploaded_at)}. Las imágenes pendientes no aparecen en el listado público y no hay una ruta para que el comedor recupere su cola pendiente después de recargar.` })
      setPhotosError('')
      void api.listKitchenPhotos(selectedKitchenId).then((result) => { setPhotos(result); setPhotosError('') }).catch((error: unknown) => setPhotosError(errorText(error, 'photo')))
    } catch (error) {
      setPhotoMessage({ tone: 'error', text: errorText(error, 'photo') })
    } finally {
      setPhotoBusy(false)
    }
  }

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedKitchenId || !selectedDonation || requestBusy) return
    setRequestBusy(true)
    setRequestMessage(null)
    try {
      const created = await api.createDonationRequest(selectedDonation.id, selectedKitchenId)
      setRequestMessage({ tone: 'success', text: `Solicitud registrada por la API con estado «${created.status}». Su aprobación la decide un administrador; no equivale a una reserva directa.` })
    } catch (error) {
      setRequestMessage({ tone: 'error', text: errorText(error, 'request') })
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        void api.listDonations('available').then(setDonations).catch(() => undefined)
      }
      setRequestBusy(false)
      return
    }
    try {
      const nextRequests = await api.listDonationRequests()
      setRequests(nextRequests)
      setRequestsError('')
    } catch (refreshError) {
      setRequestsError(`La solicitud sí se registró, pero no se pudo actualizar la lista: ${errorText(refreshError, 'request')}`)
    }
    try {
      const nextDonations = await api.listDonations('available')
      setDonations(nextDonations)
      setSelectedDonationId(nextDonations.some((item) => item.id === selectedDonation.id) ? selectedDonation.id : nextDonations[0]?.id ?? '')
    } catch {
      // The successful request remains reported above; a later refresh can update availability.
    } finally {
      setRequestBusy(false)
    }
  }

  const refreshPhotos = async () => {
    if (!selectedKitchenId) return
    setPhotosLoading(true)
    setPhotosError('')
    try {
      setPhotos(await api.listKitchenPhotos(selectedKitchenId))
    } catch (error) {
      setPhotosError(errorText(error, 'photo'))
    } finally {
      setPhotosLoading(false)
    }
  }

  if (sessionLoading) return <div className="npkw-state" role="status" aria-live="polite"><span className="npkw-spinner" />Comprobando la sesión…</div>
  if (!user) return <div className="npkw-state"><h2>Inicia sesión para continuar</h2><p>La solicitud de vinculación y el espacio del comedor requieren una cuenta autenticada.</p><button type="button" className="npkw-button" onClick={() => onNavigate?.('login')}>Ir a iniciar sesión</button></div>
  if (user.role === 'admin') return <div className="npkw-state"><h2>Tu cuenta tiene acceso administrativo</h2><p>Usa el panel de administración para revisar comedores y solicitudes.</p><button type="button" className="npkw-button" onClick={() => onNavigate?.('administracion')}>Abrir panel administrativo</button></div>

  return (
    <section className="np-kitchen-workspace" aria-labelledby="npkw-title">
      <header className="npkw-heading">
        <div><p className="npkw-eyebrow">ESPACIO DE COMEDOR</p><h1 id="nature-view-title" data-page-title tabIndex={-1}>{canManageKitchen ? 'Gestiona la información de tu comedor.' : 'Vincula tu cuenta a un comedor.'}</h1><p>Sesión de {roleName(user.role)} · {user.email}</p></div>
        <div className="npkw-heading-actions"><button type="button" className="npkw-subtle-button" onClick={() => onNavigate?.('notificaciones')}>Ver notificaciones</button><button type="button" className="npkw-subtle-button" onClick={() => onNavigate?.('donaciones')}>Explorar donaciones</button></div>
      </header>

      <FoodVisual file="olla-comunitaria.png" alt="Ilustración decorativa de una olla comunitaria" className="npkw-workspace-visual" caption="Ilustración de alimentos · no es una fotografía de este comedor." />

      <div className="npkw-catalog-panel">
        <div className="npkw-catalog-header"><SectionTitle eyebrow="CATÁLOGO PÚBLICO" title={canManageKitchen ? 'Selecciona el comedor asociado' : 'Elige el comedor que representas'} copy="La lista contiene registros públicos del backend. El estado informado por la fuente no confirma operación actual." /><button className="npkw-subtle-button" type="button" onClick={() => void loadCatalog()} disabled={catalogLoading || profileBusy || photoBusy || requestBusy || claimBusy}>{catalogLoading ? 'Actualizando…' : 'Actualizar lista'}</button></div>
        <form className="npkw-catalog-search" role="search" onSubmit={(event) => { event.preventDefault(); if (profileBusy || photoBusy || requestBusy || claimBusy) return; setCatalogPage(0); setAppliedCatalogQuery(catalogQuery.trim()) }}>
          <label htmlFor="npkw-catalog-query">Buscar por nombre</label>
          <div className="npkw-search-control"><input id="npkw-catalog-query" type="search" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Nombre del comedor" disabled={profileBusy || photoBusy || requestBusy || claimBusy} /><button className="npkw-button npkw-button-small" type="submit" disabled={catalogLoading || profileBusy || photoBusy || requestBusy || claimBusy}>Buscar</button></div>
        </form>
        {catalogError && <FieldMessage message={{ tone: 'error', text: catalogError }} />}
        {catalogLoading && catalog.length === 0 ? <p className="npkw-inline-state" role="status"><span className="npkw-spinner" />Consultando comedores en PostgreSQL…</p> : null}
        {!catalogLoading && !catalogError && catalog.length === 0 ? <p className="npkw-inline-state">No hay registros en esta página. Revisa la búsqueda o cambia de página.</p> : null}
        {catalog.length > 0 && <>
          <div className="npkw-select-row"><label htmlFor="npkw-kitchen-select">Comedor del catálogo <span>(fuente pública, no verificado operativamente)</span></label><select id="npkw-kitchen-select" value={selectedKitchenId ?? ''} disabled={profileBusy || photoBusy || requestBusy || claimBusy} onChange={(event) => setSelectedKitchenId(event.target.value ? Number(event.target.value) : null)}>{catalog.map((kitchen) => <option key={kitchen.id} value={kitchen.id}>{kitchen.name} · {kitchen.district} · código {kitchen.source_code}</option>)}</select></div>
          {selectedKitchen && <div className="npkw-kitchen-facts"><div><span>Distrito</span><strong>{selectedKitchen.district}</strong></div><div><span>UBIGEO</span><strong>{selectedKitchen.ubigeo}</strong></div><div><span>Modalidad publicada</span><strong>{selectedKitchen.modality || 'Sin información'}</strong></div><div><span>Estado de la fuente</span><strong>{selectedKitchen.source_status || 'Sin información'}</strong></div>{selectedKitchen.address && <div className="npkw-fact-wide"><span>Dirección publicada</span><strong>{selectedKitchen.address}</strong></div>}</div>}
          <div className="npkw-pagination"><span>Bloque {catalogPage + 1} · hasta {catalog.length} registros en esta página</span><div><button type="button" className="npkw-subtle-button" disabled={catalogPage === 0 || catalogLoading || profileBusy || photoBusy || requestBusy || claimBusy} onClick={() => setCatalogPage((page) => Math.max(0, page - 1))}>Anterior</button><button type="button" className="npkw-subtle-button" disabled={catalog.length < pageSize || catalogLoading || profileBusy || photoBusy || requestBusy || claimBusy} onClick={() => setCatalogPage((page) => page + 1)}>Siguiente</button></div></div>
        </>}
      </div>

      {user.role === 'donor' && <section className="npkw-card npkw-claim-card" aria-labelledby="npkw-claim-title">
        <SectionTitle eyebrow="SOLICITUD DE VINCULACIÓN" title="Solicita administrar un comedor" copy="El registro público no demuestra que tengas representación. La administración debe verificar la solicitud antes de activar una membresía." />
        <FieldMessage message={claimMessage} />
          {claim && <dl className="npkw-result-details"><div><dt>Estado devuelto por la API</dt><dd>{claim.status}</dd></div><div><dt>Comedor solicitado</dt><dd>ID {claim.kitchen_id}</dd></div><div><dt>Enviado</dt><dd>{formatDate(claim.submitted_at)}</dd></div><div><dt>Identificador de respuesta</dt><dd>{claim.id}</dd></div></dl>}
        <form onSubmit={submitClaim}>
          <p className="npkw-privacy-note">La ruta acepta un objeto vacío; la identidad se toma del token. No adjuntes datos personales ni de beneficiarios aquí.</p>
          <button className="npkw-button" type="submit" disabled={!selectedKitchenId || claimBusy}>{claimBusy ? 'Enviando solicitud…' : 'Solicitar vinculación'}</button>
        </form>
        <div className="npkw-limitation"><strong>Seguimiento limitado por el contrato</strong><p>La respuesta inmediata sí muestra el estado del reclamo. El backend no expone una ruta para consultar los reclamos propios después de recargar. Si la solicitud ya existe, el servidor responderá 409; el frontend no puede confirmar si fue aprobada.</p><button type="button" className="npkw-subtle-button" onClick={() => void checkMembership()}>Comprobar rol de la sesión</button></div>
        <FieldMessage message={membershipMessage} />
      </section>}

      {canManageKitchen && selectedKitchen && <>
        <FieldMessage message={membershipMessage} />
        <div className="npkw-workspace-nav"><a href="#npkw-profile">Perfil institucional</a><a href="#npkw-photos">Fotografías</a><a href="#npkw-requests">Solicitudes de alimentos</a></div>

        <section id="npkw-profile" className="npkw-card" aria-labelledby="npkw-profile-title">
          <SectionTitle eyebrow="PERFIL INSTITUCIONAL" title="Información pública del comedor" copy="Los cambios se envían a moderación. La información de la fuente y el perfil institucional se mantienen separados." />
          {profileLoading && <p className="npkw-inline-state" role="status"><span className="npkw-spinner" />Consultando perfil publicado…</p>}
          {profileLoadError && <FieldMessage message={profileLoadError} />}
          {profile?.status === 'published' && <div className="npkw-published-card"><span className="npkw-status npkw-status-published">Perfil publicado</span><p>{profile.description || 'Sin descripción pública.'}</p><dl><div><dt>Horario</dt><dd>{profile.operating_hours || 'Sin información'}</dd></div><div><dt>Ubicación institucional</dt><dd>{profile.institutional_location || 'Sin información'}</dd></div><div><dt>Necesidades</dt><dd>{profile.needs || 'Sin información'}</dd></div></dl></div>}
          <div className="npkw-privacy-note"><strong>Protege la privacidad de la comunidad.</strong> Publica solo información institucional. No incluyas nombres ni contactos de responsables, teléfonos, correos, DNI ni datos que identifiquen a beneficiarios. Usa solo ubicación institucional verificada, nunca domicilios personales.</div>
          <FieldMessage message={profileMessage} />
          <form className="npkw-profile-form" onSubmit={submitProfile}>
            <div className="npkw-form-field"><label htmlFor="npkw-profile-description">Descripción institucional</label><textarea id="npkw-profile-description" value={profileForm.description} maxLength={2000} rows={4} onChange={(event) => setProfileForm((form) => ({ ...form, description: event.target.value }))} aria-describedby="npkw-description-help" placeholder="Describe el trabajo comunitario del comedor." /><small id="npkw-description-help">Hasta 2000 caracteres. No incluyas información personal.</small></div>
            <div className="npkw-form-field"><label htmlFor="npkw-profile-hours">Horario de atención</label><textarea id="npkw-profile-hours" value={profileForm.operating_hours} maxLength={500} rows={2} onChange={(event) => setProfileForm((form) => ({ ...form, operating_hours: event.target.value }))} aria-describedby="npkw-hours-help" placeholder="Solo horarios institucionales confirmados." /><small id="npkw-hours-help">Hasta 500 caracteres.</small></div>
            <div className="npkw-form-field"><label htmlFor="npkw-profile-location">Ubicación institucional</label><textarea id="npkw-profile-location" value={profileForm.institutional_location} maxLength={500} rows={2} onChange={(event) => setProfileForm((form) => ({ ...form, institutional_location: event.target.value }))} aria-describedby="npkw-location-help" placeholder="No indiques domicilios personales." /><small id="npkw-location-help">Hasta 500 caracteres.</small></div>
            <div className="npkw-form-field"><label htmlFor="npkw-profile-needs">Necesidades del comedor</label><textarea id="npkw-profile-needs" value={profileForm.needs} maxLength={2000} rows={3} onChange={(event) => setProfileForm((form) => ({ ...form, needs: event.target.value }))} aria-describedby="npkw-needs-help" placeholder="Indica necesidades institucionales, sin identificar personas." /><small id="npkw-needs-help">Hasta 2000 caracteres.</small></div>
            <p className="npkw-form-footnote">Completa al menos un campo. El backend aplica validaciones de formato y la aprobación final es manual.</p>
            <button className="npkw-button" type="submit" disabled={profileBusy || profileLoading}>{profileBusy ? 'Enviando a revisión…' : 'Enviar perfil para revisión'}</button>
          </form>
          {profile && <dl className="npkw-result-details"><div><dt>Estado devuelto</dt><dd>{profile.status}</dd></div><div><dt>Enviado</dt><dd>{formatDate(profile.submitted_at)}</dd></div><div><dt>Versión conocida en esta sesión</dt><dd>{profile.id}</dd></div></dl>}
        </section>

        <section id="npkw-photos" className="npkw-card" aria-labelledby="npkw-photos-title">
          <SectionTitle eyebrow="FOTOGRAFÍAS" title="Imágenes del perfil" copy="Las fotografías nuevas quedan pendientes de revisión. Solo las aprobadas aparecen en la galería pública." />
          <FieldMessage message={photoMessage} />
          <form className="npkw-photo-form" onSubmit={submitPhoto}>
            <div className="npkw-form-field"><label htmlFor="npkw-photo-category">Categoría</label><select id="npkw-photo-category" value={photoCategory} onChange={(event) => setPhotoCategory(event.target.value as PhotoCategory)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="npkw-form-field"><label htmlFor="npkw-photo-file">Fotografía JPEG, PNG o WebP</label><input id="npkw-photo-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} aria-describedby="npkw-photo-help" /><small id="npkw-photo-help">Máximo 8 MiB. No subas fotos con rostros, nombres u otros datos identificables de beneficiarios.</small></div>
            {!knownProfileId && <p className="npkw-inline-state">Para subir una fotografía se necesita el ID de una ficha devuelta por el backend. Envía una ficha institucional o carga la ficha publicada.</p>}
            {knownProfileId && <p className="npkw-inline-state">La fotografía se asociará a la versión de perfil disponible en esta sesión.</p>}
            <button className="npkw-button" type="submit" disabled={!knownProfileId || profileLoading || !photoFile || photoBusy}>{photoBusy ? 'Subiendo fotografía…' : profileLoading ? 'Cargando perfil…' : 'Enviar fotografía para revisión'}</button>
          </form>
          <div className="npkw-gallery-heading"><h3>Galería pública aprobada</h3><button type="button" className="npkw-subtle-button" onClick={() => void refreshPhotos()} disabled={photosLoading}>{photosLoading ? 'Actualizando…' : 'Actualizar'}</button></div>
          {photosError && <FieldMessage message={{ tone: 'error', text: photosError }} />}
          {photosLoading ? <p className="npkw-inline-state" role="status"><span className="npkw-spinner" />Consultando fotografías aprobadas…</p> : !photosError && photos.length === 0 ? <p className="npkw-inline-state">La API no devolvió fotografías públicas aprobadas para esta ficha.</p> : null}{!photosLoading && photos.length > 0 && <ul className="npkw-photo-list">{photos.map((photo) => <li key={photo.id}><img src={resolveMediaUrl(photo.url)} alt={`Fotografía aprobada · categoría ${photo.category}`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} /><div><strong>{photo.category}</strong><span>{photo.width} × {photo.height} px · {formatDate(photo.uploaded_at)}</span></div></li>)}</ul>}
          <p className="npkw-limitation-copy">El backend no ofrece una ruta para que el comedor consulte sus propias fotografías pendientes después de recargar. El estado inmediato del envío se muestra arriba.</p>
        </section>

        <section id="npkw-requests" className="npkw-card" aria-labelledby="npkw-requests-title">
          <SectionTitle eyebrow="SOLICITUDES DE ALIMENTOS" title="Solicita una donación" copy="Este flujo crea una solicitud pendiente para revisión administrativa; no ejecuta la reserva directa del endpoint anterior." />
          <FieldMessage message={requestMessage} />
          <form className="npkw-request-form" onSubmit={submitRequest}>
            <div className="npkw-form-field"><label htmlFor="npkw-donation">Donación disponible</label><select id="npkw-donation" value={selectedDonationId} onChange={(event) => setSelectedDonationId(event.target.value)} required><option value="">Selecciona una donación disponible</option>{donations.map((item) => <option key={item.id} value={item.id}>{item.food_name} · {item.quantity_kg} kg · vence {formatDate(item.expires_at)}</option>)}</select>{donations.length === 0 && <small>No hay donaciones disponibles devueltas por la API en este momento.</small>}</div>
            {selectedDonation && <dl className="npkw-donation-preview"><div><dt>Alimento</dt><dd>{selectedDonation.food_name}</dd></div><div><dt>Cantidad</dt><dd>{selectedDonation.quantity_kg} kg</dd></div><div><dt>Vencimiento</dt><dd>{formatDate(selectedDonation.expires_at)}</dd></div></dl>}
            <p className="npkw-privacy-note">La solicitud envía el ID del comedor seleccionado. El backend valida que la cuenta autenticada tenga membresía activa. Este panel no muestra donante, punto de recojo ni indicaciones. El endpoint público sí entrega esos campos al navegador; ocultarlos en la interfaz no los protege. El backend no ofrece un detalle privado de recojo.</p>
            <button className="npkw-button" type="submit" disabled={!selectedKitchenId || !selectedDonation || requestBusy}>{requestBusy ? 'Enviando solicitud…' : 'Solicitar esta donación'}</button>
          </form>
          <div className="npkw-requests-toolbar"><h3>Solicitudes de esta cuenta</h3><label htmlFor="npkw-request-status">Estado<select id="npkw-request-status" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value as RequestStatus | '')}><option value="">Todos</option><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option></select></label></div>
          {requestsError && <FieldMessage message={{ tone: 'error', text: requestsError }} />}
          {requestsLoading ? <p className="npkw-inline-state" role="status"><span className="npkw-spinner" />Consultando tus solicitudes…</p> : !requestsError && visibleRequests.length === 0 ? <p className="npkw-inline-state">No hay solicitudes propias devueltas por la API con este filtro.</p> : null}{!requestsLoading && visibleRequests.length > 0 && <ul className="npkw-request-list">{visibleRequests.map((item) => <li key={item.id}><div><strong>Solicitud {item.id.slice(0, 8)}</strong><span>Comedor ID {item.kitchen_id} · enviada {formatDate(item.submitted_at)}</span></div><span className={`npkw-status npkw-status-${item.status}`}>{item.status}</span><div><span>Estado de donación: {item.donation_status}</span><span>{item.reviewed_at ? `Revisada ${formatDate(item.reviewed_at)}` : 'Aún sin resolución informada'}</span></div></li>)}</ul>}
          <p className="npkw-limitation-copy">La lista devuelve las solicitudes propias. Si el endpoint no retorna una solicitud tras recargar, la interfaz no inventa ni reconstruye su estado.</p>
        </section>
      </>}
      <p className="npkw-source-note">Registros de comedor: fuente pública IDEP almacenada en el backend. La presencia del registro no verifica su funcionamiento actual.</p>
    </section>
  )
}
