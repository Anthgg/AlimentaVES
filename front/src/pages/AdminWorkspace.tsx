import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../lib/api'
import type {
  AdminCommunityKitchenClaim,
  AdminCommunityKitchenProfile,
  AdminKitchenPhoto,
  AdminUser,
  CommunityKitchen,
  Donation,
  DonationRequest,
  DonationStatus,
  RequestStatus,
  ReviewDecision,
  Stats,
  UserRole,
} from '../types'
import './admin-workspace.css'

type AdminSection = 'overview' | 'users' | 'kitchens' | 'donations' | 'claims' | 'profiles' | 'photos' | 'requests'
const pageSize = 50

const sections: Array<{ id: AdminSection; label: string }> = [
  { id: 'overview', label: 'Resumen' },
  { id: 'users', label: 'Usuarios' },
  { id: 'kitchens', label: 'Comedores' },
  { id: 'donations', label: 'Donaciones' },
  { id: 'claims', label: 'Vinculaciones' },
  { id: 'profiles', label: 'Perfiles' },
  { id: 'photos', label: 'Fotografías' },
  { id: 'requests', label: 'Solicitudes' },
]

function dateLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function roleLabel(value: UserRole): string {
  return value === 'admin' ? 'Administración' : value === 'kitchen' ? 'Comedor' : 'Donante'
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', published: 'Publicada',
    available: 'Disponible', reserved: 'Reservada', delivered: 'Entregada',
  }
  return labels[value] ?? value
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'La sesión no es válida o venció. Inicia sesión nuevamente.'
    if (error.status === 403) return 'La API rechazó esta operación por permisos. Solo una cuenta admin puede acceder a este módulo.'
    if (error.status === 404) return 'El registro ya no está disponible. Actualiza la cola para consultar su estado actual.'
    if (error.status === 409) return 'El estado cambió antes de completar la operación. Actualiza la cola e inténtalo otra vez.'
    if (error.status === 422) return `La API rechazó los datos: ${error.message}`
    if (error.status >= 500) return 'El servidor informó un problema. Inténtalo nuevamente más tarde.'
    return error.message
  }
  if (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return 'No se pudo conectar con la API. Comprueba que el backend esté disponible.'
  }
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}

function ResourceState({ loading, error, empty, onRetry, children }: {
  loading: boolean
  error: string
  empty: boolean
  onRetry: () => void
  children: ReactNode
}) {
  if (loading) return <div className="npa-state" role="status"><span className="npa-spinner" aria-hidden="true" />Consultando datos de la API…</div>
  if (error) return <div className="npa-state npa-state-error" role="alert"><strong>No se pudo completar la consulta.</strong><span>{error}</span><button type="button" className="npa-button npa-button-outline" onClick={onRetry}>Volver a intentar</button></div>
  if (empty) return <div className="npa-state"><strong>No hay registros para mostrar.</strong><span>La API respondió sin elementos para este filtro.</span></div>
  return children
}

function PanelHeading({ headingId, eyebrow, title, description, onRefresh, loading }: {
  headingId: string
  eyebrow: string
  title: string
  description: string
  onRefresh: () => void
  loading: boolean
}) {
  return <div className="npa-panel-heading"><div><p className="npa-eyebrow">{eyebrow}</p><h2 id={headingId}>{title}</h2><p>{description}</p></div><button type="button" className="npa-button npa-button-outline" onClick={onRefresh} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button></div>
}

function StatusPill({ value }: { value: string }) {
  return <span className={`npa-status npa-status-${value}`}><i aria-hidden="true" />{statusLabel(value)}</span>
}

function OverviewPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setStats(await api.stats()) } catch (cause) { setError(apiErrorMessage(cause)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  return <section className="npa-panel" aria-labelledby="npa-overview-title">
    <PanelHeading headingId="npa-overview-title" eyebrow="INDICADORES DE API" title="Resumen general" description="Valores devueltos por el endpoint público /stats; no se muestran métricas locales inventadas." onRefresh={() => void load()} loading={loading} />
    <ResourceState loading={loading} error={error} empty={!stats} onRetry={() => void load()}>
      {stats && <>
        <div className="npa-metrics">
          <article><span>Donaciones disponibles</span><strong>{stats.available.toLocaleString('es-PE')}</strong></article>
          <article><span>Donaciones reservadas</span><strong>{stats.reserved.toLocaleString('es-PE')}</strong></article>
          <article><span>Donaciones entregadas</span><strong>{stats.delivered.toLocaleString('es-PE')}</strong></article>
          <article><span>Kilogramos registrados como entregados</span><strong>{stats.kilograms_delivered.toLocaleString('es-PE')} kg</strong></article>
          <article><span>Raciones estimadas</span><strong>{stats.estimated_servings.toLocaleString('es-PE')}</strong><small>Estimación de API basada en kg; no es un conteo de personas.</small></article>
        </div>
        <p className="npa-data-note">Estos indicadores describen registros guardados en la API. Las raciones son una estimación referencial; no se presenta como personas beneficiadas ni como impacto verificado.</p>
      </>}
    </ResourceState>
  </section>
}

function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [role, setRole] = useState<UserRole | ''>('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setUsers(await api.adminUsers({ role: role || undefined, limit: pageSize, offset })) } catch (cause) { setError(apiErrorMessage(cause)) } finally { setLoading(false) }
  }, [role, offset])
  useEffect(() => { void load() }, [load])
  const canNext = users.length === pageSize

  return <section className="npa-panel" aria-labelledby="npa-users-title">
    <PanelHeading headingId="npa-users-title" eyebrow="CUENTAS REGISTRADAS" title="Usuarios" description="Consulta cuentas y roles devueltos por la API. Esta vista no cambia roles ni habilita cuentas." onRefresh={() => void load()} loading={loading} />
    <div className="npa-toolbar"><div className="npa-field"><label htmlFor="npa-user-role">Filtrar por rol</label><select id="npa-user-role" value={role} onChange={(event) => { setOffset(0); setRole(event.target.value as UserRole | '') }}><option value="">Todos los roles</option><option value="donor">Donante</option><option value="kitchen">Comedor</option><option value="admin">Administración</option></select></div><span className="npa-page-label">Página {Math.floor(offset / pageSize) + 1} · hasta {pageSize} filas</span></div>
    <ResourceState loading={loading} error={error} empty={users.length === 0} onRetry={() => void load()}>
      <div className="npa-table-scroll" role="region" aria-label="Tabla de usuarios" tabIndex={0}><table className="npa-table"><caption>Usuarios encontrados en la página actual</caption><thead><tr><th scope="col">Correo</th><th scope="col">Rol</th><th scope="col">Estado de cuenta</th><th scope="col">Creación</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td data-label="Correo"><span className="npa-primary-cell">{user.email}</span></td><td data-label="Rol">{roleLabel(user.role)}</td><td data-label="Estado de cuenta">{user.is_active ? 'Activa según la API' : 'Inactiva según la API'}</td><td data-label="Creación">{dateLabel(user.created_at)}</td></tr>)}</tbody></table></div>
    </ResourceState>
    {!loading && !error && <Pager offset={offset} pageSize={pageSize} canNext={canNext} onChange={setOffset} />}
  </section>
}

function KitchensPanel() {
  const [kitchens, setKitchens] = useState<CommunityKitchen[]>([])
  const [name, setName] = useState('')
  const [district, setDistrict] = useState('')
  const [applied, setApplied] = useState({ name: '', district: '' })
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setKitchens(await api.adminKitchens({ name: applied.name || undefined, district: applied.district || undefined, limit: pageSize, offset })) } catch (cause) { setError(apiErrorMessage(cause)) } finally { setLoading(false) }
  }, [applied, offset])
  useEffect(() => { void load() }, [load])
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setOffset(0); setApplied({ name: name.trim(), district: district.trim() }) }
  const canNext = kitchens.length === pageSize

  return <section className="npa-panel" aria-labelledby="npa-kitchens-title">
    <PanelHeading headingId="npa-kitchens-title" eyebrow="REGISTRO PÚBLICO" title="Comedores" description="Consulta los registros existentes. El estado publicado por la fuente no confirma operación actual." onRefresh={() => void load()} loading={loading} />
    <form className="npa-toolbar npa-filter-form" onSubmit={submit}>
      <div className="npa-field"><label htmlFor="npa-kitchen-name">Nombre</label><input id="npa-kitchen-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="npa-field"><label htmlFor="npa-kitchen-district">Distrito</label><input id="npa-kitchen-district" value={district} onChange={(event) => setDistrict(event.target.value)} /></div>
      <button className="npa-button npa-button-dark" type="submit" disabled={loading}>Aplicar filtros</button>
      <span className="npa-page-label">Página {Math.floor(offset / pageSize) + 1}</span>
    </form>
    <ResourceState loading={loading} error={error} empty={kitchens.length === 0} onRetry={() => void load()}>
      <div className="npa-table-scroll" role="region" aria-label="Tabla de comedores registrados" tabIndex={0}><table className="npa-table"><caption>Comedores del registro oficial en la página actual</caption><thead><tr><th scope="col">Código</th><th scope="col">Nombre</th><th scope="col">Distrito / UBIGEO</th><th scope="col">Modalidad</th><th scope="col">Estado de fuente</th><th scope="col">Fecha de verificación registrada</th></tr></thead><tbody>{kitchens.map((kitchen) => <tr key={kitchen.id}><td data-label="Código">{kitchen.source_code}</td><td data-label="Nombre"><span className="npa-primary-cell">{kitchen.name}</span></td><td data-label="Distrito / UBIGEO">{kitchen.district}<small className="npa-subcell">UBIGEO {kitchen.ubigeo}</small></td><td data-label="Modalidad">{kitchen.modality || 'No informada por la fuente'}</td><td data-label="Estado de fuente">{kitchen.source_status || 'Sin estado de fuente'}</td><td data-label="Fecha de verificación registrada">{kitchen.verified_at ? dateLabel(kitchen.verified_at) : 'Sin fecha registrada'}</td></tr>)}</tbody></table></div>
      <p className="npa-data-note">El estado y la cantidad de usuarios proceden de la fuente pública. No representan una verificación de actividad vigente ni personas únicas.</p>
    </ResourceState>
    {!loading && !error && <Pager offset={offset} pageSize={pageSize} canNext={canNext} onChange={setOffset} />}
  </section>
}

function Pager({ offset, pageSize: size, canNext, onChange }: { offset: number; pageSize: number; canNext: boolean; onChange: (offset: number) => void }) {
  return <nav className="npa-pager" aria-label="Paginación"><button type="button" className="npa-button npa-button-outline" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - size))}>Anterior</button><span>Página {Math.floor(offset / size) + 1}</span><button type="button" className="npa-button npa-button-outline" disabled={!canNext} onClick={() => onChange(offset + size)}>Siguiente</button></nav>
}

function DonationsPanel() {
  const [status, setStatus] = useState<DonationStatus | ''>('')
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setDonations(await api.adminDonations(status || undefined)) } catch (cause) { setError(apiErrorMessage(cause)) } finally { setLoading(false) }
  }, [status])
  useEffect(() => { void load() }, [load])
  return <section className="npa-panel" aria-labelledby="npa-donations-title">
    <PanelHeading headingId="npa-donations-title" eyebrow="CATÁLOGO DE DONACIONES" title="Donaciones" description="Consulta los registros y estados persistidos en la API. Las acciones heredadas de reserva y entrega no se ejecutan desde este listado." onRefresh={() => void load()} loading={loading} />
    <div className="npa-toolbar"><div className="npa-field"><label htmlFor="npa-donation-status">Estado</label><select id="npa-donation-status" value={status} onChange={(event) => setStatus(event.target.value as DonationStatus | '')}><option value="">Todos</option><option value="available">Disponible</option><option value="reserved">Reservada</option><option value="delivered">Entregada</option></select></div></div>
    <ResourceState loading={loading} error={error} empty={donations.length === 0} onRetry={() => void load()}>
      <div className="npa-table-scroll" role="region" aria-label="Tabla de donaciones" tabIndex={0}><table className="npa-table"><caption>Donaciones devueltas por la API</caption><thead><tr><th scope="col">Alimento</th><th scope="col">Donante</th><th scope="col">Cantidad</th><th scope="col">Recojo</th><th scope="col">Vencimiento</th><th scope="col">Estado</th></tr></thead><tbody>{donations.map((item) => <tr key={item.id}><td data-label="Alimento"><span className="npa-primary-cell">{item.food_name}</span></td><td data-label="Donante">{item.donor_name}</td><td data-label="Cantidad">{item.quantity_kg.toLocaleString('es-PE')} kg</td><td data-label="Recojo">{item.pickup_address}</td><td data-label="Vencimiento">{dateLabel(item.expires_at)}</td><td data-label="Estado"><StatusPill value={item.status} /></td></tr>)}</tbody></table></div>
    </ResourceState>
  </section>
}

function ReviewConfirmation({ label, onConfirm, onCancel, busy }: { label: string; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { confirmRef.current?.focus() }, [])
  return <div className="npa-confirm" role="group" aria-label={`Confirmar ${label.toLocaleLowerCase('es')}`}><p>¿Confirmas esta decisión: <strong>{label}</strong>?</p><button ref={confirmRef} type="button" className="npa-button npa-button-dark" onClick={onConfirm} disabled={busy}>{busy ? 'Enviando…' : `Confirmar ${label.toLocaleLowerCase('es')}`}</button><button type="button" className="npa-button npa-button-outline" onClick={onCancel} disabled={busy}>Cancelar</button></div>
}

type PendingReview = { id: string; decision: ReviewDecision; subject: string }

function useReviewAction() {
  const [pending, setPending] = useState<PendingReview | null>(null)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const choose = (review: PendingReview) => { setError(''); setNotice(''); setPending(review) }
  const clear = () => { setPending(null); setError('') }
  const run = async (action: (id: string, decision: ReviewDecision) => Promise<unknown>, reload: () => Promise<void>) => {
    if (!pending || busyId) return
    const current = pending
    setBusyId(current.id); setError(''); setNotice('')
    try {
      await action(current.id, current.decision)
      setNotice(`${current.subject}: decisión ${current.decision === 'approved' ? 'aprobada' : 'rechazada'} por la API.`)
      setPending(null)
      await reload()
    } catch (cause) { setError(apiErrorMessage(cause)) } finally { setBusyId('') }
  }
  return { pending, busyId, notice, error, choose, clear, run, setError }
}

function ClaimsPanel() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [items, setItems] = useState<AdminCommunityKitchenClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const review = useReviewAction()
  const load = useCallback(async () => { setLoading(true); setLoadError(''); try { setItems(await api.adminClaims(status)) } catch (cause) { setLoadError(apiErrorMessage(cause)) } finally { setLoading(false) } }, [status])
  useEffect(() => { void load() }, [load])
  return <section className="npa-panel" aria-labelledby="npa-claims-title">
    <PanelHeading headingId="npa-claims-title" eyebrow="SOLICITUDES DE VINCULACIÓN" title="Revisión de comedores" description="Verifica cada solicitud por un canal autorizado antes de aprobar representación. La API impide que quien la presentó la revise." onRefresh={() => void load()} loading={loading} />
    <div className="npa-toolbar"><div className="npa-field"><label htmlFor="npa-claim-status">Estado</label><select id="npa-claim-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option></select></div></div>
    {review.notice && <p className="npa-inline-success" role="status">{review.notice}</p>}{review.error && <p className="npa-inline-error" role="alert">{review.error}</p>}
    <ResourceState loading={loading} error={loadError} empty={items.length === 0} onRetry={() => void load()}>
      <ul className="npa-review-list">{items.map((item) => <li className="npa-review-card" key={item.id}><div className="npa-review-main"><p className="npa-review-kicker">Vinculación · {dateLabel(item.submitted_at)}</p><h3>{item.kitchen_name}</h3><dl><div><dt>Cuenta solicitante</dt><dd>{item.account_email}</dd></div><div><dt>Identificador de comedor</dt><dd>{item.kitchen_id}</dd></div><div><dt>Estado de solicitud</dt><dd><StatusPill value={item.status} /></dd></div></dl><p className="npa-review-guidance">Confirma externamente que la cuenta representa a este comedor. Si no puedes comprobarlo, rechaza la solicitud.</p></div><div className="npa-review-actions"><button type="button" className="npa-button npa-button-dark" aria-label={`Aprobar vinculación de ${item.kitchen_name}`} onClick={() => review.choose({ id: item.id, decision: 'approved', subject: `Vinculación de ${item.kitchen_name}` })} disabled={review.busyId === item.id}>Aprobar</button><button type="button" className="npa-button npa-button-outline" aria-label={`Rechazar vinculación de ${item.kitchen_name}`} onClick={() => review.choose({ id: item.id, decision: 'rejected', subject: `Vinculación de ${item.kitchen_name}` })} disabled={review.busyId === item.id}>Rechazar</button></div>{review.pending?.id === item.id && <ReviewConfirmation label={review.pending.decision === 'approved' ? 'Aprobación' : 'Rechazo'} busy={review.busyId === item.id} onCancel={review.clear} onConfirm={() => void review.run(api.reviewClaim, load)} />}</li>)}</ul>
    </ResourceState>
  </section>
}

function ProfilesPanel() {
  const [status, setStatus] = useState<'pending' | 'published' | 'rejected'>('pending')
  const [items, setItems] = useState<AdminCommunityKitchenProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const review = useReviewAction()
  const load = useCallback(async () => { setLoading(true); setLoadError(''); try { setItems(await api.adminProfiles(status)) } catch (cause) { setLoadError(apiErrorMessage(cause)) } finally { setLoading(false) } }, [status])
  useEffect(() => { void load() }, [load])
  return <section className="npa-panel" aria-labelledby="npa-profiles-title">
    <PanelHeading headingId="npa-profiles-title" eyebrow="MODERACIÓN DE CONTENIDO" title="Perfiles de comedores" description="Publica una nueva versión solo después de revisar cada campo y confirmar que no contiene datos personales o información identificable de beneficiarios." onRefresh={() => void load()} loading={loading} />
    <div className="npa-toolbar"><div className="npa-field"><label htmlFor="npa-profile-status">Estado</label><select id="npa-profile-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="pending">Pendientes</option><option value="published">Publicadas</option><option value="rejected">Rechazadas</option></select></div></div>
    {review.notice && <p className="npa-inline-success" role="status">{review.notice}</p>}{review.error && <p className="npa-inline-error" role="alert">{review.error}</p>}
    <ResourceState loading={loading} error={loadError} empty={items.length === 0} onRetry={() => void load()}>
      <ul className="npa-review-list">{items.map((item) => <li className="npa-review-card" key={item.id}><div className="npa-review-main"><p className="npa-review-kicker">Perfil · enviado {dateLabel(item.submitted_at)}</p><h3>{item.kitchen_name}</h3><dl><div><dt>Descripción institucional</dt><dd>{item.description || 'No informada'}</dd></div><div><dt>Horario</dt><dd>{item.operating_hours || 'No informado'}</dd></div><div><dt>Ubicación institucional</dt><dd>{item.institutional_location || 'No informada'}</dd></div><div><dt>Necesidades</dt><dd>{item.needs || 'No informadas'}</dd></div><div><dt>Cuenta que envió la versión</dt><dd>{item.submitter_email || 'No disponible'}</dd></div><div><dt>Estado</dt><dd><StatusPill value={item.status} /></dd></div></dl><p className="npa-review-guidance">Revisa nombres, teléfonos, correos, DNI y datos que permitan identificar a beneficiarios. Rechaza contenido personal.</p></div><div className="npa-review-actions"><button type="button" className="npa-button npa-button-dark" aria-label={`Publicar perfil de ${item.kitchen_name}`} onClick={() => review.choose({ id: item.id, decision: 'approved', subject: `Perfil de ${item.kitchen_name}` })} disabled={review.busyId === item.id}>Publicar</button><button type="button" className="npa-button npa-button-outline" aria-label={`Rechazar perfil de ${item.kitchen_name}`} onClick={() => review.choose({ id: item.id, decision: 'rejected', subject: `Perfil de ${item.kitchen_name}` })} disabled={review.busyId === item.id}>Rechazar</button></div>{review.pending?.id === item.id && <ReviewConfirmation label={review.pending.decision === 'approved' ? 'Publicación' : 'Rechazo'} busy={review.busyId === item.id} onCancel={review.clear} onConfirm={() => void review.run(api.reviewProfile, load)} />}</li>)}</ul>
    </ResourceState>
  </section>
}

function RequestsPanel() {
  const [status, setStatus] = useState<RequestStatus | ''>('pending')
  const [items, setItems] = useState<DonationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const review = useReviewAction()
  const load = useCallback(async () => { setLoading(true); setLoadError(''); try { setItems(await api.adminRequests(status || undefined)) } catch (cause) { setLoadError(apiErrorMessage(cause)) } finally { setLoading(false) } }, [status])
  useEffect(() => { void load() }, [load])
  return <section className="npa-panel" aria-labelledby="npa-requests-title">
    <PanelHeading headingId="npa-requests-title" eyebrow="SOLICITUDES DE ALIMENTOS" title="Solicitudes de donación" description="Aprueba una sola solicitud por donación. Al aprobar, la API coordina el cambio de estado y rechaza solicitudes competidoras." onRefresh={() => void load()} loading={loading} />
    <div className="npa-toolbar"><div className="npa-field"><label htmlFor="npa-request-status">Estado</label><select id="npa-request-status" value={status} onChange={(event) => setStatus(event.target.value as RequestStatus | '')}><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option><option value="">Todos</option></select></div></div>
    {review.notice && <p className="npa-inline-success" role="status">{review.notice}</p>}{review.error && <p className="npa-inline-error" role="alert">{review.error}</p>}
    <ResourceState loading={loading} error={loadError} empty={items.length === 0} onRetry={() => void load()}>
      <ul className="npa-review-list">{items.map((item) => <li className="npa-review-card" key={item.id}><div className="npa-review-main"><p className="npa-review-kicker">Solicitud · enviada {dateLabel(item.submitted_at)}</p><h3>Donación {item.donation_id}</h3><dl><div><dt>Comedor</dt><dd>{item.kitchen_id}</dd></div><div><dt>Cuenta solicitante</dt><dd>{item.requested_by}</dd></div><div><dt>Estado de solicitud</dt><dd><StatusPill value={item.status} /></dd></div><div><dt>Estado actual de la donación</dt><dd><StatusPill value={item.donation_status} /></dd></div></dl><p className="npa-review-guidance">Verifica que la donación siga disponible antes de aprobar. La API valida el estado concurrentemente y puede responder 409.</p></div><div className="npa-review-actions"><button type="button" className="npa-button npa-button-dark" aria-label={`Aprobar solicitud ${item.id}`} onClick={() => review.choose({ id: item.id, decision: 'approved', subject: `Solicitud ${item.id}` })} disabled={review.busyId === item.id}>Aprobar</button><button type="button" className="npa-button npa-button-outline" aria-label={`Rechazar solicitud ${item.id}`} onClick={() => review.choose({ id: item.id, decision: 'rejected', subject: `Solicitud ${item.id}` })} disabled={review.busyId === item.id}>Rechazar</button></div>{review.pending?.id === item.id && <ReviewConfirmation label={review.pending.decision === 'approved' ? 'Aprobación' : 'Rechazo'} busy={review.busyId === item.id} onCancel={review.clear} onConfirm={() => void review.run(api.reviewDonationRequest, load)} />}</li>)}</ul>
    </ResourceState>
  </section>
}

function PhotosPanel() {
  const [rows, setRows] = useState<AdminKitchenPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null)
  const [acknowledgedId, setAcknowledgedId] = useState('')
  const [confirming, setConfirming] = useState<{ id: string; decision: ReviewDecision } | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setRows(await api.adminPhotos()) } catch (cause) { setError(apiErrorMessage(cause)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])
  const showPreview = async (id: string) => {
    setBusyId(id); setActionError('')
    try {
      const blob = await api.adminPhotoContent(id)
      if (!blob.type.startsWith('image/')) throw new Error('La respuesta de la API no es una imagen compatible.')
      const url = URL.createObjectURL(blob)
      setPreview((current) => { if (current) URL.revokeObjectURL(current.url); return { id, url } })
      setAcknowledgedId('')
    } catch (cause) { setActionError(apiErrorMessage(cause)) } finally { setBusyId('') }
  }
  const decide = async () => {
    if (!confirming || busyId) return
    const current = confirming
    if (!preview || preview.id !== current.id) { setActionError('Abre y revisa la imagen antes de decidir.') ; return }
    if (current.decision === 'approved' && acknowledgedId !== current.id) { setActionError('Confirma que la imagen no expone rostros ni datos identificables antes de aprobar.') ; return }
    setBusyId(current.id); setActionError(''); setNotice('')
    try {
      await api.reviewPhoto(current.id, current.decision)
      setNotice(`La fotografía fue ${current.decision === 'approved' ? 'aprobada' : 'rechazada'} por la API.`)
      setConfirming(null)
      setAcknowledgedId('')
      setPreview((existing) => { if (existing?.id === current.id) { URL.revokeObjectURL(existing.url); return null } return existing })
      await load()
    } catch (cause) { setActionError(apiErrorMessage(cause)) } finally { setBusyId('') }
  }
  return <section className="npa-panel" aria-labelledby="npa-photos-title">
    <PanelHeading headingId="npa-photos-title" eyebrow="COLA PENDIENTE" title="Moderación de fotografías" description="La pantalla usa los campos confirmados en el handler del backend. OpenAPI todavía no declara el esquema de respuesta de la cola." onRefresh={() => void load()} loading={loading} />
    {notice && <p className="npa-inline-success" role="status">{notice}</p>}{actionError && <p className="npa-inline-error" role="alert">{actionError}</p>}
    <ResourceState loading={loading} error={error} empty={rows.length === 0} onRetry={() => void load()}>
      <ul className="npa-photo-list">{rows.map((row) => <li className="npa-photo-card" key={row.id}><div className="npa-photo-thumb">{preview?.id === row.id ? <img src={preview.url} alt={`Vista previa de fotografía pendiente del comedor ${row.kitchen_name}`} /> : <span aria-hidden="true">IMG</span>}</div><div className="npa-photo-info"><h3>{row.kitchen_name}</h3><dl><div><dt>Comedor</dt><dd>{row.kitchen_id}</dd></div><div><dt>Perfil</dt><dd>{row.profile_id}</dd></div><div><dt>Cuenta que subió la imagen</dt><dd>{row.uploaded_by}</dd></div><div><dt>Categoría</dt><dd>{row.category}</dd></div><div><dt>Formato</dt><dd>{row.content_type}</dd></div><div><dt>Tamaño</dt><dd>{Math.round(row.size_bytes / 1024)} KB</dd></div><div><dt>Dimensiones</dt><dd>{row.width} × {row.height}</dd></div><div><dt>Enviada</dt><dd>{dateLabel(row.uploaded_at)}</dd></div></dl>{preview?.id === row.id && <label className="npa-photo-ack"><input type="checkbox" checked={acknowledgedId === row.id} onChange={(event) => setAcknowledgedId(event.target.checked ? row.id : '')} /><span>He revisado la imagen y confirmo que no expone rostros ni datos identificables.</span></label>}</div><div className="npa-review-actions"><button type="button" className="npa-button npa-button-outline" onClick={() => void showPreview(row.id)} disabled={busyId === row.id}>{busyId === row.id ? 'Cargando…' : preview?.id === row.id ? 'Actualizar vista' : 'Abrir imagen'}</button><button type="button" className="npa-button npa-button-dark" onClick={() => { setActionError(''); setConfirming({ id: row.id, decision: 'approved' }) }} disabled={busyId === row.id || preview?.id !== row.id || acknowledgedId !== row.id}>Aprobar</button><button type="button" className="npa-button npa-button-outline" onClick={() => { setActionError(''); setConfirming({ id: row.id, decision: 'rejected' }) }} disabled={busyId === row.id || preview?.id !== row.id}>Rechazar</button></div>{confirming?.id === row.id && <ReviewConfirmation label={confirming.decision === 'approved' ? 'Aprobación' : 'Rechazo'} busy={busyId === row.id} onCancel={() => setConfirming(null)} onConfirm={() => void decide()} />}</li>)}</ul>
    </ResourceState>
  </section>
}

export function AdminWorkspace() {
  const { user } = useAuth()
  const [section, setSection] = useState<AdminSection>('overview')
  const selected = useMemo(() => sections.find((item) => item.id === section), [section])

  if (user?.role !== 'admin') return <section className="npa-access-denied" role="alert"><h1>Acceso restringido</h1><p>Esta vista requiere una sesión con rol de administración. La API también verifica el permiso en cada operación.</p></section>

  let panel: ReactNode
  if (section === 'overview') panel = <OverviewPanel />
  else if (section === 'users') panel = <UsersPanel />
  else if (section === 'kitchens') panel = <KitchensPanel />
  else if (section === 'donations') panel = <DonationsPanel />
  else if (section === 'claims') panel = <ClaimsPanel />
  else if (section === 'profiles') panel = <ProfilesPanel />
  else if (section === 'photos') panel = <PhotosPanel />
  else panel = <RequestsPanel />

  return <section className="npa-admin-workspace" aria-labelledby="npa-admin-title">
    <header className="npa-admin-header"><div><p className="npa-eyebrow">ADMINISTRACIÓN · ALIMENTAVES</p><h1 id="npa-admin-title" data-page-title tabIndex={-1}>Coordinación de la red</h1><p>Sesión de {user.email}. La API controla los permisos efectivos.</p></div><span className="npa-admin-badge">{selected?.label ?? 'Resumen'}</span></header>
    <div className="npa-admin-layout">
      <nav className="npa-admin-nav" aria-label="Módulos administrativos">{sections.map((item) => <button type="button" key={item.id} className={section === item.id ? 'is-active' : ''} aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
      <div className="npa-admin-content">{panel}</div>
    </div>
  </section>
}
