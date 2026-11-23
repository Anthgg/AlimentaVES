import type { FormEvent, RefObject } from 'react'
import type { CommunityKitchen, CreateDonation, Donation, DonationStatus, Stats } from './types'

export type Page = 'inicio' | 'donaciones' | 'publicar' | 'comedores' | 'impacto'
export type DonationField = 'donor_name' | 'food_name' | 'pickup_address' | 'expires_at'

export const pages: { id: Page; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'donaciones', label: 'Donaciones' },
  { id: 'comedores', label: 'Comedores' },
  { id: 'publicar', label: 'Publicar' },
  { id: 'impacto', label: 'Impacto' },
]

export const statusLabels: Record<DonationStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservada',
  delivered: 'Entregada',
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' })
const quantityFormatter = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

export function formatDate(value: string | null) {
  if (!value) return 'No reportada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateFormatter.format(date)
}

export function formatQuantity(value: number) {
  return quantityFormatter.format(value)
}

function localDateTimeMinimum() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function StatCard({ label, value, note, accent = false }: {
  label: string
  value: string | number
  note: string
  accent?: boolean
}) {
  return (
    <article className={accent ? 'statCard statCardAccent' : 'statCard'}>
      <span className="statLabel">{label}</span>
      <strong>{value}</strong>
      <span className="statNote">{note}</span>
    </article>
  )
}

function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: string }) {
  return <div className="pageIntro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{children}</p></div>
}

export function Header({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return (
    <header className="header">
      <a className="brandBlock" href="#inicio" onClick={event => { event.preventDefault(); onNavigate('inicio') }} aria-label="AlimentaVES, ir al inicio">
        <span className="brandMark" aria-hidden="true" />
        <span className="brandCopy"><span className="brand">Alimenta<span>VES</span></span><small>Red comunitaria · VES</small></span>
      </a>
      <nav className="mainNav" aria-label="Navegación principal">
        {pages.map(({ id, label }) => <a key={id} className={page === id ? 'navLink isActive' : 'navLink'} href={`#${id}`} aria-current={page === id ? 'page' : undefined} onClick={event => { event.preventDefault(); onNavigate(id) }}>{label}</a>)}
      </nav>
      <span className="projectTag">HACKODS UA 2026 · ODS 2 + 12</span>
    </header>
  )
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  const text = message === 'Failed to fetch' ? 'No se pudo conectar con la API. Verifica que el backend esté iniciado.' : message
  return <div className="notice errorNotice" role="alert"><span>{text}</span><button className="textButton" type="button" onClick={onRetry}>Reintentar</button></div>
}

export function SuccessNotice({ message }: { message: string }) {
  return <p className="notice successNotice" role="status">{message}</p>
}

export function HomePage({ stats, loading, onNavigate }: { stats: Stats | null; loading: boolean; onNavigate: (page: Page) => void }) {
  return (
    <>
      <section className="hero" id="inicio">
        <div className="heroCopy">
          <p className="eyebrow">Villa El Salvador · alimento con propósito</p>
          <h1>Lo que sobra en una mesa puede transformar otra.</h1>
          <p className="heroLead">Un punto de encuentro para publicar alimentos, encontrar donaciones y acercar organizaciones comunitarias.</p>
          <div className="heroActions"><button className="buttonPrimary" type="button" onClick={() => onNavigate('publicar')}>Publicar una donación <span aria-hidden="true">→</span></button><button className="buttonOnDark" type="button" onClick={() => onNavigate('donaciones')}>Explorar alimentos</button></div>
          <p className="heroCaption">Prototipo educativo · registros conectados a la API del proyecto.</p>
        </div>
        <div className="heroSeal" aria-label="AlimentaVES, comunidad y alimento"><div className="sealRing" aria-hidden="true"><span className="sealTop">Comunidad · alimento</span><strong>Alimenta<br />VES</strong><span className="sealBottom">Compartir nos une</span></div><p>Una red solidaria en movimiento</p></div>
      </section>
      <section className="contentSection" aria-labelledby="home-impact-title">
        <div className="sectionHeading"><div><p className="eyebrow">Una comunidad que suma</p><h2 id="home-impact-title">El impacto, entre todos</h2></div><p>Indicadores consultados en tiempo real desde la API de AlimentaVES.</p></div>
        <div className="statsGrid">
          <StatCard label="Alimentos disponibles" value={loading ? '—' : stats?.available ?? '—'} note="Donaciones listas para coordinar" />
          <StatCard label="En coordinación" value={loading ? '—' : stats?.reserved ?? '—'} note="Reservas registradas" />
          <StatCard label="Entregas confirmadas" value={loading ? '—' : stats?.delivered ?? '—'} note="Confirmaciones en la plataforma" />
          <StatCard label="Raciones estimadas" value={loading ? '—' : stats?.estimated_servings ?? '—'} note={`${loading ? '—' : formatQuantity(stats?.kilograms_delivered ?? 0)} kg entregados · estimación de 0.35 kg`} accent />
        </div>
        <p className="finePrint">Las raciones son una estimación basada en los kilogramos registrados; no representan personas atendidas.</p>
      </section>
      <section className="stepsSection" aria-labelledby="steps-title">
        <div className="sectionHeading"><div><p className="eyebrow">Así funciona</p><h2 id="steps-title">De una buena intención a una entrega</h2></div></div>
        <div className="stepGrid">
          <article className="stepCard"><span className="stepMark">01 / PUBLICA</span><h3>Comparte lo que tienes</h3><p>Registra el alimento, la cantidad y un punto de entrega para coordinar.</p></article>
          <article className="stepCard"><span className="stepMark">02 / CONECTA</span><h3>Encuentra una donación</h3><p>Los comedores pueden revisar las publicaciones y solicitar una reserva.</p></article>
          <article className="stepCard"><span className="stepMark">03 / CONFIRMA</span><h3>Cierra el ciclo</h3><p>Confirma la entrega para actualizar el estado y el impacto compartido.</p></article>
        </div>
      </section>
    </>
  )
}

function DonationCard({ donation, busy, onReserve, onDeliver }: {
  donation: Donation
  busy: boolean
  onReserve: (donation: Donation) => void
  onDeliver: (donation: Donation) => void
}) {
  return (
    <article className="donationCard" key={donation.id}>
      <div className="donationCardTop"><span className="cardKicker">Alimento compartido</span><span className={`statusPill ${donation.status}`}>{statusLabels[donation.status]}</span></div>
      <h3>{donation.food_name}</h3>
      <p className="donationAmount">{formatQuantity(donation.quantity_kg)} <span>kg</span></p>
      <dl className="donationDetails">
        <div><dt>Donante</dt><dd>{donation.donor_name}</dd></div>
        <div><dt>Punto de entrega</dt><dd>{donation.pickup_address}</dd></div>
        <div><dt>Vencimiento</dt><dd>{formatDate(donation.expires_at)}</dd></div>
        {donation.reserved_by && <div><dt>Reservado por</dt><dd>{donation.reserved_by}</dd></div>}
        {donation.notes && <div><dt>Nota</dt><dd>{donation.notes}</dd></div>}
      </dl>
      <div className="cardAction">
        {donation.status === 'available' && <button type="button" className="buttonPrimary" disabled={busy || new Date(donation.expires_at).getTime() <= Date.now()} onClick={() => onReserve(donation)}>Reservar alimento</button>}
        {donation.status === 'reserved' && <button type="button" className="buttonSecondary" disabled={busy} onClick={() => onDeliver(donation)}>Confirmar entrega</button>}
        {donation.status === 'delivered' && <span className="cardKicker">Entrega registrada</span>}
      </div>
    </article>
  )
}

export function DonationsPage({ donations, visible, loading, error, filter, search, busy, onFilter, onSearch, onClear, onPublish, onReserve, onDeliver }: {
  donations: Donation[]
  visible: Donation[]
  loading: boolean
  error: string
  filter: DonationStatus | ''
  search: string
  busy: boolean
  onFilter: (status: DonationStatus | '') => void
  onSearch: (value: string) => void
  onClear: () => void
  onPublish: () => void
  onReserve: (donation: Donation) => void
  onDeliver: (donation: Donation) => void
}) {
  return (
    <section className="pageSection" id="donaciones" aria-labelledby="donations-title">
      <PageIntro eyebrow="Encuentra alimentos" title="Donaciones">Explora las publicaciones y coordina una reserva con el punto de entrega indicado.</PageIntro>
      <div className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Publicaciones de la red</p><h2 id="donations-title">Alimentos compartidos</h2></div><span className="resultCount" aria-live="polite">{loading ? 'Cargando…' : `${visible.length} ${visible.length === 1 ? 'resultado' : 'resultados'}`}</span></div>
        <div className="donationTools">
          <label className="searchControl" htmlFor="donation-search">Buscar<input id="donation-search" type="search" className="search" placeholder="Alimento, donante o punto de entrega" value={search} onChange={event => onSearch(event.target.value)} /></label>
          <label className="filterControl" htmlFor="donation-filter">Estado<select id="donation-filter" value={filter} onChange={event => onFilter(event.target.value as DonationStatus | '')}><option value="">Todos los estados</option><option value="available">Disponibles</option><option value="reserved">Reservadas</option><option value="delivered">Entregadas</option></select></label>
        </div>
        {loading && <p className="stateMessage" role="status">Cargando publicaciones…</p>}
        {!loading && !error && donations.length === 0 && <div className="emptyState"><span className="emptyMark" aria-hidden="true">＋</span><h3>Aún no hay publicaciones</h3><p>Cuando alguien comparta un alimento aparecerá aquí.</p><button type="button" className="buttonPrimary" onClick={onPublish}>Publicar una donación</button></div>}
        {!loading && !error && donations.length > 0 && visible.length === 0 && <div className="emptyState"><span className="emptyMark" aria-hidden="true">⌕</span><h3>No encontramos resultados</h3><p>Prueba con otra palabra o restablece la búsqueda y el estado.</p><button type="button" className="buttonSecondary" onClick={onClear}>Limpiar búsqueda y filtros</button></div>}
        {!loading && visible.length > 0 && <div className="donationGrid">{visible.map(donation => <DonationCard key={donation.id} donation={donation} busy={busy} onReserve={onReserve} onDeliver={onDeliver} />)}</div>}
      </div>
    </section>
  )
}

export function PublishPage({ form, errors, submitted, busy, onSubmit, onChange, onFieldRef, onCancel }: {
  form: CreateDonation
  errors: Partial<Record<DonationField, string>>
  submitted: boolean
  busy: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (field: keyof CreateDonation, value: string | number) => void
  onFieldRef: (field: DonationField, node: HTMLInputElement | null) => void
  onCancel: () => void
}) {
  const fieldRef = (field: DonationField) => (node: HTMLInputElement | null) => onFieldRef(field, node)
  return (
    <section className="pageSection" id="publicar" aria-labelledby="publish-title">
      <PageIntro eyebrow="Suma una donación" title="Comparte alimentos">Completa los datos para registrar una publicación y facilitar la coordinación de entrega.</PageIntro>
      <div className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Formulario de publicación</p><h2 id="publish-title">Datos del alimento</h2></div><span className="requiredNote"><span>*</span> Obligatorio</span></div>
        <p className="formIntro">Usa un nombre de contacto y un punto de entrega destinados a esta demostración. No incluyas datos personales sensibles.</p>
        <form className="donationForm" onSubmit={onSubmit}>
          <label htmlFor="donor-name"><span>Nombre de contacto <span className="requiredMark">*</span></span><input id="donor-name" ref={fieldRef('donor_name')} required minLength={2} maxLength={100} autoComplete="name" placeholder="Ej.: Donante de prueba" value={form.donor_name} aria-invalid={Boolean(errors.donor_name)} aria-describedby={errors.donor_name ? 'donor-name-error' : undefined} onChange={event => onChange('donor_name', event.target.value)} />{errors.donor_name && <span id="donor-name-error" className="fieldError">{errors.donor_name}</span>}</label>
          <label htmlFor="food-name"><span>Alimento <span className="requiredMark">*</span></span><input id="food-name" ref={fieldRef('food_name')} required minLength={2} maxLength={120} placeholder="Ej.: Arroz en empaque cerrado" value={form.food_name} aria-invalid={Boolean(errors.food_name)} aria-describedby={errors.food_name ? 'food-name-error' : undefined} onChange={event => onChange('food_name', event.target.value)} />{errors.food_name && <span id="food-name-error" className="fieldError">{errors.food_name}</span>}</label>
          <label htmlFor="quantity-kg"><span>Cantidad en kilogramos <span className="requiredMark">*</span></span><input id="quantity-kg" type="number" required min="0.01" max="10000" step="0.01" value={form.quantity_kg} onChange={event => onChange('quantity_kg', Number(event.target.value))} /></label>
          <label htmlFor="pickup-address"><span>Punto de entrega <span className="requiredMark">*</span></span><input id="pickup-address" ref={fieldRef('pickup_address')} required minLength={4} maxLength={200} placeholder="Ej.: Punto de prueba, Villa El Salvador" value={form.pickup_address} aria-invalid={Boolean(errors.pickup_address)} aria-describedby={errors.pickup_address ? 'pickup-address-error' : undefined} onChange={event => onChange('pickup_address', event.target.value)} />{errors.pickup_address && <span id="pickup-address-error" className="fieldError">{errors.pickup_address}</span>}</label>
          <label htmlFor="expires-at"><span>Fecha y hora de vencimiento <span className="requiredMark">*</span></span><input id="expires-at" ref={fieldRef('expires_at')} type="datetime-local" required min={localDateTimeMinimum()} value={form.expires_at} aria-invalid={Boolean(errors.expires_at)} aria-describedby={errors.expires_at ? 'expires-at-error' : undefined} onChange={event => onChange('expires_at', event.target.value)} />{errors.expires_at && <span id="expires-at-error" className="fieldError">{errors.expires_at}</span>}</label>
          <label htmlFor="donation-notes">Notas <span className="optionalNote">(opcional)</span><textarea id="donation-notes" maxLength={500} rows={3} placeholder="Información útil para coordinar la entrega" value={form.notes ?? ''} onChange={event => onChange('notes', event.target.value)} /></label>
          {submitted && <p className="fieldHint" role="status">Revisa los campos señalados antes de publicar.</p>}
          <div className="formActions"><button className="buttonPrimary" type="submit" disabled={busy}>{busy ? 'Publicando…' : 'Publicar donación'}</button><button className="textButton" type="button" onClick={onCancel}>Volver a donaciones</button></div>
        </form>
      </div>
    </section>
  )
}

function KitchenCard({ kitchen }: { kitchen: CommunityKitchen }) {
  const address = kitchen.address?.trim() || 'Dirección no reportada'
  const sourceStatus = kitchen.source_status?.trim() || 'No reportado por la fuente'
  return (
    <article className="kitchenCard">
      <div className="donationCardTop"><span className="cardKicker">Registro de referencia</span><span className="sourcePill">Fuente administrativa</span></div>
      <h3>{kitchen.name}</h3><p className="kitchenLocation">{kitchen.district}{kitchen.ubigeo ? ` · Ubigeo ${kitchen.ubigeo}` : ''}</p>
      <dl className="kitchenDetails">
        <div><dt>Dirección registrada</dt><dd>{address}</dd></div><div><dt>Modalidad</dt><dd>{kitchen.modality || 'No reportada'}</dd></div><div><dt>Estado en la fuente</dt><dd>{sourceStatus}</dd></div><div><dt>Usuarios reportados</dt><dd>{kitchen.users_count ?? 'No reportado'}</dd></div><div><dt>Datos descargados</dt><dd>{formatDate(kitchen.downloaded_at)}</dd></div><div><dt>Verificación del dato</dt><dd>{formatDate(kitchen.verified_at)}</dd></div>
      </dl>
      <p className="sourceCode">Código de origen: {kitchen.source_code}</p><a className="sourceLink" href={kitchen.source_url} target="_blank" rel="noreferrer">Consultar fuente <span aria-hidden="true">↗</span></a>
    </article>
  )
}

export function KitchensPage({ kitchens, matching, visible, loading, error, search, onSearch, onClear, onLoadMore }: {
  kitchens: CommunityKitchen[]
  matching: CommunityKitchen[]
  visible: CommunityKitchen[]
  loading: boolean
  error: string
  search: string
  onSearch: (value: string) => void
  onClear: () => void
  onLoadMore: () => void
}) {
  return (
    <section className="pageSection" id="comedores" aria-labelledby="kitchens-title">
      <PageIntro eyebrow="Organizaciones comunitarias" title="Comedores populares">Consulta los registros disponibles en la fuente administrativa conectada a la API del proyecto.</PageIntro>
      <div className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Directorio de referencia</p><h2 id="kitchens-title">Registros de comedores</h2></div><span className="resultCount">{loading ? 'Cargando…' : `${matching.length} ${matching.length === 1 ? 'registro' : 'registros'}`}</span></div>
        <p className="sourceNotice">Los datos se muestran tal como fueron recibidos de la fuente. Su presencia aquí no confirma que el comedor siga operando ni que sus datos estén actualizados.</p>
        {kitchens.length > 0 && <div className="donationTools kitchenTools"><label className="searchControl" htmlFor="kitchen-search">Buscar por nombre, distrito o estado<input id="kitchen-search" type="search" placeholder="Ej.: comedor, Villa El Salvador" value={search} onChange={event => onSearch(event.target.value)} /></label><span className="resultCount">Mostrando {visible.length} de {matching.length}</span></div>}
        {loading && <p className="stateMessage" role="status">Cargando registros…</p>}
        {!loading && !error && kitchens.length === 0 && <div className="emptyState"><span className="emptyMark" aria-hidden="true">⌂</span><h3>No hay registros disponibles</h3><p>La API no devolvió comedores para mostrar.</p></div>}
        {!loading && kitchens.length > 0 && matching.length === 0 && <div className="emptyState"><span className="emptyMark" aria-hidden="true">⌕</span><h3>No encontramos ese comedor</h3><p>Prueba con otro nombre, distrito o estado de la fuente.</p><button type="button" className="buttonSecondary" onClick={onClear}>Limpiar búsqueda</button></div>}
        {!loading && matching.length > 0 && <div className="kitchenGrid">{visible.map(kitchen => <KitchenCard key={kitchen.id} kitchen={kitchen} />)}</div>}
        {!loading && visible.length < matching.length && <div className="formActions"><button type="button" className="buttonSecondary" onClick={onLoadMore}>Mostrar más registros</button></div>}
      </div>
    </section>
  )
}

export function ImpactPage({ stats, loading, onNavigate }: { stats: Stats | null; loading: boolean; onNavigate: (page: Page) => void }) {
  return (
    <section className="pageSection" id="impacto" aria-labelledby="impact-title">
      <PageIntro eyebrow="Una mirada al esfuerzo colectivo" title="Impacto compartido">Cada publicación y cada entrega confirmada aporta al registro comunitario de esta demostración.</PageIntro>
      <div className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Datos de la API</p><h2 id="impact-title">Actividad registrada</h2></div><span className="resultCount">Actualizado en vivo</span></div>
        <div className="statsGrid"><StatCard label="Disponibles" value={loading ? '—' : stats?.available ?? '—'} note="Publicaciones por coordinar" /><StatCard label="Reservadas" value={loading ? '—' : stats?.reserved ?? '—'} note="En proceso de coordinación" /><StatCard label="Entregadas" value={loading ? '—' : stats?.delivered ?? '—'} note="Entregas confirmadas" /><StatCard label="Kilogramos entregados" value={loading ? '—' : `${formatQuantity(stats?.kilograms_delivered ?? 0)} kg`} note="Cantidad reportada en la plataforma" accent /></div>
        <div className="impactCallout"><span className="calloutMark" aria-hidden="true">✳</span><div><h2>{loading ? '—' : stats?.estimated_servings ?? '—'} raciones estimadas</h2><p>Cálculo referencial de 0.35 kg por ración; no es un conteo de personas atendidas.</p></div><button className="buttonSecondary" type="button" onClick={() => onNavigate('donaciones')}>Ver donaciones</button></div>
      </div>
    </section>
  )
}

export function Footer() {
  return <footer className="footer"><span className="footerBrand">AlimentaVES · HackODS UA 2026</span><p>Prototipo educativo. No representa un servicio activo de distribución ni una evaluación sanitaria.</p></footer>
}

export function ReservationDialog({ reservation, name, error, busy, dialogRef, nameRef, onNameChange, onSubmit, onClose }: {
  reservation: Donation | null
  name: string
  error: string
  busy: boolean
  dialogRef: RefObject<HTMLDialogElement | null>
  nameRef: RefObject<HTMLInputElement | null>
  onNameChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}) {
  if (!reservation) return null
  return (
    <dialog className="reservationDialog" ref={dialogRef} aria-labelledby="reservation-title" onClose={onClose}>
      <div className="dialogHeader"><p className="eyebrow">Coordina una reserva</p><button type="button" className="iconButton" aria-label="Cerrar ventana" onClick={() => dialogRef.current?.close()}>×</button></div>
      <h2 id="reservation-title">Reservar {reservation.food_name}</h2><p className="dialogIntro">Ingresa el nombre del comedor que coordinará la entrega.</p>
      <form className="reservationForm" onSubmit={onSubmit}>
        <label htmlFor="reservation-name"><span>Nombre del comedor <span className="requiredMark">*</span></span><input id="reservation-name" ref={nameRef} autoFocus required minLength={2} maxLength={120} value={name} aria-invalid={Boolean(error)} aria-describedby={error ? 'reservation-error' : 'reservation-hint'} onChange={event => onNameChange(event.target.value)} /></label>
        {error ? <span id="reservation-error" className="fieldError" role="alert">{error}</span> : <p id="reservation-hint" className="fieldHint">El equipo deberá coordinar directamente la entrega.</p>}
        <div className="formActions dialogActions"><button className="buttonPrimary" type="submit" disabled={busy}>{busy ? 'Procesando…' : 'Confirmar reserva'}</button><button className="buttonSecondary" type="button" disabled={busy} onClick={() => dialogRef.current?.close()}>Cancelar</button></div>
      </form>
    </dialog>
  )
}
