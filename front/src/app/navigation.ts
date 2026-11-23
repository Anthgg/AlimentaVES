export type AppPage = 'inicio' | 'login' | 'registro' | 'donaciones' | 'publicar' | 'comedores' | 'impacto' | 'panel-comedor' | 'administracion' | 'notificaciones'

const validPages: AppPage[] = ['inicio', 'login', 'registro', 'donaciones', 'publicar', 'comedores', 'impacto', 'panel-comedor', 'administracion', 'notificaciones']

export function pageFromLocation(): AppPage {
  const page = new URLSearchParams(window.location.search).get('vista')
  return page && validPages.includes(page as AppPage) ? page as AppPage : 'inicio'
}
