import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { api } from './lib/api'
import type { CommunityKitchen, CreateDonation, Donation, DonationStatus, Stats } from './types'
import {
  DonationsPage,
  ErrorNotice,
  Footer,
  Header,
  HomePage,
  ImpactPage,
  KitchensPage,
  PublishPage,
  ReservationDialog,
  SuccessNotice,
  type DonationField,
  type Page,
} from './AppViews'

const initialDonation: CreateDonation = {
  donor_name: '',
  food_name: '',
  quantity_kg: 1,
  pickup_address: '',
  expires_at: '',
  notes: '',
}

function pageFromHash(): Page {
  const candidate = window.location.hash.replace(/^#\/?/, '') as Page
  return ['inicio', 'donaciones', 'publicar', 'comedores', 'impacto'].includes(candidate) ? candidate : 'inicio'
}

export default function App() {
  const [page, setPage] = useState<Page>(() => typeof window === 'undefined' ? 'inicio' : pageFromHash())
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [kitchens, setKitchens] = useState<CommunityKitchen[]>([])
  const [filter, setFilter] = useState<DonationStatus | ''>('')
  const [search, setSearch] = useState('')
  const [kitchenSearch, setKitchenSearch] = useState('')
  const [kitchenLimit, setKitchenLimit] = useState(20)
  const [donationsLoading, setDonationsLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [kitchensLoading, setKitchensLoading] = useState(false)
  const [kitchensLoaded, setKitchensLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CreateDonation>(initialDonation)
  const [formErrors, setFormErrors] = useState<Partial<Record<DonationField, string>>>({})
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [reservation, setReservation] = useState<Donation | null>(null)
  const [reservationName, setReservationName] = useState('')
  const [reservationError, setReservationError] = useState('')
  const [donationsError, setDonationsError] = useState('')
  const [statsError, setStatsError] = useState('')
  const [kitchensError, setKitchensError] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const reservationNameRef = useRef<HTMLInputElement | null>(null)
  const fieldRefs = useRef<Partial<Record<DonationField, HTMLInputElement>>>({})
  const kitchenRequestStarted = useRef(false)

  const navigate = (nextPage: Page) => {
    const nextHash = `#${nextPage}`
    if (window.location.hash !== nextHash) window.history.pushState({ page: nextPage }, '', nextHash)
    setPage(nextPage)
    setActionError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const syncPage = () => setPage(pageFromHash())
    window.addEventListener('popstate', syncPage)
    window.addEventListener('hashchange', syncPage)
    return () => {
      window.removeEventListener('popstate', syncPage)
      window.removeEventListener('hashchange', syncPage)
    }
  }, [])

  const loadDonations = useCallback(async () => {
    setDonationsLoading(true)
    try {
      setDonations(await api.listDonations(filter || undefined))
      setDonationsError('')
    } catch (error) {
      setDonationsError(error instanceof Error ? error.message : 'No se pudieron cargar las donaciones.')
    } finally {
      setDonationsLoading(false)
    }
  }, [filter])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      setStats(await api.stats())
      setStatsError('')
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : 'No se pudieron cargar las estadísticas.')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadKitchens = useCallback(async () => {
    if (kitchenRequestStarted.current || kitchensLoaded) return
    kitchenRequestStarted.current = true
    setKitchensLoading(true)
    setKitchensError('')
    try {
      setKitchens(await api.listCommunityKitchens())
      setKitchensLoaded(true)
    } catch (error) {
      kitchenRequestStarted.current = false
      setKitchensError(error instanceof Error ? error.message : 'No se pudieron cargar los comedores.')
    } finally {
      setKitchensLoading(false)
    }
  }, [kitchensLoaded])

  useEffect(() => { void loadDonations() }, [loadDonations])
  useEffect(() => { void loadStats() }, [loadStats])
  useEffect(() => { if (page === 'comedores') void loadKitchens() }, [loadKitchens, page])
  useEffect(() => { if (reservation && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal() }, [reservation])

  const visibleDonations = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-PE')
    return term ? donations.filter(item => `${item.food_name} ${item.donor_name} ${item.pickup_address} ${item.reserved_by ?? ''}`.toLocaleLowerCase('es-PE').includes(term)) : donations
  }, [donations, search])
  const matchingKitchens = useMemo(() => {
    const term = kitchenSearch.trim().toLocaleLowerCase('es-PE')
    return term ? kitchens.filter(item => `${item.name} ${item.district} ${item.address ?? ''} ${item.source_status ?? ''}`.toLocaleLowerCase('es-PE').includes(term)) : kitchens
  }, [kitchens, kitchenSearch])
  const visibleKitchens = matchingKitchens.slice(0, kitchenLimit)

  const refreshAfterChange = async () => {
    const [items, updatedStats] = await Promise.all([api.listDonations(), api.stats()])
    setDonations(items)
    setStats(updatedStats)
    setDonationsError('')
    setStatsError('')
    setFilter('')
    setSearch('')
  }

  const updateFormField = (field: keyof CreateDonation, value: string | number) => {
    setForm(current => ({ ...current, [field]: value }))
    setFormErrors(current => ({ ...current, [field]: undefined }))
  }

  const publishDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormSubmitted(true)
    setActionError('')
    setMessage('')
    const errors: Partial<Record<DonationField, string>> = {}
    ;(['donor_name', 'food_name', 'pickup_address'] as const).forEach(field => {
      if (!form[field].trim()) errors[field] = 'Completa este campo con texto.'
    })
    if (!form.expires_at) errors.expires_at = 'Selecciona una fecha de vencimiento.'
    else if (new Date(form.expires_at).getTime() <= Date.now()) errors.expires_at = 'El vencimiento debe ser una fecha futura.'
    if (Object.keys(errors).length) {
      setFormErrors(errors)
      fieldRefs.current[Object.keys(errors)[0] as DonationField]?.focus()
      return
    }

    setBusy(true)
    try {
      const payload: CreateDonation = { ...form, donor_name: form.donor_name.trim(), food_name: form.food_name.trim(), pickup_address: form.pickup_address.trim(), expires_at: new Date(form.expires_at).toISOString(), notes: form.notes?.trim() || '' }
      await api.createDonation(payload)
      setForm(initialDonation)
      setFormErrors({})
      setFormSubmitted(false)
      navigate('donaciones')
      setMessage('Donación publicada correctamente.')
      try { await refreshAfterChange() }
      catch { setActionError('La donación se guardó, pero no se pudo actualizar el listado. Vuelve a cargar la página.') }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo publicar la donación.')
    } finally {
      setBusy(false)
    }
  }

  const reserveDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reservation) return
    const name = reservationName.trim()
    if (name.length < 2) {
      setReservationError('Escribe el nombre del comedor para continuar.')
      reservationNameRef.current?.focus()
      return
    }
    setBusy(true)
    setReservationError('')
    setActionError('')
    setMessage('')
    try {
      await api.reserve(reservation.id, name)
      dialogRef.current?.close()
      setMessage('Reserva registrada. Coordina la entrega con el donante.')
      try { await refreshAfterChange() }
      catch { setActionError('La reserva se guardó, pero no se pudo actualizar el listado. Vuelve a cargar la página.') }
    } catch (error) {
      setReservationError(error instanceof Error ? error.message : 'No se pudo completar la reserva.')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelivery = async (donation: Donation) => {
    setBusy(true)
    setActionError('')
    setMessage('')
    try {
      await api.deliver(donation.id)
      setMessage('Entrega confirmada correctamente.')
      try { await refreshAfterChange() }
      catch { setActionError('La entrega se guardó, pero no se pudo actualizar el listado. Vuelve a cargar la página.') }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo confirmar la entrega.')
    } finally {
      setBusy(false)
    }
  }

  const retryKitchens = () => {
    kitchenRequestStarted.current = false
    setKitchensLoaded(false)
    void loadKitchens()
  }
  const retryCurrentData = () => {
    setActionError('')
    if (page === 'comedores') retryKitchens()
    else if (page === 'impacto' || page === 'inicio') void loadStats()
    else void loadDonations()
  }
  const hasDataError = page === 'comedores' ? kitchensError : page === 'impacto' || page === 'inicio' ? statsError : donationsError

  return (
    <main className="layout">
      <Header page={page} onNavigate={navigate} />
      {(actionError || hasDataError) && <ErrorNotice message={actionError || hasDataError} onRetry={retryCurrentData} />}
      {message && <SuccessNotice message={message} />}
      {page === 'inicio' && <HomePage stats={stats} loading={statsLoading} onNavigate={navigate} />}
      {page === 'donaciones' && <DonationsPage donations={donations} visible={visibleDonations} loading={donationsLoading} error={donationsError} filter={filter} search={search} busy={busy} onFilter={setFilter} onSearch={setSearch} onClear={() => { setSearch(''); setFilter('') }} onPublish={() => navigate('publicar')} onReserve={donation => { setReservation(donation); setReservationName(''); setReservationError('') }} onDeliver={donation => void confirmDelivery(donation)} />}
      {page === 'publicar' && <PublishPage form={form} errors={formErrors} submitted={formSubmitted} busy={busy} onSubmit={publishDonation} onChange={updateFormField} onFieldRef={(field, node) => { fieldRefs.current[field] = node ?? undefined }} onCancel={() => navigate('donaciones')} />}
      {page === 'comedores' && <KitchensPage kitchens={kitchens} matching={matchingKitchens} visible={visibleKitchens} loading={kitchensLoading} error={kitchensError} search={kitchenSearch} onSearch={value => { setKitchenSearch(value); setKitchenLimit(20) }} onClear={() => setKitchenSearch('')} onLoadMore={() => setKitchenLimit(count => count + 20)} />}
      {page === 'impacto' && <ImpactPage stats={stats} loading={statsLoading} onNavigate={navigate} />}
      <Footer />
      <ReservationDialog reservation={reservation} name={reservationName} error={reservationError} busy={busy} dialogRef={dialogRef} nameRef={reservationNameRef} onNameChange={value => { setReservationName(value); setReservationError('') }} onSubmit={reserveDonation} onClose={() => { setReservation(null); setReservationError(''); setReservationName('') }} />
    </main>
  )
}
