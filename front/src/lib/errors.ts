import { ApiError } from './api'

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Esta donación ya no está disponible. Actualiza el catálogo para ver su estado.'
    if (error.status === 409) return 'El estado de esta donación cambió y ya no permite esa acción. Actualiza el catálogo e inténtalo de nuevo.'
    if (error.status === 422) return `Revisa los datos ingresados: ${error.message}`
    if (error.status >= 500) return 'El servicio tuvo un problema. Inténtalo nuevamente en unos momentos.'
    return error.message
  }

  if (error instanceof Error) {
    if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
      return 'No se pudo conectar con la API. Comprueba que el backend esté disponible e inténtalo otra vez.'
    }
    return error.message
  }

  return 'Ocurrió un problema inesperado. Inténtalo otra vez.'
}
