import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiStatus, type ApiStatusValue } from './components/ApiStatus'
import { CommunityKitchensPage } from './components/CommunityKitchensPage'
import { DialogFrame } from './components/DialogFrame'
import { DonationCard } from './components/DonationCard'
import { DonationDetailsDialog } from './components/DonationDetailsDialog'
import { Icon } from './components/Icon'
import { MetricCard } from './components/MetricCard'
import { StatusBadge } from './components/StatusBadge'
import { api, ApiError } from './lib/api'
import { friendlyError } from './lib/errors'
import type { CreateDonation, Donation, DonationStatus, Stats } from './types'
import { expiryDetails, formatDate, formatNumber, minimumDateTime } from './utils/format'

type Page = 'inicio' | 'donaciones' | 'comedores' | 'publicar' | 'impacto'
type ActionDialog = { kind: 'reserve' | 'deliver'; donation: Donation } | null
type Notice = { tone: 'success' | 'error'; text: string }

const pageLabels: Record<Page, string> = {
  inicio: 'Inicio',
  donaciones: 'Donaciones',
  comedores: 'Comedores',
  publicar: 'Publicar donación',
  impacto: 'Impacto',
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

export default function App() {
  const [page, setPage] = useState<Page>('inicio')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DonationStatus | ''>('')
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatusValue>('checking')
  const [loadErrors, setLoadErrors] = useState({ donations: '', stats: '' })
  const [form, setForm] = useState<CreateDonation>(emptyDonation)
  const [formError, setFormError] = useState('')
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null)
  const [detailDonation, setDetailDonation] = useState<Donation | null>(null)
  const [comedor, setComedor] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [error, setError] = useState('')

  const checkHealth = useCallback(async () => {
    setApiStatus('checking')
    try {
      const response = await api.health()
      setApiStatus(response.status.toLowerCase() === 'ok' ? 'online' : 'offline')
    } catch {
      setApiStatus('offline')
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [donationResult, statsResult] = await Promise.allSettled([api.listDonations(), api.stats()])
    const nextErrors = {
      donations: donationResult.status === 'rejected' ? friendlyError(donationResult.reason) : '',
      stats: statsResult.status === 'rejected' ? friendlyError(statsResult.reason) : '',
    }
    if (donationResult.status === 'fulfilled') setDonations(donationResult.value)
    if (statsResult.status === 'fulfilled') setStats(statsResult.value)
    setLoadErrors(nextErrors)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    void checkHealth()
    const interval = window.setInterval(() => void checkHealth(), 30_000)
    return () => window.clearInterval(interval)
  }, [checkHealth, load])

  const closeActionDialog = useCallback(() => {
    if (busy) return
    setActionDialog(null)
    setDialogError('')
    setComedor('')
  }, [busy])

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

  const recentDonations = useMemo(() => [...donations]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3), [donations])

  const featuredDonation = sortedDonations.find((item) => item.status === 'available' && expiryDetails(item.expires_at).tone !== 'expired')

  function navigate(nextPage: Page) {
    setPage(nextPage)
    setMobileMenuOpen(false)
    setNotice(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openReserve(donation: Donation) {
    setDetailDonation(null)
    setComedor('')
    setDialogError('')
    setActionDialog({ kind: 'reserve', donation })
  }

  function openDeliver(donation: Donation) {
    setDetailDonation(null)
    setDialogError('')
    setActionDialog({ kind: 'deliver', donation })
  }

  function handleDetailsReserve(donation: Donation) {
    openReserve(donation)
  }

  function handleDetailsDeliver(donation: Donation) {
    openDeliver(donation)
  }

  async function handleCreateDonation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setFormError('')
    setNotice(null)

    const donorName = form.donor_name.trim()
    const foodName = form.food_name.trim()
    const pickupAddress = form.pickup_address.trim()
    const quantity = Number(form.quantity_kg)
    const expiry = new Date(form.expires_at).getTime()

    if (donorName.length < 2 || foodName.length < 2 || pickupAddress.length < 4) {
      setFormError('Completa el nombre del donante, el alimento y el punto de recojo con información válida.')
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError('La cantidad debe ser un número mayor que cero.')
      return
    }
    if (!form.expires_at || !Number.isFinite(expiry) || expiry <= Date.now()) {
      setFormError('Elige una fecha y hora de vencimiento futura.')
      return
    }

    setBusy(true)
    try {
      await api.createDonation({
        donor_name: donorName,
        food_name: foodName,
        quantity_kg: quantity,
        pickup_address: pickupAddress,
        expires_at: new Date(form.expires_at).toISOString(),
        notes: form.notes?.trim() || '',
      })
      setForm(emptyDonation)
      setFilter('available')
      setSearch('')
      setPage('donaciones')
      setNotice({ tone: 'success', text: 'La donación se publicó correctamente.' })
      await load()
    } catch (cause) {
      setFormError(friendlyError(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleActionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!actionDialog || busy) return
    setDialogError('')

    const comedorName = comedor.trim()
    if (actionDialog.kind === 'reserve' && comedorName.length < 2) {
      setDialogError('Escribe el nombre del comedor para continuar.')
      return
    }

    setBusy(true)
    try {
      if (actionDialog.kind === 'reserve') {
        await api.reserve(actionDialog.donation.id, comedorName)
        setNotice({ tone: 'success', text: 'La donación quedó reservada para el comedor.' })
      } else {
        await api.deliver(actionDialog.donation.id)
        setNotice({ tone: 'success', text: 'La entrega quedó confirmada.' })
      }
      setActionDialog(null)
      setComedor('')
      await load()
    } catch (cause) {
      setDialogError(friendlyError(cause))
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 409)) void load()
    } finally {
      setBusy(false)
    }
  }

  const metrics = [
    { value: stats ? formatNumber(stats.available) : '—', label: 'Disponibles', detail: 'Donaciones que pueden reservarse', icon: 'package' as const },
    { value: stats ? formatNumber(stats.reserved) : '—', label: 'Reservadas', detail: 'Lotes apartados por comedores', icon: 'clock' as const },
    { value: stats ? formatNumber(stats.delivered) : '—', label: 'Entregadas', detail: 'Entregas confirmadas en la API', icon: 'check' as const },
    { value: stats ? `${formatNumber(stats.kilograms_delivered)} kg` : '—', label: 'Alimentos entregados', detail: 'Kilogramos registrados', icon: 'leaf' as const },
    { value: stats ? formatNumber(stats.estimated_servings) : '—', label: 'Raciones estimadas', detail: 'Estimación referencial del prototipo', icon: 'package' as const },
  ]

  function renderDonationCard(donation: Donation, compact = false) {
    return (
      <DonationCard
        key={donation.id}
        donation={donation}
        onReserve={openReserve}
        onDeliver={openDeliver}
        onDetails={setDetailDonation}
        disabled={busy}
        compact={compact}
      />
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" aria-label="AlimentaVES, ir al inicio" onClick={() => navigate('inicio')}>
            <span className="brand-mark"><Icon name="leaf" size={21} /></span>
            <span className="brand-name">Alimenta<span>VES</span></span>
          </button>

          <nav className="desktop-nav" aria-label="Navegación principal">
            {(['inicio', 'donaciones', 'comedores', 'impacto'] as const).map((item) => (
              <button key={item} className={page === item ? 'nav-link nav-link-active' : 'nav-link'} aria-current={page === item ? 'page' : undefined} onClick={() => navigate(item)}>
                {item === 'donaciones' ? 'Explorar' : pageLabels[item]}
                {item === 'donaciones' && <span className="nav-count">{stats?.available ?? '—'}</span>}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <ApiStatus status={apiStatus} onRetry={() => void checkHealth()} />
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
            {(['inicio', 'donaciones', 'comedores', 'publicar', 'impacto'] as const).map((item) => (
              <button key={item} className={page === item ? 'mobile-nav-link mobile-nav-active' : 'mobile-nav-link'} onClick={() => navigate(item)}>
                {pageLabels[item]} {item === 'donaciones' && <span>{stats?.available ?? '—'} disponibles</span>}
              </button>
            ))}
          </nav>
        )}
      </header>

      {notice && <div className={`notice notice-${notice.tone}`} role="status"><span>{notice.text}</span><button aria-label="Cerrar aviso" onClick={() => setNotice(null)}><Icon name="close" size={16} /></button></div>}
      {(loadErrors.donations || loadErrors.stats) && <div className="global-error" role="alert"><span>{[loadErrors.donations && `Donaciones: ${loadErrors.donations}`, loadErrors.stats && `Estadísticas: ${loadErrors.stats}`].filter(Boolean).join(' ')}</span><button className="button button-outline button-small" onClick={() => void load()} disabled={loading}>{loading ? 'Actualizando…' : 'Reintentar'}</button></div>}

      <main id="main-content" tabIndex={-1}>
        {page === 'inicio' && (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <p className="eyebrow"><span className="eyebrow-line" /> UNA RED LOCAL · VILLA EL SALVADOR</p>
                <h1>Que nada bueno<br /><em>se quede sin mesa.</em></h1>
                <p className="hero-description">AlimentaVES acerca alimentos aprovechables a los comedores populares de la comunidad. Una coordinación sencilla para compartir mejor lo que ya tenemos.</p>
                <div className="hero-actions">
                  <button className="button button-gold" onClick={() => navigate('donaciones')}>Explorar alimentos <Icon name="arrow" size={17} /></button>
                  <button className="button button-light-outline" onClick={() => navigate('publicar')}>Compartir una donación</button>
                </div>
                <div className="hero-footnote"><span>ODS 2 · Hambre Cero</span><i /> <span>ODS 12 · Consumo responsable</span></div>
              </div>

              <aside className="hero-visual" aria-label="AlimentaVES conecta alimentos y comunidad">
                <div className="hero-art" aria-hidden="true">
                  <span className="hero-art-index">ALIMENTAVES / 01</span>
                  <div className="hero-art-orbit hero-art-orbit-one" />
                  <div className="hero-art-orbit hero-art-orbit-two" />
                  <div className="hero-art-sun" />
                  <div className="hero-art-bowl"><span /><i /><b /></div>
                  <div className="hero-art-leaf hero-art-leaf-one" />
                  <div className="hero-art-leaf hero-art-leaf-two" />
                  <span className="hero-art-caption">COMPARTIR<br />ALIMENTA</span>
                  <span className="hero-art-foot">VILLA EL SALVADOR · PERÚ</span>
                </div>
                <div className="hero-board">
                  <div className="board-topline"><span>EN LA RED, AHORA</span><span>DISPONIBLES</span></div>
                  <div className="board-content">
                    <div className="board-number">{stats ? formatNumber(stats.available) : '—'}<span>lotes<br />para encontrar</span></div>
                    <div className="board-rule" />
                    {featuredDonation ? (
                      <div className="board-feature">
                        <span className="board-feature-label"><span /> LOTE DISPONIBLE</span>
                        <strong>{featuredDonation.food_name}</strong>
                        <span>{formatNumber(featuredDonation.quantity_kg)} kg · {featuredDonation.donor_name}</span>
                        <button onClick={() => navigate('donaciones')}>Ver donación <Icon name="arrow" size={15} /></button>
                      </div>
                    ) : (
                      <div className="board-feature board-empty">
                        <strong>{loading ? 'Buscando alimentos en la red…' : 'La próxima oportunidad puede empezar aquí.'}</strong>
                        <button onClick={() => navigate('publicar')}>Publicar un lote <Icon name="arrow" size={15} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </section>
            <section className="metrics-strip" aria-label="Indicadores de la plataforma">
              {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
            </section>

            <section className="mission-section content-section" aria-labelledby="mission-heading">
              <div className="mission-visual" aria-hidden="true">
                <span className="mission-visual-index">ALIMENTAVES · VES</span>
                <div className="still-life-table">
                  <div className="still-life-plate">
                    <span className="produce produce-tomato" />
                    <span className="produce produce-leaf" />
                    <span className="produce produce-grain" />
                    <span className="produce produce-citrus" />
                    <span className="plate-mark">Compartir<br />alimenta</span>
                  </div>
                  <div className="still-life-crate"><Icon name="package" size={26} /></div>
                  <span className="still-life-sprig"><Icon name="leaf" size={42} /></span>
                </div>
                <div className="mission-visual-caption"><span>RED LOCAL</span><strong>EXCEDENTE → COMUNIDAD</strong></div>
              </div>
              <div className="mission-copy">
                <p className="eyebrow eyebrow-dark">EL RETO QUE NOS CONVOCA</p>
                <h2 id="mission-heading">Alimentos aprovechables y comedores que los necesitan.</h2>
                <p>En una misma comunidad pueden coexistir excedentes de alimentos y organizaciones que buscan abastecer sus mesas. AlimentaVES ayuda a que ese encuentro sea más claro y coordinado.</p>
                <div className="mission-principles">
                  <div><span>01</span><p><strong>Publicar con claridad.</strong> Cada lote reúne producto, cantidad, vencimiento y punto de recojo.</p></div>
                  <div><span>02</span><p><strong>Coordinar en comunidad.</strong> Los comedores pueden encontrar y reservar lo que está disponible.</p></div>
                </div>
                <button className="text-link" onClick={() => navigate('donaciones')}>Conocer las donaciones <Icon name="arrow" size={17} /></button>
              </div>
            </section>

            <section className="content-section recent-section">
              <div className="section-heading">
                <div><p className="eyebrow eyebrow-dark">ACTIVIDAD DE LA RED</p><h2>Donaciones recientes</h2><p>Consulta cada lote y su estado actual.</p></div>
                <button className="text-link" onClick={() => navigate('donaciones')}>Ver catálogo completo <Icon name="arrow" size={17} /></button>
              </div>
              {loading && donations.length === 0 ? (
                <div className="empty-state"><span className="loading-mark" /><p>Cargando donaciones de la plataforma…</p></div>
              ) : loadErrors.donations && donations.length === 0 ? (
                <div className="empty-state"><span className="empty-symbol"><Icon name="refresh" size={22} /></span><h3>No pudimos cargar las donaciones.</h3><p>Revisa la conexión con el backend y vuelve a intentarlo.</p><button className="button button-outline" onClick={() => void load()}>Reintentar</button></div>
              ) : recentDonations.length === 0 ? (
                <div className="empty-state"><span className="empty-symbol"><Icon name="leaf" size={24} /></span><h3>La red empieza con una donación.</h3><p>Cuando se publique un alimento, aparecerá aquí para que los comedores puedan encontrarlo.</p><button className="button button-outline" onClick={() => navigate('publicar')}>Publicar la primera donación <Icon name="arrow" size={16} /></button></div>
              ) : (
                <div className="donation-grid">{recentDonations.map((item) => renderDonationCard(item, true))}</div>
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

            <section className="purpose-section content-section" aria-labelledby="purpose-heading">
              <div className="purpose-heading">
                <div><p className="eyebrow eyebrow-dark">PROPÓSITO COMPARTIDO</p><h2 id="purpose-heading">Una red local con sentido.</h2><p>El proyecto conecta acciones cotidianas con dos objetivos de desarrollo sostenible.</p></div>
                <button className="text-link" onClick={() => navigate('impacto')}>Ver el panel de impacto <Icon name="arrow" size={17} /></button>
              </div>
              <div className="purpose-list">
                <article className="purpose-item">
                  <span className="purpose-number purpose-number-hunger">02</span>
                  <div><p>ODS 02</p><h3>Hambre Cero</h3><span>Acercar donaciones disponibles a comedores populares de Villa El Salvador.</span></div>
                  <span className="purpose-index">01</span>
                </article>
                <article className="purpose-item">
                  <span className="purpose-number purpose-number-consumption">12</span>
                  <div><p>ODS 12</p><h3>Producción y consumo responsables</h3><span>Dar mejor uso a alimentos aptos y reducir su desperdicio.</span></div>
                  <span className="purpose-index">02</span>
                </article>
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
              <p className="result-count" aria-live="polite">{loading ? 'Actualizando…' : `${visibleDonations.length} ${visibleDonations.length === 1 ? 'resultado' : 'resultados'}`}</p>
            </div>
            {loading && donations.length === 0 ? (
              <div className="empty-state"><span className="loading-mark" /><p>Cargando donaciones…</p></div>
            ) : loadErrors.donations && donations.length === 0 ? (
              <div className="empty-state"><span className="empty-symbol"><Icon name="refresh" size={22} /></span><h3>No se pudo consultar el catálogo.</h3><p>Comprueba que la API esté disponible.</p><button className="button button-outline" onClick={() => void load()}>Reintentar</button></div>
            ) : visibleDonations.length === 0 ? (
              <div className="empty-state"><span className="empty-symbol"><Icon name="search" size={22} /></span><h3>{search || filter ? 'No encontramos coincidencias.' : 'Todavía no hay donaciones.'}</h3><p>{search || filter ? 'Prueba con otra búsqueda o cambia el filtro.' : 'Las donaciones se mostrarán aquí cuando se registren.'}</p>{(search || filter) && <button className="button button-outline" onClick={() => { setSearch(''); setFilter('') }}>Limpiar búsqueda</button>}</div>
            ) : (
              <div className="donation-grid catalog-grid">{visibleDonations.map((item) => renderDonationCard(item))}</div>
            )}
          </section>
        )}

        {page === 'publicar' && (
          <section className="content-section page-section publish-section">
            <div className="page-heading">
              <div><p className="eyebrow eyebrow-dark">COMPARTE CON TU COMUNIDAD</p><h1>Publicar una donación</h1><p>Registra un alimento disponible para que los comedores puedan encontrarlo.</p></div>
            </div>
            <div className="publish-layout">
              <form className="form-card" onSubmit={handleCreateDonation} noValidate>
                <div className="form-heading"><span className="form-step">NUEVO LOTE</span><h2>Detalles del alimento</h2><p>Completa la información necesaria para coordinar el recojo.</p></div>
                <div className="form-grid">
                  <label>Nombre del donante<input required minLength={2} maxLength={100} placeholder="Ej.: Donante de demostración" value={form.donor_name} onChange={(event) => setForm({ ...form, donor_name: event.target.value })} /></label>
                  <label>Nombre del alimento<input required minLength={2} maxLength={120} placeholder="Ej.: Arroz sellado" value={form.food_name} onChange={(event) => setForm({ ...form, food_name: event.target.value })} /></label>
                  <label>Cantidad en kilogramos<input required type="number" min="0.01" step="0.01" value={form.quantity_kg} onChange={(event) => setForm({ ...form, quantity_kg: Number(event.target.value) })} /></label>
                  <label>Fecha y hora de vencimiento<input required type="datetime-local" min={minimumDateTime()} value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></label>
                  <label className="field-wide">Punto de recojo<input required minLength={4} maxLength={200} placeholder="Punto de prueba, Villa El Salvador" value={form.pickup_address} onChange={(event) => setForm({ ...form, pickup_address: event.target.value })} /></label>
                  <label className="field-wide">Indicaciones adicionales <span className="optional-label">Opcional</span><textarea maxLength={500} rows={4} placeholder="Horario de recojo u otra indicación del lote" value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
                </div>
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <div className="form-footer"><p>Para esta demostración, utiliza nombres y puntos de recojo ficticios. No incluyas teléfonos ni domicilios reales.</p><button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Publicando…' : 'Publicar donación'} <Icon name="arrow" size={16} /></button></div>
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
              <div><p className="eyebrow">RESULTADOS REGISTRADOS</p><h1>El impacto se construye en comunidad.</h1><p>Indicadores calculados con las donaciones y entregas registradas en AlimentaVES.</p></div>
              <span className="impact-mark"><span>ODS</span><strong>02</strong><i /> <strong>12</strong></span>
            </div>
            <div className="impact-metrics">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
            <div className="impact-disclaimer"><strong>Sobre la estimación</strong><p>Las raciones se calculan a partir de los kilogramos entregados (0,35 kg por ración). Es una referencia del prototipo, no un conteo de personas beneficiadas.</p></div>
            <div className="ods-grid">
              <article className="ods-card"><span className="ods-number ods-two">02</span><div><p className="eyebrow eyebrow-dark">OBJETIVO DE DESARROLLO SOSTENIBLE</p><h2>Hambre Cero</h2><p>Facilitar el encuentro entre alimentos aprovechables y comedores populares de la zona.</p></div></article>
              <article className="ods-card"><span className="ods-number ods-twelve">12</span><div><p className="eyebrow eyebrow-dark">OBJETIVO DE DESARROLLO SOSTENIBLE</p><h2>Producción y consumo responsables</h2><p>Dar mejor uso a excedentes alimentarios y reducir su desperdicio en la comunidad.</p></div></article>
            </div>
            <section className="activity-section"><div className="section-heading"><div><p className="eyebrow eyebrow-dark">ACTUALIZADO DESDE LA API</p><h2>Actividad reciente</h2></div></div>
              {recentDonations.length === 0 ? <p className="activity-empty">{loading ? 'Cargando actividad…' : loadErrors.donations ? 'No se pudo cargar la actividad.' : 'Todavía no hay actividad registrada.'}</p> : <div className="activity-list">{recentDonations.map((item) => <article className="activity-row" key={item.id}><span className={`activity-symbol activity-${item.status}`}><Icon name={item.status === 'delivered' ? 'check' : item.status === 'reserved' ? 'clock' : 'leaf'} size={16} /></span><div className="activity-copy"><strong>{item.food_name}</strong><span>{item.donor_name} · {formatNumber(item.quantity_kg)} kg</span></div><StatusBadge status={item.status} /><time>{formatDate(item.created_at)}</time></article>)}</div>}
            </section>
          </section>
        )}

        {page === 'comedores' && <CommunityKitchensPage />}
      </main>

      <footer className="site-footer"><div className="footer-inner"><button className="brand brand-footer" onClick={() => navigate('inicio')}><span className="brand-mark"><Icon name="leaf" size={19} /></span><span className="brand-name">Alimenta<span>VES</span></span></button><p>Una red local para aprovechar mejor los alimentos en Villa El Salvador.</p><span className="footer-ods">ODS 2 · ODS 12</span></div><div className="footer-bottom"><span>Prototipo educativo · Datos de demostración</span><span>HackODS UA 2026</span></div></footer>

      {actionDialog && (
        <DialogFrame labelledBy="action-dialog-title" describedBy="action-dialog-description" onClose={closeActionDialog}>
          <button type="button" className="dialog-close" aria-label="Cerrar ventana" onClick={closeActionDialog} disabled={busy}><Icon name="close" size={19} /></button>
          <form onSubmit={handleActionSubmit}>
            <span className="dialog-kicker">{actionDialog.kind === 'reserve' ? 'RESERVA DE ALIMENTO' : 'CONFIRMACIÓN DE ENTREGA'}</span>
            <h2 id="action-dialog-title">{actionDialog.kind === 'reserve' ? 'Reservar esta donación' : '¿Confirmar que se entregó?'}</h2>
            <p id="action-dialog-description" className="dialog-food">{actionDialog.donation.food_name} · {formatNumber(actionDialog.donation.quantity_kg)} kg</p>
            {actionDialog.kind === 'reserve' ? (
              <label>Nombre del comedor<input data-dialog-initial-focus required minLength={2} maxLength={100} placeholder="Ej.: Comedor de demostración" value={comedor} onChange={(event) => setComedor(event.target.value)} /></label>
            ) : <p className="dialog-description">Al confirmar, el estado pasará a “Entregada” y se actualizarán los indicadores del prototipo.</p>}
            {dialogError && <p className="dialog-error" role="alert">{dialogError}</p>}
            <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={closeActionDialog} disabled={busy}>Cancelar</button><button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Procesando…' : actionDialog.kind === 'reserve' ? 'Confirmar reserva' : 'Confirmar entrega'} <Icon name="arrow" size={16} /></button></div>
          </form>
        </DialogFrame>
      )}

      {detailDonation && <DonationDetailsDialog key={detailDonation.id} initialDonation={detailDonation} busy={busy} onClose={() => setDetailDonation(null)} onReserve={handleDetailsReserve} onDeliver={handleDetailsDeliver} />}
    </div>
  )
}
