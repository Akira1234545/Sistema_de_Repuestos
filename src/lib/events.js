// Fired to reload the current page's data (pull to refresh in the Android app).
export const REFRESH_EVENT = 'repuestos:refresh'

// Asks the header search (GlobalSearch) to take focus: sidebar «Buscar…» button.
export const OPEN_SEARCH_EVENT = 'drivefix:open-search'

// Q05 (sesión 8): una acción cambió los contadores de la barra lateral (propuesta enviada o
// retirada, propuesta seleccionada, selección cancelada, solicitud cerrada…): se recalculan ya.
export const PANEL_BADGES_EVENT = 'drivefix:panel-badges'
export const refreshPanelBadges = () => window.dispatchEvent(new Event(PANEL_BADGES_EVENT))
