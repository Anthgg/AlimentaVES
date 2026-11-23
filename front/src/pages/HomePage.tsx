import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { formatDate, formatNumber } from '../utils/format'
import type { AppPage } from '../app/navigation'
import type { CommunityKitchenStats, Donation, Stats } from '../types'
import { Icon } from '../components/Icon'
import { NatureIllustration } from '../components/NatureIllustration'
import { MotionReveal } from '../components/MotionReveal'
import { IllustrativeFoodPhotoShelf } from '../components/FoodVisual'

function StatusText({ status }: { status: Donation['status'] }) {
  const labels = { available: 'Disponible', reserved: 'Reservada', delivered: 'Entregada' }
  return <span className={`np-live-status np-live-status-${status}`}><i aria-hidden="true" />{labels[status]}</span>
}

export function HomePage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [kitchenStats, setKitchenStats] = useState<CommunityKitchenStats | null>(null)
  const [recent, setRecent] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    let active = true
    void Promise.allSettled([api.stats(), api.listDonations(), api.communityKitchenStats()]).then((results) => {
      if (!active) return
      const messages: string[] = []
      if (results[0].status === 'fulfilled') setStats(results[0].value)
      else messages.push(`No se cargaron las estadísticas de donaciones: ${friendlyError(results[0].reason)}`)
      if (results[1].status === 'fulfilled') {
        const ordered = [...results[1].value].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setRecent(ordered.slice(0, 3))
      } else messages.push(`No se cargaron las donaciones recientes: ${friendlyError(results[1].reason)}`)
      if (results[2].status === 'fulfilled') setKitchenStats(results[2].value)
      else messages.push(`No se cargó el resumen del directorio: ${friendlyError(results[2].reason)}`)
      setErrors(messages)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const retry = () => {
    setLoading(true)
    setErrors([])
    void Promise.allSettled([api.stats(), api.listDonations(), api.communityKitchenStats()]).then((results) => {
      const messages: string[] = []
      if (results[0].status === 'fulfilled') setStats(results[0].value)
      else messages.push(`Estadísticas: ${friendlyError(results[0].reason)}`)
      if (results[1].status === 'fulfilled') setRecent([...results[1].value].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3))
      else messages.push(`Donaciones: ${friendlyError(results[1].reason)}`)
      if (results[2].status === 'fulfilled') setKitchenStats(results[2].value)
      else messages.push(`Directorio: ${friendlyError(results[2].reason)}`)
      setErrors(messages)
      setLoading(false)
    })
  }

  return (
    <>
      <MotionReveal className="np-home-section-reveal"><section className="np-hero" aria-labelledby="nature-view-title">
        <div className="np-hero-copy np-reveal">
          <p className="np-eyebrow"><span />UNA RED LOCAL · VILLA EL SALVADOR</p>
          <h1 id="nature-view-title" tabIndex={-1}>Menos desperdicio, <em>más mesas llenas.</em></h1>
          <p className="np-lead">AlimentaVES conecta alimentos aprovechables con comedores populares de Villa El Salvador para que la coordinación comunitaria sea más sencilla.</p>
          <div className="np-hero-actions">
            <button className="np-button np-button-orange" type="button" onClick={() => onNavigate('publicar')}>Publicar donación <Icon name="arrow" size={18} /></button>
            <button className="np-button np-button-outline" type="button" onClick={() => onNavigate('donaciones')}>Encontrar alimentos</button>
            <button className="np-button np-button-quiet" type="button" onClick={() => onNavigate('comedores')}>Explorar comedores <Icon name="arrow" size={17} /></button>
          </div>
          <p className="np-hero-caption"><Icon name="pin" size={17} /> Villa El Salvador, Lima <span aria-hidden="true">·</span> ODS 2 y 12</p>
        </div>
        <div className="np-hero-visual np-reveal"><NatureIllustration /></div>
        <div className="np-live-metrics np-reveal" aria-label="Indicadores cargados desde la API">
          <div><span className="np-stat-icon"><Icon name="leaf" size={20} /></span><strong>{stats ? formatNumber(stats.available) : loading ? '…' : '—'}</strong><span>Donaciones disponibles</span></div>
          <div><span className="np-stat-icon"><Icon name="package" size={20} /></span><strong>{stats ? formatNumber(stats.delivered) : loading ? '…' : '—'}</strong><span>Donaciones entregadas</span></div>
          <div><span className="np-stat-icon"><Icon name="people" size={20} /></span><strong>{kitchenStats ? formatNumber(kitchenStats.total) : loading ? '…' : '—'}</strong><span>Registros de comedores</span></div>
          <p>Datos del backend · registros públicos no confirman operación actual de comedores</p>
        </div>
      </section></MotionReveal>

      {errors.length > 0 && <div className="np-page-alert" role="status"><div><strong>Parte de la información no está disponible.</strong><ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul></div><button className="np-button np-button-small np-button-outline" type="button" onClick={retry} disabled={loading}>{loading ? 'Consultando…' : 'Reintentar'}</button></div>}

      <MotionReveal className="np-home-section-reveal"><section className="np-how-section np-data-section" aria-labelledby="how-title">
        <div className="np-section-heading np-reveal"><p className="np-eyebrow"><span />CÓMO SE MUEVEN LOS ALIMENTOS</p><h2 id="how-title">De un lote disponible a una entrega coordinada.</h2><p>La plataforma mantiene dos recorridos distintos, según las rutas que hoy expone el backend.</p></div>
        <ol className="np-steps">
          <li className="np-step np-reveal"><span className="np-step-index">01</span><span className="np-step-icon"><Icon name="package" size={23} /></span><h3>El donante publica</h3><p>Se registra el alimento, su cantidad, vencimiento y punto de recojo.</p><button type="button" onClick={() => onNavigate('publicar')}>Publicar alimentos <Icon name="arrow" size={16} /></button></li>
          <li className="np-step np-reveal"><span className="np-step-index">02</span><span className="np-step-icon"><Icon name="people" size={24} /></span><h3>El comedor encuentra</h3><p>Un usuario con vínculo activo puede enviar una solicitud que requiere revisión administrativa.</p><button type="button" onClick={() => onNavigate('donaciones')}>Explorar donaciones <Icon name="arrow" size={16} /></button></li>
          <li className="np-step np-reveal"><span className="np-step-index">03</span><span className="np-step-icon np-step-icon-orange"><Icon name="check" size={24} /></span><h3>Se confirma la entrega</h3><p>La reserva directa de la API es una acción distinta; la entrega se confirma sobre una donación reservada.</p><button type="button" onClick={() => onNavigate('impacto')}>Ver indicadores API <Icon name="arrow" size={16} /></button></li>
        </ol>
        <div className="np-flow-note np-reveal"><Icon name="info" size={18} /><p><strong>Dos flujos distintos:</strong> la API conserva la reserva directa existente por nombre de comedor. Las solicitudes para aprobación requieren sesión, vínculo activo y moderación administrativa; no se convierten automáticamente en una reserva.</p></div>
      </section></MotionReveal>

      <MotionReveal className="np-home-section-reveal"><section className="np-impact-band np-reveal" aria-labelledby="impact-band-title">
        <div><p className="np-eyebrow np-eyebrow-light"><span />IMPACTO DESDE REGISTROS DEL BACKEND</p><h2 id="impact-band-title">Lo que la comunidad coordina, también se puede seguir.</h2><p>Las cifras se consultan en vivo. Las raciones son una estimación calculada por el backend, no un conteo de personas beneficiadas.</p></div>
        <div className="np-impact-band-metric"><strong>{stats ? `${formatNumber(stats.kilograms_delivered)} kg` : loading ? '…' : '—'}</strong><span>Kilogramos entregados</span></div>
        <div className="np-impact-band-metric"><strong>{stats ? formatNumber(stats.estimated_servings) : loading ? '…' : '—'}</strong><span>Raciones estimadas · 0.35 kg por ración</span></div>
        <button className="np-button np-button-cream" type="button" onClick={() => onNavigate('impacto')}>Ver el impacto <Icon name="arrow" size={18} /></button>
      </section></MotionReveal>

      <MotionReveal className="np-home-section-reveal"><section className="np-home-recent" aria-labelledby="recent-title">
        <div className="np-section-heading np-home-section-heading np-reveal"><p className="np-eyebrow"><span />DONACIONES RECIENTES</p><h2 id="recent-title">Alimentos que están en la red.</h2><p>Consulta cantidades, vencimientos y estados informados por la plataforma.</p><button className="np-button np-button-outline" type="button" onClick={() => onNavigate('donaciones')}>Ver todas <Icon name="arrow" size={17} /></button></div>
        {loading && recent.length === 0 ? <div className="np-empty-state" role="status"><span className="np-loading-indicator" /><h2>Consultando la API…</h2></div> : recent.length === 0 ? <div className="np-empty-state np-reveal"><span><Icon name="leaf" size={24} /></span><h2>Aún no hay donaciones para mostrar.</h2><p>Cuando la API devuelva un lote, aparecerá aquí.</p><button type="button" className="np-button np-button-dark" onClick={() => onNavigate('publicar')}>Publicar una donación</button></div> : <div className="np-live-donation-grid">{recent.map((donation) => <article className="np-live-donation-card np-reveal" key={donation.id}><div className="np-live-donation-card-top"><span><Icon name="leaf" size={19} />Registro del backend</span><StatusText status={donation.status} /></div><h3>{donation.food_name}</h3><strong className="np-live-quantity">{formatNumber(donation.quantity_kg)} <small>kg</small></strong><dl><div><dt>Vencimiento</dt><dd>{formatDate(donation.expires_at)}</dd></div><div><dt>Fecha de registro</dt><dd>{formatDate(donation.created_at)}</dd></div></dl><button type="button" className="np-card-action" onClick={() => onNavigate('donaciones')}>Ver catálogo <Icon name="arrow" size={16} /></button></article>)}</div>}
      </section></MotionReveal>

      <MotionReveal className="np-home-section-reveal"><section className="np-purpose-section" aria-labelledby="purpose-title">
        <div className="np-purpose-copy np-reveal"><p className="np-eyebrow"><span />PROPÓSITO COMPARTIDO</p><h2 id="purpose-title">Cuidar el alimento también es cuidar la comunidad.</h2><p>La propuesta fortalece la coordinación entre donantes y comedores populares para aprovechar alimentos aptos para el consumo.</p><div className="np-principle-list"><div><span>01</span><p><strong>Menos desperdicio.</strong> Aprovechar excedentes requiere información clara y entregas coordinadas.</p></div><div><span>02</span><p><strong>Más acceso.</strong> Conectar organizaciones locales puede facilitar que los alimentos lleguen a otras mesas.</p></div></div></div>
        <div className="np-ods-cards np-reveal"><article><span>ODS 2</span><h3>Hambre Cero</h3><p>Impulsar un acceso más cercano a alimentos y una mejor coordinación comunitaria.</p></article><article><span>ODS 12</span><h3>Producción y consumo responsables</h3><p>Promover el aprovechamiento de alimentos que aún pueden ser consumidos.</p></article></div>
      </section></MotionReveal>

      <MotionReveal className="np-home-section-reveal"><IllustrativeFoodPhotoShelf /></MotionReveal>

      <MotionReveal className="np-home-section-reveal"><section className="np-faq-section" aria-labelledby="faq-title"><div className="np-section-heading np-reveal"><p className="np-eyebrow"><span />PREGUNTAS FRECUENTES</p><h2 id="faq-title">Información clara antes de coordinar.</h2></div><div className="np-faq-list np-reveal"><details><summary>¿El directorio confirma que un comedor está operando?</summary><p>No. El directorio contiene registros públicos y sus estados de fuente. La operación actual no está confirmada por AlimentaVES.</p></details><details><summary>¿Qué diferencia hay entre reservar y solicitar una donación?</summary><p>La reserva directa cambia el estado de la donación mediante una ruta existente. La solicitud de donación requiere una cuenta vinculada a un comedor y una decisión administrativa; son recorridos separados.</p></details><details><summary>¿Cómo se calculan las raciones estimadas?</summary><p>El backend usa una equivalencia de 0.35 kg por ración. Es una estimación agregada, no un conteo de personas beneficiadas.</p></details></div></section></MotionReveal>
    </>
  )
}
