import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { friendlyError } from '../lib/errors'
import type { AppPage } from '../app/navigation'
import type { User } from '../types'
import { Icon } from '../components/Icon'
import { FoodVisual } from '../components/FoodVisual'

export function AuthPage({ mode, onNavigate, onAuthenticated }: { mode: 'login' | 'registro'; onNavigate: (page: AppPage) => void; onAuthenticated: (user: User) => void }) {
  const isRegistration = mode === 'registro'
  const { signIn, signUp } = useAuth()
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const confirmation = String(data.get('password_confirmation') ?? '')
    setError('')
    setMessage('')
    if (isRegistration && password !== confirmation) {
      setError('Las contraseñas no coinciden. Revisa ambos campos.')
      return
    }
    setBusy(true)
    try {
      if (isRegistration) {
        const account = await signUp(email, password)
        setMessage(`La cuenta de ${account.email} quedó registrada con el rol de donante. Ahora puedes iniciar sesión.`)
      } else {
        const account = await signIn(email, password)
        onAuthenticated(account)
      }
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="np-auth-page" aria-labelledby="nature-view-title">
      <div className="np-auth-art np-reveal">
        <img src="/alimentaves-logo.png" alt="AlimentaVES" width="106" height="106" />
        <FoodVisual file="canasta-frutas.png" alt="Ilustración decorativa de una canasta con frutas" className="np-auth-visual" caption="Ilustración · no representa un comedor real." />
        <p className="np-eyebrow np-eyebrow-light"><span />UNA RED PARA COMPARTIR</p>
        <h1>{isRegistration ? 'Hay lugar en la mesa para ti.' : 'Qué bueno volver a encontrarnos.'}</h1>
        <p>AlimentaVES acerca excedentes de alimentos a comedores populares de Villa El Salvador, con información clara y coordinación comunitaria.</p>
        <div className="np-auth-art-note"><Icon name="leaf" size={17} /> Comunidad y alimento</div>
      </div>
      <div className="np-auth-content np-reveal">
        <button className="np-back-link" type="button" onClick={() => onNavigate('inicio')}>← Volver al inicio</button>
        <p className="np-eyebrow"><span />{isRegistration ? 'SÚMATE A LA COMUNIDAD' : 'BIENVENIDA, BIENVENIDO'}</p>
        <h1 id="nature-view-title" tabIndex={-1}>{isRegistration ? 'Crea tu cuenta' : 'Inicia sesión'}</h1>
        <p className="np-auth-intro">{isRegistration ? 'Registra una cuenta de donante para participar en la red.' : 'Accede a las funciones disponibles según tu rol.'}</p>
        {isRegistration && <p className="np-auth-warning">El registro público crea únicamente una cuenta de donante. No es posible solicitar un rol administrador desde aquí.</p>}
        <form className="np-auth-form" onSubmit={(event) => void submit(event)}>
          <div className="np-field"><label htmlFor="account-email">Correo electrónico</label><input id="account-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="nombre@ejemplo.pe" maxLength={254} required /></div>
          <div className="np-field"><div className="np-field-label-row"><label htmlFor="account-password">Contraseña</label></div><div className="np-password-control"><input id="account-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegistration ? 'new-password' : 'current-password'} minLength={isRegistration ? 12 : undefined} maxLength={128} required aria-describedby={isRegistration ? 'password-help' : undefined} /><button type="button" aria-pressed={showPassword} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div>{isRegistration && <small id="password-help" className="np-field-help">Usa entre 12 y 128 caracteres. Puedes pegar una contraseña.</small>}</div>
          {isRegistration && <div className="np-field"><label htmlFor="account-password-confirmation">Repite la contraseña</label><input id="account-password-confirmation" name="password_confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required /></div>}
          {error && <p className="np-form-error" role="alert">{error}</p>}
          {message && <p className="np-form-status" role="status" aria-live="polite"><Icon name="check" size={17} />{message}</p>}
          <button className="np-button np-button-dark np-button-wide" type="submit" disabled={busy}>{busy ? 'Procesando…' : isRegistration ? 'Crear cuenta de donante' : 'Iniciar sesión'} <Icon name="arrow" size={17} /></button>
          {message && isRegistration && <button className="np-button np-button-outline np-button-wide" type="button" onClick={() => onNavigate('login')}>Ir a iniciar sesión</button>}
          <p className="np-auth-switch">{isRegistration ? '¿Ya tienes una cuenta?' : '¿Aún no tienes una cuenta?'} <button type="button" onClick={() => onNavigate(isRegistration ? 'login' : 'registro')}>{isRegistration ? 'Inicia sesión' : 'Crear cuenta de donante'}</button></p>
        </form>
      </div>
    </section>
  )
}
