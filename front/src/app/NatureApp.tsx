import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { NatureLayout } from '../components/NatureLayout'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { pageFromLocation, type AppPage } from './navigation'
import type { User } from '../types'
import './nature.css'

const AuthPage = lazy(() => import('../pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const AdminWorkspace = lazy(() => import('../pages/AdminWorkspace').then((module) => ({ default: module.AdminWorkspace })))
const DonationCatalogPage = lazy(() => import('../pages/DonationPages').then((module) => ({ default: module.DonationCatalogPage })))
const PublishDonationPage = lazy(() => import('../pages/DonationPages').then((module) => ({ default: module.PublishDonationPage })))
const HomePage = lazy(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })))
const CommunityKitchensPage = lazy(() => import('../pages/NatureKitchensPage').then((module) => ({ default: module.CommunityKitchensPage })))
const ImpactPage = lazy(() => import('../pages/ImpactPage').then((module) => ({ default: module.ImpactPage })))
const KitchenWorkspace = lazy(() => import('../pages/KitchenWorkspace').then((module) => ({ default: module.KitchenWorkspace })))

const titleByPage: Record<AppPage, string> = {
  inicio: 'Inicio', login: 'Iniciar sesión', registro: 'Crear cuenta', donaciones: 'Donaciones', publicar: 'Publicar donación',
  comedores: 'Comedores', impacto: 'Impacto', 'panel-comedor': 'Panel del comedor', administracion: 'Administración', notificaciones: 'Notificaciones',
}

function RoleGate({ title, copy, onNavigate }: { title: string; copy: string; onNavigate: (page: AppPage) => void }) {
  return <section className="np-page np-access-page"><p className="np-eyebrow"><span />ACCESO RESTRINGIDO</p><h1 id="nature-view-title" tabIndex={-1}>{title}</h1><p>{copy}</p><button className="np-button np-button-dark" type="button" onClick={() => onNavigate('inicio')}>Volver al inicio</button></section>
}

function FocusPageHeading({ page, children }: { page: AppPage; children: ReactNode }) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => document.querySelector<HTMLElement>('#nature-view-title, [data-page-title]')?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [page])
  return <>{children}</>
}

function NotificationsPageView({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const { user } = useAuth()
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.listNotifications>>['notifications']>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pageSize = 20

  const load = useCallback(async (nextOffset = offset) => {
    setLoading(true)
    setError('')
    try {
      const response = await api.listNotifications({ limit: pageSize, offset: nextOffset })
      setItems(response.notifications)
      setUnreadCount(response.unread_count)
    } catch (cause) { setError(friendlyError(cause)) }
    finally { setLoading(false) }
  }, [offset])
  useEffect(() => { void load(0) }, [user?.id])

  const markRead = async (id: string) => {
    setBusyId(id)
    setError('')
    try {
      const result = await api.markNotificationRead(id)
      setItems((current) => current.map((item) => item.id === id ? result : item))
      if (unreadCount > 0) setUnreadCount((count) => Math.max(0, count - 1))
    } catch (cause) { setError(friendlyError(cause)) }
    finally { setBusyId('') }
  }

  const markAll = async () => {
    setBusyId('all')
    setError('')
    try {
      await api.markAllNotificationsRead()
      setNotice('Las notificaciones quedaron marcadas como leídas por el backend.')
      await load(offset)
    } catch (cause) { setError(friendlyError(cause)) }
    finally { setBusyId('') }
  }

  const followRelated = (type: string | null) => {
    if (type?.toLowerCase().includes('donation')) onNavigate('donaciones')
    else if (user?.role === 'admin') onNavigate('administracion')
    else if (user?.role === 'kitchen') onNavigate('panel-comedor')
    else onNavigate('inicio')
  }

  return <section className="np-page np-notifications-page" aria-labelledby="nature-view-title">
    <div className="np-page-intro np-reveal"><div><p className="np-eyebrow"><span />AVISOS DE TU CUENTA</p><h1 id="nature-view-title" tabIndex={-1}>Notificaciones</h1><p>Estas notificaciones pertenecen a la sesión autenticada actual.</p></div><div className="np-unread-counter"><strong>{unreadCount}</strong><span>sin leer</span></div></div>
    {notice && <p className="np-inline-status" role="status"><Icon name="check" size={17} />{notice}</p>}
    {error && <div className="np-page-alert" role="alert"><p>{error}</p><button className="np-button np-button-outline np-button-small" type="button" onClick={() => void load(offset)}>Reintentar</button></div>}
    <div className="np-notification-toolbar"><span>Últimos avisos de tu cuenta</span><div><button type="button" className="np-button np-button-outline np-button-small" onClick={() => void load(offset)} disabled={loading}>{loading ? 'Consultando…' : 'Actualizar'}</button><button type="button" className="np-button np-button-dark np-button-small" onClick={() => void markAll()} disabled={busyId !== '' || unreadCount === 0}>{busyId === 'all' ? 'Marcando…' : 'Marcar todas como leídas'}</button></div></div>
    {loading && items.length === 0 ? <div className="np-empty-state" role="status"><span className="np-loading-indicator" /><h2>Consultando notificaciones…</h2></div> : items.length === 0 && !error ? <div className="np-empty-state"><span><Icon name="bell" size={24} /></span><h2>No tienes notificaciones en esta página.</h2><p>La API devuelve avisos de la cuenta autenticada.</p></div> : <ol className="np-notification-list">{items.map((item) => <li key={item.id} className={item.read_at ? 'is-read' : 'is-unread'}><span className="np-notification-icon"><Icon name="bell" size={19} /></span><div className="np-notification-content"><div className="np-notification-head"><h2>{item.title}</h2>{!item.read_at && <span className="np-unread-pill">Sin leer</span>}</div><p>{item.body}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</time><div className="np-notification-actions">{item.related_type && <button type="button" className="np-card-action" onClick={() => followRelated(item.related_type)}>Ver elemento relacionado <Icon name="arrow" size={15} /></button>}{!item.read_at && <button type="button" className="np-text-button" disabled={busyId !== ''} onClick={() => void markRead(item.id)}>{busyId === item.id ? 'Actualizando…' : 'Marcar como leída'}</button>}</div></div></li>)}</ol>}
    <nav className="np-pagination" aria-label="Páginas de notificaciones"><span>Resultados de tu cuenta</span><button className="np-button np-button-outline np-button-small" type="button" disabled={offset === 0 || loading} onClick={() => { const next = Math.max(0, offset - pageSize); setOffset(next); void load(next) }}>Anterior</button><span>Desplazamiento {offset}</span><button className="np-button np-button-outline np-button-small" type="button" disabled={items.length < pageSize || loading} onClick={() => { const next = offset + pageSize; setOffset(next); void load(next) }}>Siguiente</button></nav>
  </section>
}

function NatureExperience() {
  const { user, loading: sessionLoading, signOut } = useAuth()
  const reduceMotion = useReducedMotion()
  const [page, setPage] = useState<AppPage>(pageFromLocation)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [unreadCount, setUnreadCount] = useState(0)
  const [globalNotice, setGlobalNotice] = useState('')

  const checkApi = useCallback(async () => {
    setApiStatus('checking')
    try { const response = await api.health(); setApiStatus(response.status.toLowerCase() === 'ok' ? 'online' : 'offline') }
    catch { setApiStatus('offline') }
  }, [])

  const navigate = useCallback((nextPage: AppPage) => {
    const params = new URLSearchParams(window.location.search)
    if (nextPage === 'inicio') params.delete('vista')
    else params.set('vista', nextPage)
    const query = params.toString()
    window.history.pushState({ page: nextPage }, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    setPage(nextPage)
    setGlobalNotice('')
  }, [])

  useEffect(() => {
    void checkApi()
    const interval = window.setInterval(() => void checkApi(), 45_000)
    const onPopState = () => setPage(pageFromLocation())
    window.addEventListener('popstate', onPopState)
    return () => { window.clearInterval(interval); window.removeEventListener('popstate', onPopState) }
  }, [checkApi])

  useEffect(() => {
    if (!user) { setUnreadCount(0); return }
    let active = true
    const loadCount = () => api.listNotifications({ unreadOnly: true, limit: 1 }).then((result) => { if (active) setUnreadCount(result.unread_count) }).catch(() => undefined)
    void loadCount()
    const interval = window.setInterval(() => void loadCount(), 60_000)
    return () => { active = false; window.clearInterval(interval) }
  }, [user?.id])

  useEffect(() => {
    document.title = `${titleByPage[page]} | AlimentaVES`
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [page])

  const authenticated = (account: User) => navigate(account.role === 'admin' ? 'administracion' : account.role === 'kitchen' ? 'panel-comedor' : 'inicio')
  const handleSignOut = async () => {
    let logoutNotice = ''
    try { await signOut() }
    catch (cause) { logoutNotice = `La sesión se cerró en esta interfaz; el backend no confirmó la revocación. ${friendlyError(cause)}` }
    navigate('inicio')
    if (logoutNotice) setGlobalNotice(logoutNotice)
  }

  let content: ReactNode
  if (sessionLoading) content = <section className="np-page np-session-check" role="status" aria-live="polite"><span className="np-loading-indicator" /><h1>Comprobando sesión</h1><p>Validando el token actual con el backend.</p></section>
  else if ((page === 'login' || page === 'registro') && !user) content = <AuthPage mode={page} onNavigate={navigate} onAuthenticated={authenticated} />
  else if ((page === 'login' || page === 'registro') && user) content = <RoleGate title="Tu sesión ya está iniciada." copy={`La cuenta ${user.email} tiene el rol ${user.role}. Puedes continuar con las opciones disponibles para esa cuenta.`} onNavigate={navigate} />
  else if (page === 'donaciones') content = <DonationCatalogPage onNavigate={navigate} />
  else if (page === 'publicar') content = <PublishDonationPage onNavigate={navigate} />
  else if (page === 'comedores') content = <CommunityKitchensPage onNavigate={navigate} />
  else if (page === 'impacto') content = <ImpactPage />
  else if (page === 'panel-comedor') content = <KitchenWorkspace onNavigate={(target) => navigate(target as AppPage)} />
  else if (page === 'administracion') content = user?.role === 'admin' ? <AdminWorkspace /> : <RoleGate title="El panel administrativo requiere rol admin." copy="El registro público no crea administradores. La API vuelve a validar el rol antes de entregar datos o aceptar decisiones." onNavigate={navigate} />
  else if (page === 'notificaciones') content = user ? <NotificationsPageView onNavigate={navigate} /> : <RoleGate title="Inicia sesión para ver tus notificaciones." copy="La API limita las notificaciones a la cuenta autenticada. No se muestran avisos de otras cuentas." onNavigate={navigate} />
  else content = <HomePage onNavigate={navigate} />

  return <MotionConfig reducedMotion="user"><NatureLayout page={page} user={user} unreadCount={unreadCount} apiStatus={apiStatus} onNavigate={navigate} onSignOut={() => void handleSignOut()} onRetryApi={() => void checkApi()}>
    <motion.div key={page} className="np-route-motion" initial={reduceMotion ? false : { opacity: 0, y: 7 }} animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}>
      <Suspense fallback={<section className="np-page np-route-loading" role="status" aria-live="polite"><span className="np-loading-indicator" /><h1>Cargando esta sección</h1><p>Preparando el contenido de AlimentaVES.</p></section>}>
        <FocusPageHeading page={page}>
          {globalNotice && <p className="np-global-notice" role="status">{globalNotice}</p>}
          {content}
        </FocusPageHeading>
      </Suspense>
    </motion.div>
  </NatureLayout></MotionConfig>
}

export default function NatureApp() {
  return <AuthProvider><NatureExperience /></AuthProvider>
}
