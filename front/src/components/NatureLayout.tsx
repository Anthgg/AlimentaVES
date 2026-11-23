import { useState } from 'react'
import type { ReactNode } from 'react'
import type { AppPage } from '../app/navigation'
import type { User } from '../types'
import { Icon } from './Icon'

const primaryLinks: Array<{ page: AppPage; label: string }> = [
  { page: 'inicio', label: 'Inicio' },
  { page: 'donaciones', label: 'Donaciones' },
  { page: 'comedores', label: 'Comedores' },
  { page: 'impacto', label: 'Impacto' },
]

export function NatureLayout({ page, user, unreadCount, apiStatus, onNavigate, onSignOut, onRetryApi, children }: {
  page: AppPage
  user: User | null
  unreadCount: number
  apiStatus: 'checking' | 'online' | 'offline'
  onNavigate: (page: AppPage) => void
  onSignOut: () => void
  onRetryApi: () => void
  children: ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const links = [...primaryLinks]
  if (user?.role === 'kitchen') links.splice(3, 0, { page: 'panel-comedor', label: 'Mi comedor' })
  if (user?.role === 'admin') links.splice(3, 0, { page: 'administracion', label: 'Administración' })
  const go = (next: AppPage) => { setMobileOpen(false); onNavigate(next) }
  const statusLabel = apiStatus === 'online' ? 'API conectada' : apiStatus === 'checking' ? 'Comprobando API' : 'API sin conexión'

  return (
    <div className="nature-app">
      <a className="np-skip-link" href="#nature-main">Saltar al contenido</a>
      <header className="np-header">
        <div className="np-header-inner">
          <a className="np-brand" href="/?vista=inicio" onClick={(event) => { event.preventDefault(); go('inicio') }}>
            <img src="/alimentaves-logo.png" alt="AlimentaVES" width="66" height="66" />
            <span>Comunidad y alimento</span>
          </a>
          <button className="np-menu-toggle" type="button" aria-expanded={mobileOpen} aria-controls="nature-navigation" onClick={() => setMobileOpen((open) => !open)}>
            <Icon name={mobileOpen ? 'close' : 'menu'} size={18} /><span>{mobileOpen ? 'Cerrar' : 'Menú'}</span>
          </button>
          <nav id="nature-navigation" className={`np-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Navegación principal">
            {links.map(({ page: target, label }) => <a key={target} href={`/?vista=${target}`} aria-current={page === target ? 'page' : undefined} onClick={(event) => { event.preventDefault(); go(target) }}>{label}</a>)}
            {user && <a href="/?vista=notificaciones" className="np-notification-link" aria-current={page === 'notificaciones' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); go('notificaciones') }}><span>Notificaciones</span>{unreadCount > 0 && <span className="np-notification-count" aria-label={`${unreadCount} sin leer`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}</a>}
            {user ? (
              <div className="np-account-menu"><span className="np-user-email" title={user.email}>{user.email}</span><button type="button" className="np-nav-login" onClick={onSignOut}>Cerrar sesión</button></div>
            ) : (
              <div className="np-account-menu"><a className="np-nav-login" href="/?vista=login" aria-current={page === 'login' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); go('login') }}>Iniciar sesión <Icon name="arrow" size={16} /></a><a className="np-nav-register" href="/?vista=registro" aria-current={page === 'registro' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); go('registro') }}>Crear cuenta</a></div>
            )}
          </nav>
        </div>
        <div className="np-header-status">
          <span className={`np-status-light is-${apiStatus}`} aria-hidden="true" />
          <span>{statusLabel}</span>
          {apiStatus !== 'online' && <button type="button" onClick={onRetryApi} disabled={apiStatus === 'checking'}>{apiStatus === 'checking' ? 'Consultando…' : 'Reintentar'}</button>}
          {user && <span className="np-role-label">{user.role === 'admin' ? 'Administrador' : user.role === 'kitchen' ? 'Comedor' : 'Donante'}</span>}
        </div>
      </header>
      <main className="np-main" id="nature-main" tabIndex={-1}>{children}</main>
      <footer className="np-footer">
        <div className="np-footer-inner">
          <div className="np-footer-brand"><a className="np-brand" href="/?vista=inicio" onClick={(event) => { event.preventDefault(); go('inicio') }}><img src="/alimentaves-logo.png" alt="AlimentaVES" width="60" height="60" /><span>Comunidad y alimento</span></a><p>Una red local para aprovechar mejor los alimentos en Villa El Salvador.</p></div>
          <nav className="np-footer-links" aria-label="Enlaces de pie de página"><span>Explora la plataforma</span>{primaryLinks.map(({ page: target, label }) => <button key={target} type="button" onClick={() => go(target)}>{label}</button>)}{user?.role === 'kitchen' && <button type="button" onClick={() => go('panel-comedor')}>Mi comedor</button>}{user?.role === 'admin' && <button type="button" onClick={() => go('administracion')}>Administración</button>}</nav>
          <p className="np-footer-note">Villa El Salvador · Lima, Perú</p>
        </div>
      </footer>
    </div>
  )
}
