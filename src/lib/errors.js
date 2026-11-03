export function publicError(error) {
  if (error?.code === '23505') return 'Este registro ya existe. Actualiza el listado antes de volver a intentar.'
  if (error?.code === '23514') return 'Revisa los campos y sus límites antes de guardar.'
  if (error?.code === '42501') return 'Tu cuenta no puede realizar esta operación.'
  if (error?.code === 'PGRST202') return 'Supabase no encuentra esta operación. Verifica que la migración correspondiente esté aplicada y actualiza el esquema de la API.'
  if (error?.code === 'invalid_credentials') return 'Correo o contraseña incorrectos.'
  if (error?.code === 'weak_password') return 'La contraseña es demasiado débil. Usa al menos 12 caracteres con mayúsculas, minúsculas, números y símbolos.'
  if (error?.code === 'same_password') return 'La nueva contraseña debe ser diferente de la actual.'
  if (error?.code === 'email_not_confirmed') return 'Confirma tu correo antes de iniciar sesión.'
  if (error?.status === 429) return 'Espera un momento antes de volver a intentarlo.'
  const message = String(error?.message || '')
  const businessMessage = /^(Esta solicitud|Este vehículo|Las fotos|La configuración|La tienda|Cuenta no disponible|Se requiere|Solo puedes|No puedes|Selecciona|Indica|El sistema está en mantenimiento|La fotografía|Demasiadas|Ya existe|El registro ya se guardó|El nombre y el apellido|Escribe un teléfono|Debes iniciar sesión)/u
  if (businessMessage.test(message) && message.length <= 240 && !/\b(SELECT|UPDATE|public\.|permission denied|relation|function)\b/i.test(message)) return message
  return 'Comprueba tu conexión y vuelve a intentarlo. Si continúa, contacta con soporte.'
}
