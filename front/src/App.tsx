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
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState<DonationStatus | ''>('')
  const [form, setForm] = useState<CreateDonation>(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
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
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.expires_at) {
      setError('Selecciona una fecha de vencimiento')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await api.createDonation({ ...form, expires_at: new Date(form.expires_at).toISOString() })
      setForm(initial)
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
        <div className="tag">HackODS UA 2026 · ODS 2 y 12</div>
      </header>
      <section className="hero">
        <p className="eyebrow">Conectando solidaridad en Villa El Salvador</p>
        <h1>Rescatemos alimentos. Compartamos oportunidades.</h1>
        <p>Prototipo de conexión entre donantes y comedores populares. Registros de muestra ficticios.</p>
      </section>
      <section className="stats" aria-label="Estadísticas de la demostración">
        <article><strong>{stats?.available ?? '...'}</strong><span>Disponibles</span></article>
        <article><strong>{stats?.reserved ?? '...'}</strong><span>Reservadas</span></article>
        <article><strong>{stats?.delivered ?? '...'}</strong><span>Entregadas</span></article>
        <article><strong>{stats?.kilograms_delivered ?? '...'} kg</strong><span>Alimentos entregados (demo)</span></article>
      </section>
      {error && <div className="alert error" role="alert">{error} <button onClick={() => void load()}>Reintentar</button></div>}
      {message && <div className="alert success" role="status">{message}</div>}
      <section className="columns">
        <div className="panel">
          <div className="panelHeader">
            <h2>Donaciones</h2>
            <select aria-label="Filtrar por estado" value={filter} onChange={e => setFilter(e.target.value as DonationStatus | '')}>
              <option value="">Todas</option>
              <option value="available">Disponibles</option>
              <option value="reserved">Reservadas</option>
              <option value="delivered">Entregadas</option>
            </select>
          </div>
          <div className="donations">
            {donations.length === 0 && <p className="muted">Sin registros. Publica una donación para comenzar.</p>}
            {donations.map(item => (
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
                  <button disabled={busy || new Date(item.expires_at).getTime() <= Date.now()} onClick={() => void update(() => api.reserve(item.id, 'Comedor ficticio de demostración'))}>Reservar (demo)</button>
                )}
                {item.status === 'reserved' && (
                  <button disabled={busy} onClick={() => void update(() => api.deliver(item.id))}>Confirmar entrega</button>
                )}
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
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
        </div>
      </section>
      <footer>Demo educativa · No representa un servicio activo de distribución ni una evaluación sanitaria. Raciones estimadas: 0.35 kg/ración.</footer>
    </main>
  )
}
