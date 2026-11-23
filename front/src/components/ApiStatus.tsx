import { useState } from 'react'

export type ApiStatusValue = 'checking' | 'online' | 'offline'

const labels: Record<ApiStatusValue, string> = {
  checking: 'Comprobando API',
  online: 'API conectada',
  offline: 'API sin conexión',
}

export function ApiStatus({ status, onRetry }: { status: ApiStatusValue; onRetry: () => void }) {
  const [showDetails, setShowDetails] = useState(false)
  return (
    <div className={`api-status api-status-${status}`}>
      <button type="button" className="api-status-button" aria-expanded={showDetails} onClick={() => setShowDetails((open) => !open)}>
        <span className="api-status-dot" />{labels[status]}
      </button>
      {showDetails && (
        <div className="api-status-popover" role="status">
          <span>{status === 'online' ? 'El backend respondió correctamente a /api/health.' : status === 'offline' ? 'No se pudo comprobar /api/health. La interfaz sigue disponible y puedes volver a intentar.' : 'Consultando el estado del backend.'}</span>
          <button type="button" onClick={onRetry} disabled={status === 'checking'}>Comprobar</button>
        </div>
      )}
    </div>
  )
}
