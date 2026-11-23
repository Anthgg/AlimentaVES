import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { api } from './lib/api'
import type { CreateDonation, Donation, DonationStatus, Stats } from './types'

type Page = 'inicio' | 'donaciones' | 'publicar' | 'impacto'
type IconName = 'leaf' | 'arrow' | 'search' | 'package' | 'pin' | 'clock' | 'check' | 'plus' | 'refresh' | 'close'
type DialogState = { kind: 'reserve' | 'deliver'; donation: Donation } | null
type Notice = { tone: 'success' | 'error'; text: string }

const pageLabels: Record<Page, string> = {
  inicio: 'Inicio',
  donaciones: 'Donaciones',
  publicar: 'Publicar donación',
  impacto: 'Impacto',
}

const statusLabels: Record<DonationStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservada',
  delivered: 'Entregada',
}

const statusFilters: Array<{ value: DonationStatus | ''; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'available', label: 'Disponibles' },
  { value: 'reserved', label: 'Reservadas' },
  { value: 'delivered', label: 'Entregadas' },
]

const emptyDonation: CreateDonation = {
  donor_name: '',
  food_name: '',
  quantity_kg: 1,
  pickup_address: '',
  expires_at: '',
  notes: '',
}

const iconShapes: Record<IconName, ReactNode> = {
  leaf: <><path d="M20.5 3.5C11 3.5 5 7.7 5 14a6.5 6.5 0 0 0 6.5 6.5c6.3 0 9-7.7 9-17Z" /><path d="M3.5 21c3-5 7-8.5 12-11" /></>,
  arrow: <><path d="M4 12h15" /><path d="m13 5 7 7-7 7" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  package: <><path d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3L12 3Z" /><path d="m4.4 7.5 7.6 4 7.6-4M12 12v9M8 5.2l8 4.2" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <><path d="m5 12 4.2 4.2L19 6.8" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.8 9A7 7 0 0 1 18 6.4L20 12M4 12l2 5.6A7 7 0 0 0 18.2 15" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
}

function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconShapes[name]}
    </svg>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar'
  return date.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(value)
}

function expiryDetails(value: string): { label: string; tone: 'urgent' | 'soon' | 'normal' | 'expired' } {
  const expiry = new Date(value).getTime()
  if (Number.isNaN(expiry)) return { label: 'Vencimiento por confirmar', tone: 'normal' }
  const remaining = expiry - Date.now()
  if (remaining <= 0) return { label: 'Vencido', tone: 'expired' }
  if (remaining <= 24 * 60 * 60 * 1000) return { label: 'Vence hoy', tone: 'urgent' }
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000))
  return { label: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, tone: days <= 3 ? 'soon' : 'normal' }
}

function friendlyError(error: unknown): string {
  if (error instanceof Error) {
    if (/failed to fetch|networkerror/i.test(error.message)) {
      return 'No se pudo conectar con la plataforma. Comprueba que el servicio esté disponible e inténtalo otra vez.'
    }
    return error.message
  }
  return 'Ocurrió un problema. Inténtalo otra vez.'
}

function StatusBadge({ status }: { status: DonationStatus }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{statusLabels[status]}</span>
}

function DonationCard({
  donation,
  onReserve,
  onDeliver,
  disabled,
  compact = false,
}: {
  donation: Donation
  onReserve: (donation: Donation) => void
  onDeliver: (donation: Donation) => void
  disabled: boolean
  compact?: boolean
}) {
  const expiry = expiryDetails(donation.expires_at)
  const unavailable = expiry.tone === 'expired'

  return (
    <article className={`donation-card${compact ? ' donation-card-compact' : ''}`}>
      <div className="donation-card-head">
        <span className="donation-kind"><Icon name="leaf" size={15} /> Donación de alimentos</span>
        <StatusBadge status={donation.status} />
      </div>
      <div className="donation-card-main">
        <h3>{donation.food_name}</h3>
        <p className="donor-line">Compartido por <strong>{donation.donor_name}</strong></p>
        <div className="quantity-block">
          <strong>{formatNumber(donation.quantity_kg)} <span>kg</span></strong>
          <small>cantidad disponible</small>
        </div>
        <div className="donation-details">
          <p><Icon name="pin" size={16} /><span>{donation.pickup_address}</span></p>
          <p className={`expiry-line expiry-${expiry.tone}`}><Icon name="clock" size={16} /><span>{expiry.label} · {formatDate(donation.expires_at)}</span></p>
          {donation.notes && <p className="donation-note">{donation.notes}</p>}
          {donation.reserved_by && <p className="reserved-by">Reservada por <strong>{donation.reserved_by}</strong></p>}
        </div>
      </div>
      <div className="donation-card-actions">
        {donation.status === 'available' && (
          <button className="button button-dark button-full" disabled={disabled || unavailable} onClick={() => onReserve(donation)}>
            {unavailable ? 'Donación vencida' : 'Reservar donación'} {!unavailable && <Icon name="arrow" size={16} />}
          </button>
        )}
        {donation.status === 'reserved' && (
          <button className="button button-outline button-full" disabled={disabled} onClick={() => onDeliver(donation)}>
            <Icon name="check" size={16} /> Confirmar entrega
          </button>
        )}
        {donation.status === 'delivered' && <span className="delivered-caption"><Icon name="check" size={15} /> Entrega confirmada</span>}
      </div>
    </article>
  )
}

function MetricCard({ value, label, detail, icon }: { value: string; label: string; detail: string; icon: IconName }) {
  return (
    <article className="metric-card">
      <span className="metric-icon"><Icon name={icon} size={19} /></span>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('inicio')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DonationStatus | ''>('')
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CreateDonation>(emptyDonation)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [comedor, setComedor] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [items, summary] = await Promise.all([api.listDonations(), api.stats()])
      setDonations(items)
      setStats(summary)
      setError('')
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const closeDialog = useCallback(() => {
    if (busy) return
    setDialog(null)
    setDialogError('')
    setComedor('')
  }, [busy])

  useEffect(() => {
    if (!dialog) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialog, closeDialog])

  const sortedDonations = useMemo(() => [...donations].sort((a, b) => {
    const statusOrder: Record<DonationStatus, number> = { available: 0, reserved: 1, delivered: 2 }
    const byStatus = statusOrder[a.status] - statusOrder[b.status]
    if (byStatus !== 0) return byStatus
    return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
  }), [donations])

  const visibleDonations = useMemo(() => sortedDonations.filter((item) => {
    const matchesStatus = !filter || item.status === filter
    const searchText = `${item.food_name} ${item.donor_name} ${item.pickup_address} ${item.notes ?? ''}`.toLocaleLowerCase('es-PE')
    return matchesStatus && searchText.includes(search.trim().toLocaleLowerCase('es-PE'))
  }), [filter, search, sortedDonations])

  const availableDonations = sortedDonations.filter((item) => item.status === 'available')
  const recentDonations = [...donations]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)
  const featuredDonation = availableDonations[0]

  function navigate(nextPage: Page) {
    setPage(nextPage)
    setMobileMenuOpen(false)
    setNotice(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCreateDonation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice(null)
    if (!form.expires_at || new Date(form.expires_at).getTime() <= Date.now()) {
      setError('Elige una fecha y hora de vencimiento futura.')
      return
    }
    setBusy(true)
    try {
      await api.createDonation({
        ...form,
        donor_name: form.donor_name.trim(),
        food_name: form.food_name.trim(),
        pickup_address: form.pickup_address.trim(),
        notes: form.notes?.trim() || '',
        expires_at: new Date(form.expires_at).toISOString(),
      })
      setForm(emptyDonation)
      setFilter('available')
      setSearch('')
      setNotice({ tone: 'success', text: 'La donación se publicó correctamente.' })
      setPage('donaciones')
      await load()
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleDialogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog) return
    setDialogError('')
    if (dialog.kind === 'reserve' && comedor.trim().length < 2) {
      setDialogError('Escribe el nombre del comedor para continuar.')
      return
    }
    setBusy(true)
    try {
      if (dialog.kind === 'reserve') {
        await api.reserve(dialog.donation.id, comedor.trim())
        setNotice({ tone: 'success', text: 'La donación quedó reservada para el comedor.' })
      } else {
        await api.deliver(dialog.donation.id)
        setNotice({ tone: 'success', text: 'La entrega quedó confirmada.' })
      }
      setDialog(null)
      setComedor('')
      await load()
    } catch (cause) {
      setDialogError(friendlyError(cause))
    } finally {
      setBusy(false)
    }
  }

  const donationCount = stats ? formatNumber(stats.available) : '—'
  const deliveredKg = stats ? `${formatNumber(stats.kilograms_delivered)} kg` : '—'
  const servings = stats ? formatNumber(stats.estimated_servings) : '—'

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" aria-label="AlimentaVES, ir al inicio" onClick={() => navigate('inicio')}>
            <span className="brand-mark"><Icon name="leaf" size={21} /></span>
            <span className="brand-name">Alimenta<span>VES</span></span>
          </button>

          <nav className="desktop-nav" aria-label="Navegación principal">
            {(['inicio', 'donaciones', 'impacto'] as const).map((item) => (
              <button key={item} className={page === item ? 'nav-link nav-link-active' : 'nav-link'} aria-current={page === item ? 'page' : undefined} onClick={() => navigate(item)}>
                {item === 'donaciones' ? 'Explorar' : pageLabels[item]}
                {item === 'donaciones' && <span className="nav-count">{stats?.available ?? '—'}</span>}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <span className="demo-indicator"><span /> Demo educativa</span>
            <button className="button button-dark header-cta" onClick={() => navigate('publicar')}>
              Publicar alimento <Icon name="plus" size={16} />
            </button>
            <button className="menu-toggle" aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
              <span /><span />
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label="Navegación móvil">
            {(['inicio', 'donaciones', 'publicar', 'impacto'] as const).map((item) => (
              <button key={item} className={page === item ? 'mobile-nav-link mobile-nav-active' : 'mobile-nav-link'} onClick={() => navigate(item)}>
                {pageLabels[item]} {item === 'donaciones' && <span>{stats?.available ?? '—'} disponibles</span>}
              </button>
            ))}
          </nav>
        )}
      </header>

      {notice && <div className={`notice notice-${notice.tone}`} role="status"><span>{notice.text}</span><button aria-label="Cerrar aviso" onClick={() => setNotice(null)}><Icon name="close" size={16} /></button></div>}
      {error && <div className="global-error" role="alert"><span>{error}</span><button className="button button-outline button-small" onClick={() => void load()} disabled={loading}>{loading ? 'Actualizando…' : 'Reintentar'}</button></div>}

      <main id="main-content">
        {page === 'inicio' && (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <p className="eyebrow"><span className="eyebrow-line" /> RED LOCAL · VILLA EL SALVADOR</p>
                <h1>Un excedente hoy.<br /><em>Un plato más mañana.</em></h1>
                <p className="hero-description">Conectamos alimentos que aún pueden aprovecharse con comedores populares cercanos. Menos desperdicio, más colaboración en nuestra comunidad.</p>
                <div className="hero-actions">
                  <button className="button button-gold" onClick={() => navigate('donaciones')}>Explorar donaciones <Icon name="arrow" size={17} /></button>
                  <button className="button button-light-outline" onClick={() => navigate('publicar')}>Tengo alimentos para compartir</button>
                </div>
                <div className="hero-footnote"><span>ODS 2 · Hambre Cero</span><i /> <span>ODS 12 · Consumo responsable</span></div>
              </div>

              <aside className="hero-board" aria-label="Resumen de donaciones disponibles">
                <div className="board-decoration board-decoration-one" />
                <div className="board-decoration board-decoration-two" />
                <div className="board-topline"><span>ALIMENTAVES / VES</span><span>02 — 12</span></div>
                <div className="board-content">
                  <span className="board-kicker">EN LA RED, AHORA</span>
                  <div className="board-number">{stats?.available ?? '—'}<span>lotes<br />disponibles</span></div>
                  <div className="board-rule" />
                  {featuredDonation ? (
                    <div className="board-feature">
                      <span className="board-feature-label"><span /> DISPONIBLE PARA RESERVA</span>
                      <strong>{featuredDonation.food_name}</strong>
                      <span>{formatNumber(featuredDonation.quantity_kg)} kg · {featuredDonation.donor_name}</span>
                      <button onClick={() => navigate('donaciones')}>Ver en el catálogo <Icon name="arrow" size={15} /></button>
                    </div>
                  ) : (
                    <div className="board-feature board-empty">
                      <strong>{loading ? 'Buscando donaciones…' : 'La próxima oportunidad puede empezar aquí.'}</strong>
                      <button onClick={() => navigate('publicar')}>Publicar una donación <Icon name="arrow" size={15} /></button>
                    </div>
                  )}
                </div>
                <div className="board-bottom"><span>COMUNIDAD · ALIMENTO · FUTURO</span><Icon name="leaf" size={17} /></div>
              </aside>
            </section>

            <section className="metrics-strip" aria-label="Indicadores de la plataforma">
              <MetricCard value={donationCount} label="Donaciones disponibles" detail="Lotes que pueden reservarse" icon="package" />
              <MetricCard value={stats ? formatNumber(stats.delivered) : '—'} label="Entregas confirmadas" detail="Registradas en la plataforma" icon="check" />
              <MetricCard value={deliveredKg} label="Alimentos entregados" detail="Kilogramos confirmados" icon="leaf" />
              <MetricCard value={servings} label="Raciones estimadas" detail="Cálculo referencial del prototipo" icon="clock" />
            </section>

            <section className="content-section recent-section">
              <div className="section-heading">
                <div><p className="eyebrow eyebrow-dark">OPORTUNIDADES CERCANAS</p><h2>Lo que está disponible</h2><p>Donaciones registradas por la red local.</p></div>
                <button className="text-link" onClick={() => navigate('donaciones')}>Ver catálogo completo <Icon name="arrow" size={17} /></button>
              </div>
              {loading && donations.length === 0 ? (
                <div className="empty-state"><span className="loading-mark" /><p>Cargando donaciones de la plataforma…</p></div>
              ) : recentDonations.length === 0 ? (
                <div className="empty-state"><span className="empty-symbol"><Icon name="leaf" size={24} /></span><h3>La red empieza con una donación.</h3><p>Cuando se publique un alimento, aparecerá aquí para que los comedores puedan encontrarlo.</p><button className="button button-outline" onClick={() => navigate('publicar')}>Publicar la primera donación <Icon name="arrow" size={16} /></button></div>
              ) : (
                <div className="donation-grid">
                  {recentDonations.map((item) => <DonationCard key={item.id} donation={item} onReserve={(donation) => { setDialog({ kind: 'reserve', donation }); setDialogError('') }} onDeliver={(donation) => { setDialog({ kind: 'deliver', donation }); setDialogError('') }} disabled={busy} compact />)}
                </div>
              )}
            </section>

            <section className="how-section">
              <div className="content-section how-inner">
                <div className="section-heading section-heading-light"><div><p className="eyebrow">UN FLUJO SENCILLO</p><h2>De excedente a oportunidad</h2></div><p>Una coordinación clara para aprovechar mejor los alimentos locales.</p></div>
                <div className="steps-grid">
                  <article className="step-card"><span>01</span><h3>Publica</h3><p>El donante registra alimento, cantidad, vencimiento y punto de recojo.</p></article>
                  <article className="step-card"><span>02</span><h3>Reserva</h3><p>Un comedor consulta las donaciones disponibles y solicita una reserva.</p></article>
                  <article className="step-card"><span>03</span><h3>Confirma</h3><p>Al completar la entrega, el estado se actualiza y suma al impacto.</p></article>
                </div>
              </div>
            </section>
          </>
        )}

        {page === 'donaciones' && (
          <section className="content-section page-section">
            <div className="page-heading">
              <div><p className="eyebrow eyebrow-dark">CATÁLOGO LOCAL · VES</p><h1>Donaciones de alimentos</h1><p>Explora los lotes registrados y revisa su disponibilidad y vencimiento.</p></div>
              <button className="button button-outline" onClick={() => void load()} disabled={loading}><Icon name="refresh" size={16} className={loading ? 'spin' : ''} /> Actualizar</button>
            </div>
            <div className="catalog-toolbar">
              <label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Buscar donaciones</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alimento, donante o punto de recojo" /></label>
              <div className="filter-group" role="group" aria-label="Filtrar donaciones por estado">
                {statusFilters.map((option) => (
                  <button key={option.value || 'all'} className={filter === option.value ? 'filter-chip filter-chip-active' : 'filter-chip'} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>
                ))}
              </div>
              <p className="result-count">{loading ? 'Actualizando…' : `${visibleDonations.length} ${visibleDonations.length === 1 ? 'resultado' : 'resultados'}`}</p>
            </div>
            {loading && donations.length === 0 ? (
              <div className="empty-state"><span className="loading-mark" /><p>Cargando donaciones…</p></div>
            ) : error && donations.length === 0 ? null : visibleDonations.length === 0 ? (
              <div className="empty-state"><span className="empty-symbol"><Icon name="search" size={22} /></span><h3>{search || filter ? 'No encontramos coincidencias.' : 'Todavía no hay donaciones.'}</h3><p>{search || filter ? 'Prueba con otra búsqueda o cambia el filtro.' : 'Las donaciones se mostrarán aquí cuando se registren.'}</p>{(search || filter) && <button className="button button-outline" onClick={() => { setSearch(''); setFilter('') }}>Limpiar búsqueda</button>}</div>
            ) : (
              <div className="donation-grid catalog-grid">
                {visibleDonations.map((item) => <DonationCard key={item.id} donation={item} onReserve={(donation) => { setDialog({ kind: 'reserve', donation }); setDialogError('') }} onDeliver={(donation) => { setDialog({ kind: 'deliver', donation }); setDialogError('') }} disabled={busy} />)}
              </div>
            )}
          </section>
        )}

        {page === 'publicar' && (
          <section className="content-section page-section publish-section">
            <div className="page-heading">
              <div><p className="eyebrow eyebrow-dark">COMPARTE CON TU COMUNIDAD</p><h1>Publicar una donación</h1><p>Registra un alimento disponible para que los comedores puedan encontrarlo.</p></div>
            </div>
            <div className="publish-layout">
              <form className="form-card" onSubmit={handleCreateDonation}>
                <div className="form-heading"><span className="form-step">NUEVO LOTE</span><h2>Detalles del alimento</h2><p>Completa la información necesaria para coordinar el recojo.</p></div>
                <div className="form-grid">
                  <label>Nombre del donante<input required minLength={2} maxLength={100} placeholder="Ej.: Donante de demostración" value={form.donor_name} onChange={(event) => setForm({ ...form, donor_name: event.target.value })} /></label>
                  <label>Nombre del alimento<input required minLength={2} maxLength={120} placeholder="Ej.: Arroz sellado" value={form.food_name} onChange={(event) => setForm({ ...form, food_name: event.target.value })} /></label>
                  <label>Cantidad en kilogramos<input required type="number" min="0.01" max="10000" step="0.01" value={form.quantity_kg} onChange={(event) => setForm({ ...form, quantity_kg: Number(event.target.value) })} /></label>
                  <label>Fecha y hora de vencimiento<input required type="datetime-local" min={minimumDateTime()} value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></label>
                  <label className="field-wide">Punto de recojo<input required minLength={4} maxLength={200} placeholder="Punto de prueba, Villa El Salvador" value={form.pickup_address} onChange={(event) => setForm({ ...form, pickup_address: event.target.value })} /></label>
                  <label className="field-wide">Indicaciones adicionales <span className="optional-label">Opcional</span><textarea maxLength={500} rows={4} placeholder="Horario de recojo u otra indicación del lote" value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
                </div>
                <div className="form-footer"><p>Para esta demostración, utiliza nombres y puntos de recojo ficticios.</p><button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Publicando…' : 'Publicar donación'} <Icon name="arrow" size={16} /></button></div>
              </form>
              <aside className="publish-aside">
                <p className="eyebrow">ANTES DE PUBLICAR</p><h2>Una buena descripción facilita el encuentro.</h2>
                <div className="publish-tip"><span>01</span><p><strong>Indica el producto con claridad.</strong> Así el comedor puede evaluar si le sirve.</p></div>
                <div className="publish-tip"><span>02</span><p><strong>Revisa el vencimiento.</strong> La fecha debe ser futura y estar actualizada.</p></div>
                <div className="publish-tip"><span>03</span><p><strong>Usa un punto de recojo de prueba.</strong> No incluyas datos personales en esta demo.</p></div>
                <div className="publish-aside-note"><Icon name="leaf" size={18} /><span>AlimentaVES conecta excedentes con comedores populares de Villa El Salvador.</span></div>
              </aside>
            </div>
          </section>
        )}

        {page === 'impacto' && (
          <section className="content-section page-section impact-section">
            <div className="impact-banner">
              <div><p className="eyebrow">RESULTADOS DE LA DEMOSTRACIÓN</p><h1>El impacto se construye en comunidad.</h1><p>Indicadores calculados con las donaciones y entregas registradas en AlimentaVES.</p></div>
              <span className="impact-mark"><span>ODS</span><strong>02</strong><i /> <strong>12</strong></span>
            </div>
            <div className="impact-metrics">
              <MetricCard value={stats ? formatNumber(stats.available) : '—'} label="Lotes disponibles" detail="Alimentos que pueden reservarse" icon="package" />
              <MetricCard value={stats ? formatNumber(stats.delivered) : '—'} label="Entregas confirmadas" detail="Donaciones marcadas como entregadas" icon="check" />
              <MetricCard value={deliveredKg} label="Kilogramos entregados" detail="Cantidad registrada en las entregas" icon="leaf" />
              <MetricCard value={servings} label="Raciones estimadas" detail="Estimación del backend" icon="clock" />
            </div>
            <div className="impact-disclaimer"><strong>Sobre la estimación</strong><p>Las raciones se estiman a partir de los kilogramos entregados (0.35 kg por ración). Es una referencia del prototipo, no un conteo de personas beneficiadas.</p></div>
            <div className="ods-grid">
              <article className="ods-card"><span className="ods-number ods-two">02</span><div><p className="eyebrow eyebrow-dark">OBJETIVO DE DESARROLLO SOSTENIBLE</p><h2>Hambre Cero</h2><p>Facilitar el encuentro entre alimentos aprovechables y comedores populares de la zona.</p></div></article>
              <article className="ods-card"><span className="ods-number ods-twelve">12</span><div><p className="eyebrow eyebrow-dark">OBJETIVO DE DESARROLLO SOSTENIBLE</p><h2>Producción y consumo responsables</h2><p>Dar mejor uso a excedentes alimentarios y reducir su desperdicio en la comunidad.</p></div></article>
            </div>
            <section className="activity-section"><div className="section-heading"><div><p className="eyebrow eyebrow-dark">ACTUALIZADO DESDE LA API</p><h2>Actividad reciente</h2></div></div>
              {recentDonations.length === 0 ? <p className="activity-empty">{loading ? 'Cargando actividad…' : 'Todavía no hay actividad registrada.'}</p> : <div className="activity-list">{recentDonations.map((item) => <article className="activity-row" key={item.id}><span className={`activity-symbol activity-${item.status}`}><Icon name={item.status === 'delivered' ? 'check' : item.status === 'reserved' ? 'clock' : 'leaf'} size={16} /></span><div className="activity-copy"><strong>{item.food_name}</strong><span>{item.donor_name} · {formatNumber(item.quantity_kg)} kg</span></div><StatusBadge status={item.status} /><time>{formatDate(item.created_at)}</time></article>)}</div>}
            </section>
          </section>
        )}
      </main>

      <footer className="site-footer"><div className="footer-inner"><button className="brand brand-footer" onClick={() => navigate('inicio')}><span className="brand-mark"><Icon name="leaf" size={19} /></span><span className="brand-name">Alimenta<span>VES</span></span></button><p>Una red local para aprovechar mejor los alimentos en Villa El Salvador.</p><span className="footer-ods">ODS 2 · ODS 12</span></div><div className="footer-bottom"><span>Prototipo educativo · Datos de demostración</span><span>HackODS UA 2026</span></div></footer>

      {dialog && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}>
          <form className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={handleDialogSubmit}>
            <button type="button" className="dialog-close" aria-label="Cerrar ventana" onClick={closeDialog} disabled={busy}><Icon name="close" size={19} /></button>
            <span className="dialog-kicker">{dialog.kind === 'reserve' ? 'RESERVA DE ALIMENTO' : 'CONFIRMACIÓN DE ENTREGA'}</span>
            <h2 id="dialog-title">{dialog.kind === 'reserve' ? 'Reservar esta donación' : '¿Confirmar que se entregó?'}</h2>
            <p className="dialog-food">{dialog.donation.food_name} · {formatNumber(dialog.donation.quantity_kg)} kg</p>
            {dialog.kind === 'reserve' ? (
              <label>Nombre del comedor<input autoFocus required minLength={2} maxLength={100} placeholder="Ej.: Comedor de demostración" value={comedor} onChange={(event) => setComedor(event.target.value)} /></label>
            ) : <p className="dialog-description">Al confirmar, el estado pasará a “Entregada” y se actualizarán los indicadores del prototipo.</p>}
            {dialogError && <p className="dialog-error" role="alert">{dialogError}</p>}
            <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={closeDialog} disabled={busy}>Cancelar</button><button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Procesando…' : dialog.kind === 'reserve' ? 'Confirmar reserva' : 'Confirmar entrega'} <Icon name="arrow" size={16} /></button></div>
          </form>
        </div>
      )}
    </div>
  )
}

function minimumDateTime(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}
