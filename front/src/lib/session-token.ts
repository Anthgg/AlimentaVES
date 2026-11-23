const TOKEN_KEY = 'alimentaves.session-token'

export function getSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveSessionToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearSessionToken(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
}
