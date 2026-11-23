import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { AppPage } from '../app/navigation'
import { api, ApiError } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { CommunityKitchen, CreateDonation, Donation, DonationStatus } from '../types'
import { expiryDetails, formatDate, formatNumber, minimumDateTime, statusLabels } from '../utils/format'
import { Icon } from '../components/Icon'
import { FoodCategoryGuide, FoodVisual } from '../components/FoodVisual'
import { MotionReveal } from '../components/MotionReveal'

const PAGE_SIZE = 9
const emptyForm: CreateDonation = { donor_name: '', food_name: '', quantity_kg: 1, pickup_address: '', expires_at: '', notes: '' }
const filters: Array<{ value: DonationStatus | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'available', label: 'Disponibles' },
  { value: 'reserved', label: 'Reservadas' },
  { value: 'delivered', label: 'Entregadas' },
]

function DonationStatus({ status }: { status: DonationStatus }) {
  return <span className={`np-live-status np-live-status-${status}`}><i aria-hidden="true" />{statusLabels[status]}</span>
}

function DonationCard({ donation, canRequest, onDetails, onReserve, onDeliver, onRequest }: {
  donation: Donation
  canRequest: boolean
  onDetails: (item: Donation) => void
  onReserve: (item: Donation) => void
  onDeliver: (item: Donation) => void
  onRequest: (item: Donation) => void
}) {
  const expiry = expiryDetails(donation.expires_at)
  return <article className="np-live-donation-card np-donation-result-card">
    <FoodVisual file="caja-solidaria.png" alt="Ilustración genérica de una caja solidaria" className="np-donation-card-visual" caption="Ilustración · no es una foto de este lote." />
    <div className="np-live-donation-card-top"><span><Icon name="leaf" size={18} />Donación registrada</span><DonationStatus status={donation.status} /></div>
    <h2>{donation.food_name}</h2>
    <strong className="np-live-quantity">{formatNumber(donation.quantity_kg)} <small>kg</small></strong>
    <dl className="np-donation-facts"><div><dt>Vencimiento</dt><dd className={expiry.tone === 'expired' ? 'is-expired' : ''}>{expiry.label} · {formatDate(donation.expires_at)}</dd></div><div><dt>Fecha de registro</dt><dd>{formatDate(donation.created_at)}</dd></div></dl>
    <div className="np-donation-card-actions">
      {donation.status === 'available' && expiry.tone !== 'expired' && <><button type="button" className="np-button np-button-dark np-button-small" onClick={() => onReserve(donation)}>Reserva directa <Icon name="arrow" size={16} /></button>{canRequest && <button type="button" className="np-button np-button-outline np-button-small" onClick={() => onRequest(donation)}>Solicitar revisión</button>}</>}
      {donation.status === 'reserved' && <button type="button" className="np-button np-button-outline np-button-small" onClick={() => onDeliver(donation)}><Icon name="check" size={16} />Confirmar entrega</button>}
      {donation.status === 'available' && expiry.tone === 'expired' && <span className="np-expired-note">Vencida · no se puede reservar</span>}
      <button type="button" className="np-card-action" onClick={() => onDetails(donation)}>Ver detalle <Icon name="arrow" size={16} /></button>
    </div>
  </article>
}

function DonationDetailDialog({ donation, busy, onClose, onReserve, onDeliver }: { donation: Donation; busy: boolean; onClose: () => void; onReserve: () => void; onDeliver: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  const expiry = expiryDetails(donation.expires_at)
  return <dialog ref={ref} className="np-dialog" aria-labelledby="donation-dialog-title" onClose={onClose}>
    <div className="np-dialog-heading"><div><p className="np-eyebrow"><span />DETALLE DEL LOTE</p><h2 id="donation-dialog-title">{donation.food_name}</h2></div><button className="np-dialog-close" type="button" onClick={() => ref.current?.close()} aria-label="Cerrar detalle"><Icon name="close" size={19} /></button></div>
    <div className="np-dialog-summary"><DonationStatus status={donation.status} /><strong>{formatNumber(donation.quantity_kg)} kg</strong></div>
    <dl className="np-dialog-facts"><div><dt>Vencimiento</dt><dd>{expiry.label} · {formatDate(donation.expires_at)}</dd></div><div><dt>Registrada</dt><dd>{formatDate(donation.created_at)}</dd></div>{donation.delivered_at && <div><dt>Entrega confirmada</dt><dd>{formatDate(donation.delivered_at)}</dd></div>}</dl>
    <p className="np-private-detail-note"><Icon name="shield" size={17} />El catálogo público del backend envía al navegador el nombre del donante, el punto de recojo y las indicaciones. Esta pantalla no los muestra; ocultarlos aquí no es una barrera de acceso. El backend debe restringirlos para considerarlos privados.</p>
    <div className="np-dialog-actions">{donation.status === 'available' && expiry.tone !== 'expired' && <button type="button" className="np-button np-button-dark" disabled={busy} onClick={onReserve}>Reserva directa</button>}{donation.status === 'reserved' && <button type="button" className="np-button np-button-dark" disabled={busy} onClick={onDeliver}>Confirmar entrega</button>}<button type="button" className="np-button np-button-outline" onClick={() => ref.current?.close()}>Cerrar</button></div>
  </dialog>
}

function ActionDialog({ donation, action, kitchens, busy, error, onClose, onSubmit }: {
  donation: Donation
  action: 'reserve' | 'deliver' | 'request'
  kitchens: CommunityKitchen[]
  busy: boolean
  error: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  const isRequest = action === 'request'
  const isReserve = action === 'reserve'
  return <dialog ref={ref} className="np-dialog np-action-dialog" aria-labelledby="action-dialog-title" onClose={onClose}>
    <div className="np-dialog-heading"><div><p className="np-eyebrow"><span />{isRequest ? 'SOLICITUD PARA REVISIÓN' : isReserve ? 'RESERVA DIRECTA' : 'CONFIRMAR ENTREGA'}</p><h2 id="action-dialog-title">{isRequest ? 'Solicitar este alimento' : isReserve ? 'Reservar esta donación' : '¿Confirmar la entrega?'}</h2></div><button className="np-dialog-close" type="button" onClick={() => ref.current?.close()} aria-label="Cerrar confirmación" disabled={busy}><Icon name="close" size={19} /></button></div>
    <p className="np-dialog-intro"><strong>{donation.food_name}</strong> · {formatNumber(donation.quantity_kg)} kg · vence {formatDate(donation.expires_at)}</p>
    {isRequest && <p className="np-dialog-notice">La solicitud queda pendiente de revisión. Seleccionar un registro no prueba que tu cuenta tenga membresía; la API valida el vínculo activo. Esta acción no ejecuta una reserva directa.</p>}
    {isReserve && <p className="np-dialog-notice">Esta acción usa la ruta de reserva directa existente. Esa ruta no requiere autenticación y no equivale a solicitar aprobación administrativa.</p>}
    {action === 'deliver' && <p className="np-dialog-notice">La API solo permite confirmar la entrega de una donación reservada. El estado cambiará si el servidor acepta la actualización.</p>}
    <form onSubmit={onSubmit} className="np-action-form">
      {isReserve && <div className="np-field"><label htmlFor="direct-reserver">Nombre del comedor</label><input id="direct-reserver" name="reserved_by" type="text" minLength={2} maxLength={200} autoComplete="organization" required /><small className="np-field-help">El backend actual guarda este nombre libremente y no vincula la reserva con una cuenta.</small></div>}
      {isRequest && <div className="np-field"><label htmlFor="request-kitchen-id">Comedor del catálogo</label><select id="request-kitchen-id" name="kitchen_id" required defaultValue=""><option value="" disabled>Selecciona un comedor</option>{kitchens.map((kitchen) => <option key={kitchen.id} value={kitchen.id}>{kitchen.name} · {kitchen.district} · ID {kitchen.id}</option>)}</select>{kitchens.length === 0 && <small className="np-field-help">No se cargaron comedores. Cierra y vuelve a intentarlo desde el directorio.</small>}</div>}
      {error && <p className="np-form-error" role="alert">{error}</p>}
      <div className="np-dialog-actions"><button className="np-button np-button-dark" type="submit" disabled={busy || (isRequest && kitchens.length === 0)}>{busy ? 'Enviando…' : isRequest ? 'Enviar solicitud' : isReserve ? 'Confirmar reserva directa' : 'Confirmar entrega'}</button><button className="np-button np-button-outline" type="button" disabled={busy} onClick={() => ref.current?.close()}>Cancelar</button></div>
    </form>
  </dialog>
}

export function DonationCatalogPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<DonationStatus | ''>('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Donation | null>(null)
  const [action, setAction] = useState<{ kind: 'reserve' | 'deliver' | 'request'; donation: Donation } | null>(null)
  const [kitchens, setKitchens] = useState<CommunityKitchen[]>([])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  async function load(selectedStatus = status) {
    setLoading(true)
    setError('')
    try { setRows(await api.listDonations(selectedStatus || undefined)) }
    catch (cause) { setError(friendlyError(cause)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load(status) }, [status])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-PE')
    if (!term) return rows
    return rows.filter((item) => `${item.food_name} ${statusLabels[item.status]}`.toLocaleLowerCase('es-PE').includes(term))
  }, [rows, search])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const startAction = async (kind: 'reserve' | 'deliver' | 'request', donation: Donation) => {
    setActionError('')
    setNotice('')
    setSelected(null)
    if (kind === 'request') {
      if (user?.role !== 'kitchen') return
      setSelected(null)
      try { setKitchens(await api.listCommunityKitchens({ limit: 500 })) }
      catch (cause) { setActionError(friendlyError(cause)); setKitchens([]) }
    }
    setAction({ kind, donation })
  }
  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!action || busy) return
    const formData = new FormData(event.currentTarget)
    setBusy(true)
    setActionError('')
    try {
      if (action.kind === 'reserve') {
        const name = String(formData.get('reserved_by') ?? '').trim()
        if (name.length < 2) throw new Error('Escribe el nombre del comedor para continuar.')
        await api.reserve(action.donation.id, name)
        setNotice('El backend confirmó la reserva directa de la donación.')
      } else if (action.kind === 'deliver') {
        await api.deliver(action.donation.id)
        setNotice('El backend confirmó la entrega.')
      } else {
        const kitchenId = Number(formData.get('kitchen_id'))
        if (!Number.isInteger(kitchenId) || kitchenId < 1) throw new Error('Selecciona un comedor del catálogo.')
        const result = await api.createDonationRequest(action.donation.id, kitchenId)
        setNotice(`La solicitud quedó registrada con estado «${result.status}». La aprobación requiere moderación administrativa.`)
      }
      setAction(null)
      setSelected(null)
      await load(status)
    } catch (cause) {
      setActionError(friendlyError(cause))
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 409)) void load(status)
    } finally { setBusy(false) }
  }

  return <section className="np-page np-donations-page" aria-labelledby="nature-view-title">
    <MotionReveal className="np-page-reveal"><div className="np-page-intro np-reveal"><div><p className="np-eyebrow"><span />ALIMENTOS EN LA RED</p><h1 id="nature-view-title" tabIndex={-1}>Explora donaciones disponibles.</h1><p>Busca alimentos registrados por la comunidad, revisa su estado y coordina el siguiente paso.</p></div><button className="np-button np-button-orange" type="button" onClick={() => onNavigate('publicar')}>Publicar donación <Icon name="plus" size={17} /></button></div></MotionReveal>
    <FoodCategoryGuide />
    <div className="np-donation-summary np-reveal"><strong>{loading ? '…' : formatNumber(rows.length)}</strong><span>{status ? `registros · ${statusLabels[status]}` : 'registros devueltos por la API'}</span><p>Los resultados se consultan directamente en el backend.</p></div>
    <div className="np-list-toolbar np-reveal"><search className="np-search-box" aria-label="Buscar donaciones"><Icon name="search" size={19} /><label className="np-visually-hidden" htmlFor="donation-search">Buscar por nombre del alimento o estado</label><input id="donation-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar por alimento o estado" /></search><div className="np-filter-group"><label htmlFor="donation-status">Estado</label><select id="donation-status" value={status} onChange={(event) => { setStatus(event.target.value as DonationStatus | ''); setPage(0) }}>{filters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></div><button className="np-button np-button-outline np-button-small" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Consultando…' : 'Actualizar'}</button></div>
    {notice && <p className="np-inline-status" role="status"><Icon name="check" size={17} />{notice}</p>}
    {error && <div className="np-page-alert" role="alert"><div><strong>No se pudo cargar el catálogo.</strong><p>{error}</p></div><button className="np-button np-button-outline np-button-small" type="button" onClick={() => void load()} disabled={loading}>Reintentar</button></div>}
    {loading && rows.length === 0 ? <div className="np-empty-state" role="status"><span className="np-loading-indicator" /><h2>Consultando donaciones en el backend…</h2></div> : null}
    {!loading && !error && filtered.length === 0 && <div className="np-empty-state"><FoodVisual file="ingredient-rice-pile.png" alt="Ilustración decorativa de granos de arroz" className="np-empty-food-visual" caption="Ilustración · no representa un lote disponible." /><h2>{rows.length ? 'No encontramos coincidencias.' : 'Aún no hay donaciones registradas.'}</h2><p>{rows.length ? 'Prueba otro alimento o cambia el estado seleccionado.' : 'Cuando el backend devuelva un lote aparecerá aquí.'}</p>{rows.length > 0 && <button type="button" className="np-button np-button-outline" onClick={() => { setSearch(''); setStatus('') }}>Limpiar filtros</button>}</div>}
    {visible.length > 0 && <div className="np-donation-grid">{visible.map((item) => <DonationCard key={item.id} donation={item} canRequest={user?.role === 'kitchen'} onDetails={setSelected} onReserve={(donation) => void startAction('reserve', donation)} onDeliver={(donation) => void startAction('deliver', donation)} onRequest={(donation) => void startAction('request', donation)} />)}</div>}
    {filtered.length > PAGE_SIZE && <nav className="np-pagination" aria-label="Paginación de donaciones"><span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}</span><button type="button" className="np-button np-button-outline np-button-small" disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Anterior</button><span aria-current="page">Página {page + 1} de {pageCount}</span><button type="button" className="np-button np-button-outline np-button-small" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Siguiente</button></nav>}
    <p className="np-disclaimer np-reveal">El endpoint público actual envía al navegador el nombre del donante, el punto de recojo y las indicaciones. Esta interfaz no los renderiza, pero eso no limita la inspección de la respuesta. La reserva directa no requiere autenticación en el backend; las solicitudes sujetas a revisión requieren rol de comedor y membresía activa.</p>
    {selected && <DonationDetailDialog donation={selected} busy={busy} onClose={() => setSelected(null)} onReserve={() => void startAction('reserve', selected)} onDeliver={() => void startAction('deliver', selected)} />}
    {action && <ActionDialog donation={action.donation} action={action.kind} kitchens={kitchens} busy={busy} error={actionError} onClose={() => { if (!busy) { setAction(null); setActionError('') } }} onSubmit={(event) => void submitAction(event)} />}
  </section>
}

export function PublishDonationPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState<CreateDonation>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Donation | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    const donor = form.donor_name.trim()
    const food = form.food_name.trim()
    const address = form.pickup_address.trim()
    const quantity = Number(form.quantity_kg)
    const expiry = new Date(form.expires_at).getTime()
    if (donor.length < 2 || food.length < 2 || address.length < 4) { setError('Completa el nombre del donante, el alimento y el punto de recojo con información válida.'); return }
    if (!Number.isFinite(quantity) || quantity <= 0) { setError('La cantidad debe ser un número mayor que cero.'); return }
    if (!form.expires_at || !Number.isFinite(expiry) || expiry <= Date.now()) { setError('Elige una fecha y hora de vencimiento futura.'); return }
    setBusy(true)
    try {
      const result = await api.createDonation({ ...form, donor_name: donor, food_name: food, quantity_kg: quantity, pickup_address: address, expires_at: new Date(form.expires_at).toISOString(), notes: form.notes?.trim() || '' })
      setCreated(result)
      setForm(emptyForm)
    } catch (cause) { setError(friendlyError(cause)) }
    finally { setBusy(false) }
  }
  const update = (key: keyof CreateDonation, value: string | number) => setForm((current) => ({ ...current, [key]: value }))
  return <section className="np-page np-publish-page" aria-labelledby="nature-view-title">
    <MotionReveal className="np-page-reveal"><div className="np-page-intro np-reveal"><div><p className="np-eyebrow"><span />PUBLICAR ALIMENTOS</p><h1 id="nature-view-title" tabIndex={-1}>Comparte un lote con la comunidad.</h1><p>Completa los datos que la API requiere para registrar una donación disponible.</p></div><span className="np-publish-badge"><Icon name="package" size={19} /> Publicación de donación</span></div></MotionReveal>
    {created ? <div className="np-publish-success np-reveal" role="status"><span><Icon name="check" size={22} /></span><p className="np-eyebrow"><span />REGISTRO CREADO</p><h2>{created.food_name} está en la plataforma.</h2><p>El backend devolvió el estado «{statusLabels[created.status]}», {formatNumber(created.quantity_kg)} kg y vencimiento {formatDate(created.expires_at)}.</p><dl><div><dt>Identificador</dt><dd>{created.id}</dd></div><div><dt>Fecha de registro</dt><dd>{formatDate(created.created_at)}</dd></div></dl><div className="np-publish-actions"><button type="button" className="np-button np-button-dark" onClick={() => onNavigate('donaciones')}>Ver catálogo</button><button type="button" className="np-button np-button-outline" onClick={() => setCreated(null)}>Publicar otro lote</button></div></div> : <div className="np-publish-layout">
      <aside className="np-publish-guide np-reveal"><FoodVisual file="caja-solidaria.png" alt="Ilustración decorativa de una caja de alimentos" className="np-publish-visual" caption="Ilustración de apoyo · no representa una donación real." /><p className="np-eyebrow"><span />ANTES DE PUBLICAR</p><h2>Información clara facilita la coordinación.</h2><ul><li><Icon name="check" size={18} /><span>Indica alimento, cantidad real y fecha de vencimiento.</span></li><li><Icon name="check" size={18} /><span>Usa un punto institucional de recojo, no un domicilio personal.</span></li><li><Icon name="check" size={18} /><span>No incluyas teléfonos, correos ni información personal en las indicaciones.</span></li><li><Icon name="check" size={18} /><span>La reserva directa de la API no requiere inicio de sesión; la solicitud para aprobación es otro flujo.</span></li></ul><p>El catálogo público actual envía nombre, punto de recojo e indicaciones al navegador. No compartas datos personales: ocultarlos en la interfaz no restringe el payload. La API permite publicar sin JWT; iniciar sesión no cambia esa autorización del servidor.</p></aside>
      <form className="np-publish-form np-reveal" onSubmit={(event) => void submit(event)}>
        <div className="np-publish-form-heading"><span className="np-publish-icon"><Icon name="package" size={22} /></span><div><h2>Datos de la donación</h2><p>Los campos con asterisco son obligatorios.</p></div></div>
        {error && <p className="np-form-error" role="alert">{error}</p>}
        <div className="np-form-grid"><div className="np-field"><label htmlFor="publish-donor">Nombre público del donante *</label><input id="publish-donor" name="donor_name" type="text" value={form.donor_name} onChange={(event) => update('donor_name', event.target.value)} required minLength={2} maxLength={200} autoComplete="organization" aria-describedby="publish-donor-help" /><small id="publish-donor-help" className="np-field-help">Usa el nombre de la organización, comercio o institución.</small></div>
          <div className="np-field"><label htmlFor="publish-food">Nombre del alimento *</label><input id="publish-food" name="food_name" type="text" value={form.food_name} onChange={(event) => update('food_name', event.target.value)} required minLength={2} maxLength={200} /></div>
          <div className="np-field"><label htmlFor="publish-quantity">Cantidad (kg) *</label><input id="publish-quantity" name="quantity_kg" type="number" inputMode="decimal" min="0.1" step="0.1" value={form.quantity_kg || ''} onChange={(event) => update('quantity_kg', Number(event.target.value))} required /></div>
          <div className="np-field"><label htmlFor="publish-expiry">Fecha y hora de vencimiento *</label><input id="publish-expiry" name="expires_at" type="datetime-local" min={minimumDateTime()} value={form.expires_at} onChange={(event) => update('expires_at', event.target.value)} required /></div>
          <div className="np-field np-field-wide"><label htmlFor="publish-pickup">Punto institucional de recojo *</label><input id="publish-pickup" name="pickup_address" type="text" value={form.pickup_address} onChange={(event) => update('pickup_address', event.target.value)} required minLength={4} maxLength={300} autoComplete="street-address" aria-describedby="publish-pickup-help" /><small id="publish-pickup-help" className="np-field-help">No uses un domicilio personal. Incluye un punto seguro acordado para la entrega.</small></div>
          <div className="np-field np-field-wide"><label htmlFor="publish-notes">Indicaciones adicionales</label><textarea id="publish-notes" name="notes" value={form.notes ?? ''} maxLength={1000} rows={4} onChange={(event) => update('notes', event.target.value)} aria-describedby="publish-notes-help" /><small id="publish-notes-help" className="np-field-help">Evita teléfonos, correos y datos personales.</small></div></div>
        <button className="np-button np-button-dark np-button-wide" type="submit" disabled={busy}>{busy ? 'Publicando…' : 'Publicar donación'} <Icon name="arrow" size={17} /></button>
        {user && <p className="np-publish-session-note">Sesión activa: {user.email} · rol {user.role}. El backend actual no vincula la donación con esta cuenta.</p>}
      </form>
    </div>}
  </section>
}
