// E18 (sesión 8): /reset-password solo cambia la contraseña de una sesión que llegó por el
// enlace de recuperación (evento PASSWORD_RECOVERY de onAuthStateChange), nunca de una sesión
// cualquiera que ya estaba abierta. Para eso está Mi cuenta, que pide verificación.
// Se guarda por pestaña (sessionStorage) para sobrevivir a una recarga de la página.
const KEY = 'drivefix:password-recovery'
let recoveryUserId = null

export function markRecovery(userId) {
	recoveryUserId = userId || null
	try { if (userId) sessionStorage.setItem(KEY, userId) } catch { /* almacenamiento bloqueado: basta la memoria */ }
}

export function isRecoverySession(userId) {
	if (!userId) return false
	if (recoveryUserId === userId) return true
	try { return sessionStorage.getItem(KEY) === userId } catch { return false }
}

export function clearRecovery() {
	recoveryUserId = null
	try { sessionStorage.removeItem(KEY) } catch { /* nada que limpiar */ }
}
