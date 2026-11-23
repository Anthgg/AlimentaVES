import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from './lib/api'
import type { CreateDonation, Donation, DonationStatus, Stats } from './types'

const initial: CreateDonation = {
  donor_name: '',
  food_name: '',
  quantity_kg: 1,
  pickup_address: '',
  expires_at: '',
  notes: '',
}

const statusLabels: Record<DonationStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservada',
  delivered: 'Entregada',
}

export default function App() {
  const [page, setPage] = useState<'inicio' | 'donaciones' | 'publicar' | 'impacto'>('inicio')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [reservation, setReservation] = useState<Donation | null>(null)
  const [comedor, setComedor] = useState('')
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState<DonationStatus | ''>('')
  const [form, setForm] = useState<CreateDonation>(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [items, summary] = await Promise.all([
        api.listDonations(filter || undefined),
        api.stats(),
      ])
      setDonations(items)
      setStats(summary)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar a la API')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.expires_at || new Date(form.expires_at).getTime() <= Date.now()) {
      setError('Selecciona una fecha de vencimiento futura')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await api.createDonation({ ...form, expires_at: new Date(form.expires_at).toISOString() })
      setForm(initial)
      setPage('donaciones')
      setMessage('Donación registrada correctamente')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error registrando donación')
    } finally {
      setBusy(false)
    }
  }

  const update = async (action: () => Promise<Donation>) => {
    setBusy(true)
    setMessage('')
    try {
      await action()
      setMessage('Estado actualizado')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="layout">
      <header className="header">
        <div className="brand">Alimenta<span>VES</span></div>
        <nav aria-label="Navegación principal">{(['inicio', 'donaciones', 'publicar', 'impacto'] as const).map(p => <button key={p} className={page === p ? 'nav active' : 'nav'} onClick={() => setPage(p)} aria-current={page === p ? 'page' : undefined}>{({ inicio:'Inicio', donaciones:'Donaciones', publicar:'Publicar donación', impacto:'Impacto social' })[p]}</button>)}</nav>
        <div className="tag">HackODS UA 2026 · ODS 2 y 12</div>
      </header>
      {page === 'inicio' && <section className="hero">
        <p className="eyebrow">Conectando solidaridad en Villa El Salvador</p>
        <h1>Rescatemos alimentos. Compartamos oportunidades.</h1>
        <p>Prototipo de conexión entre donantes y comedores populares. Registros de muestra ficticios.</p>
        <div className="actions"><button onClick={() => setPage('publicar')}>Quiero donar →</button><button className="secondary" onClick={() => {setFilter('available'); setPage('donaciones')}}>Buscar alimentos</button></div>
      </section>}
      {(page === 'inicio' || page === 'impacto') && <><h2>Impacto en nuestra comunidad</h2><section className="stats" aria-label="Estadísticas de la demostración">
        <article><strong>{stats?.available ?? '...'}</strong><span>Disponibles</span></article>
        <article><strong>{stats?.reserved ?? '...'}</strong><span>Reservadas</span></article>
        <article><strong>{stats?.delivered ?? '...'}</strong><span>Entregadas</span></article>
        <article><strong>{stats?.kilograms_delivered ?? '...'} kg</strong><span>Alimentos entregados (demo)</span></article>
      </section><div className="impact"><strong>{stats?.estimated_servings ?? '—'}</strong> raciones estimadas · 0.35 kg por ración</div></>}
      {error && <div className="alert error" role="alert">{error === 'Failed to fetch' ? 'No se pudo conectar con la API. Verifica que el backend esté iniciado.' : error} <button onClick={() => void load()}>Reintentar</button></div>}
      {message && <div className="alert success" role="status">{message}</div>}
      {page === 'inicio' && <section className="steps"><h2>¿Cómo funciona?</h2><div className="step-grid"><article><b>01</b><h3>Publica</h3><p>Registra los alimentos que puedes compartir.</p></article><article><b>02</b><h3>Conecta</h3><p>Los comedores reservan alimentos disponibles.</p></article><article><b>03</b><h3>Comparte</h3><p>Confirma la entrega y registra el impacto.</p></article></div></section>}
      <section className="columns">
        {page === 'donaciones' && <div className="panel">
          <div className="panelHeader">
            <h2>Donaciones</h2>
            <select aria-label="Filtrar por estado" value={filter} onChange={e => setFilter(e.target.value as DonationStatus | '')}>
              <option value="">Todas</option>
              <option value="available">Disponibles</option>
              <option value="reserved">Reservadas</option>
              <option value="delivered">Entregadas</option>
            </select>
          </div>
          <input className="search" aria-label="Buscar donaciones" placeholder="Buscar alimentos o donantes…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="donations">
            {loading && <p role="status">Cargando donaciones…</p>}
            {!loading && !error && donations.length === 0 && <p className="muted">Sin registros. Publica una donación para comenzar.</p>}
            {donations.filter(item => (item.food_name + ' ' + item.donor_name + ' ' + item.pickup_address).toLowerCase().includes(search.toLowerCase())).map(item => (
              <article className="donation" key={item.id}>
                <div className="donationTop">
                  <h3>{item.food_name}</h3>
                  <span className={'pill ' + item.status}>{statusLabels[item.status]}</span>
                </div>
                <p><b>{item.quantity_kg} kg</b> · {item.donor_name}</p>
                <p className="muted">{item.pickup_address}</p>
                <p className="muted">Vence: {new Date(item.expires_at).toLocaleDateString('es-PE')}</p>
                {item.reserved_by && <p className="muted">Comedor: {item.reserved_by}</p>}
                {item.status === 'available' && (
                  <button disabled={busy || new Date(item.expires_at).getTime() <= Date.now()} onClick={() => {setReservation(item);setComedor('')}}>Reservar</button>
                )}
                {item.status === 'reserved' && (
                  <button disabled={busy} onClick={() => void update(() => api.deliver(item.id))}>Confirmar entrega</button>
                )}
              </article>
            ))}
          </div>
        </div>}
        {page === 'publicar' && <div className="panel">
          <h2>Publicar alimento</h2>
          <p className="muted">Utiliza datos inventados. No ingreses teléfonos ni direcciones privadas.</p>
          <form onSubmit={submit}>
            <label>Donante ficticio<input required minLength={2} maxLength={100} placeholder="Ej.: Donante de prueba" value={form.donor_name} onChange={e => setForm({ ...form, donor_name: e.target.value })} /></label>
            <label>Alimento<input required minLength={2} maxLength={120} placeholder="Ej.: Arroz sellado" value={form.food_name} onChange={e => setForm({ ...form, food_name: e.target.value })} /></label>
            <label>Kilogramos<input required type="number" min="0.01" max="10000" step="0.01" value={form.quantity_kg} onChange={e => setForm({ ...form, quantity_kg: Number(e.target.value) })} /></label>
            <label>Punto de entrega ficticio<input required minLength={4} maxLength={200} placeholder="Ej.: Punto de prueba, VES" value={form.pickup_address} onChange={e => setForm({ ...form, pickup_address: e.target.value })} /></label>
            <label>Vencimiento<input required type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} /></label>
            <label>Notas<textarea maxLength={500} rows={2} value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Procesando...' : 'Publicar donación'}</button>
          </form>
        </div>}
      </section>
      {reservation && <section className="overlay"><form className="dialog panel" role="dialog" aria-modal="true" aria-label="Reservar donación" onSubmit={async e => {e.preventDefault(); if (comedor.trim().length < 2) return; await update(async () => {const result = await api.reserve(reservation.id, comedor.trim());setReservation(null);return result})}}><h2>Reservar {reservation.food_name}</h2><label>Nombre ficticio del comedor<input autoFocus required minLength={2} maxLength={100} value={comedor} onChange={e => setComedor(e.target.value)}/></label>{error && <p role="alert">{error}</p>}<button disabled={busy} type="submit">Confirmar reserva</button><button type="button" disabled={busy} className="secondary" onClick={() => setReservation(null)}>Cancelar</button></form></section>}
      <footer>Demo educativa · No representa un servicio activo de distribución ni una evaluación sanitaria. Raciones estimadas: 0.35 kg/ración.</footer>
    </main>
  )
}
