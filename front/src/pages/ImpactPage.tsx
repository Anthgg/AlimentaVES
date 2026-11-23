import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { formatNumber } from '../utils/format'
import type { CommunityKitchenStats, Stats } from '../types'
import { Icon } from '../components/Icon'
import { MotionReveal } from '../components/MotionReveal'

export function ImpactPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [kitchens, setKitchens] = useState<CommunityKitchenStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const load = async () => {
    setLoading(true)
    setErrors([])
    const [donationResult, kitchenResult] = await Promise.allSettled([api.stats(), api.communityKitchenStats()])
    const failures: string[] = []
    if (donationResult.status === 'fulfilled') setStats(donationResult.value)
    else failures.push(`Indicadores de donaciones: ${friendlyError(donationResult.reason)}`)
    if (kitchenResult.status === 'fulfilled') setKitchens(kitchenResult.value)
    else failures.push(`Resumen del directorio: ${friendlyError(kitchenResult.reason)}`)
    setErrors(failures)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])
  return <section className="np-page np-impact-page" aria-labelledby="nature-view-title">
    <MotionReveal className="np-page-reveal"><div className="np-page-intro np-reveal"><div><p className="np-eyebrow"><span />INDICADORES DEL BACKEND</p><h1 id="nature-view-title" tabIndex={-1}>El impacto se consulta, no se supone.</h1><p>Esta vista reúne los contadores reales que exponen la API y explica sus límites de interpretación.</p></div><button className="np-button np-button-outline" type="button" onClick={() => void load()} disabled={loading}><Icon name="refresh" size={16} />{loading ? 'Consultando…' : 'Actualizar indicadores'}</button></div></MotionReveal>
    {errors.length > 0 && <div className="np-page-alert" role="status"><div><strong>No todos los indicadores respondieron.</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div></div>}
    <section className="np-impact-metrics" aria-label="Indicadores de donación">
      <article className="np-impact-metric np-reveal"><span className="np-step-icon"><Icon name="leaf" size={21} /></span><strong>{stats ? formatNumber(stats.available) : loading ? '…' : '—'}</strong><h2>Donaciones disponibles</h2><p>Registros cuyo estado actual en la API es disponible.</p></article>
      <article className="np-impact-metric np-reveal"><span className="np-step-icon"><Icon name="clock" size={21} /></span><strong>{stats ? formatNumber(stats.reserved) : loading ? '…' : '—'}</strong><h2>Donaciones reservadas</h2><p>Registros que la API informa como reservados.</p></article>
      <article className="np-impact-metric np-reveal"><span className="np-step-icon np-step-icon-orange"><Icon name="check" size={21} /></span><strong>{stats ? formatNumber(stats.delivered) : loading ? '…' : '—'}</strong><h2>Donaciones entregadas</h2><p>Entregas confirmadas en los registros del backend.</p></article>
      <article className="np-impact-metric np-reveal"><span className="np-step-icon"><Icon name="package" size={21} /></span><strong>{stats ? `${formatNumber(stats.kilograms_delivered)} kg` : loading ? '…' : '—'}</strong><h2>Alimentos entregados</h2><p>Kilogramos acumulados que devuelve la API.</p></article>
      <article className="np-impact-metric np-reveal"><span className="np-step-icon np-step-icon-orange"><Icon name="grain" size={21} /></span><strong>{stats ? formatNumber(stats.estimated_servings) : loading ? '…' : '—'}</strong><h2>Raciones estimadas</h2><p>Estimación referencial, calculada con equivalencia de 0.35 kg por ración.</p></article>
      <article className="np-impact-metric np-reveal"><span className="np-step-icon"><Icon name="people" size={21} /></span><strong>{kitchens ? formatNumber(kitchens.total) : loading ? '…' : '—'}</strong><h2>Registros de comedores</h2><p>Filas del directorio público; no representan comedores operativamente verificados.</p></article>
    </section>
    {kitchens && <section className="np-source-summary np-reveal" aria-labelledby="source-summary-title"><div><p className="np-eyebrow"><span />REGISTROS PÚBLICOS</p><h2 id="source-summary-title">Qué aporta el directorio.</h2><p>El conteo describe los registros importados desde la fuente. No confirma la actividad actual de cada comedor.</p></div><dl><div><dt>Con coordenadas</dt><dd>{formatNumber(kitchens.located)}</dd></div><div><dt>Distritos registrados</dt><dd>{formatNumber(kitchens.district_count)}</dd></div><div><dt>Registros con usuarios reportados por la fuente</dt><dd>{formatNumber(kitchens.records_with_reported_users)}</dd></div><div><dt>Suma de usuarios reportados</dt><dd>{formatNumber(kitchens.source_reported_users_total)}</dd></div></dl><p className="np-source-warning"><Icon name="info" size={18} /> La suma de usuarios reportados no es una cantidad de personas únicas ni beneficiarias.</p></section>}
  </section>
}
