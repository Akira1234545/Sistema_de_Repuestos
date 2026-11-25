// Documentos legales de DriveFix (sesión 8). Una sola fuente para las páginas /legal/*, el aviso de
// cookies y la aceptación en el registro. Al cambiar un texto de fondo, sube LEGAL_VERSION: el
// registro guarda la versión aceptada en los metadatos de la cuenta.
export const LEGAL_VERSION = '2026-11-25'
export const LEGAL_UPDATED = '25 de noviembre de 2026'

export const LEGAL_DOCS = {
	terminos: {
		title: 'Términos y condiciones de uso',
		short: 'Términos',
		summary: 'Las reglas para usar DriveFix como cliente o como tienda.',
		sections: [
			{ heading: '1. Qué es DriveFix', body: [
				'DriveFix es una plataforma que conecta a personas que necesitan repuestos para su vehículo con tiendas de repuestos aprobadas. La persona publica una solicitud; las tiendas que atienden esa categoría envían propuestas con precio total, marca, disponibilidad y garantía; la persona compara y elige.',
				'DriveFix no vende repuestos ni cobra por las compras. La venta se acuerda directamente entre la persona y la tienda elegida.',
			] },
			{ heading: '2. Cuentas', body: [
				'Para usar los paneles necesitas una cuenta de cliente o de tienda, con datos verdaderos y un correo que controles. Eres responsable de guardar tu contraseña; puedes ver u ocultar lo que escribes, pero no la compartas.',
				'Debes tener al menos 18 años o actuar con autorización de tu madre, padre o tutor.',
				'Las cuentas de administración las asigna el equipo de DriveFix y exigen un segundo factor de verificación.',
			] },
			{ heading: '3. Uso permitido', body: [
				'No está permitido publicar información falsa, ofensiva o de terceros sin permiso, reseñas sobre atenciones que no ocurrieron, ni intentar acceder a datos de otras cuentas.',
				'Las fotos que subas deben ser tuyas o contar con permiso, y no deben mostrar datos personales de otras personas (por ejemplo, placas o rostros) si no es necesario.',
			] },
			{ heading: '4. Solicitudes, propuestas y reseñas', body: [
				'El precio de cada propuesta es el total por lo solicitado. Una vez que llegan propuestas, la solicitud no se puede cambiar para que todas las tiendas respondan a lo mismo; si necesitas otra cosa, crea otra solicitud.',
				'Solo puede reseñar una tienda quien la eligió y confirmó la atención. Las reseñas deben describir una experiencia real.',
			] },
			{ heading: '5. Moderación y suspensión', body: [
				'El equipo de DriveFix puede rechazar, suspender o desactivar cuentas y tiendas que incumplan estos términos. Cada decisión queda registrada con un motivo escrito que se comunica a la cuenta afectada.',
			] },
			{ heading: '6. Responsabilidad', body: [
				'DriveFix verifica a las tiendas antes de aprobarlas y muestra solo datos reales, pero no garantiza el producto: la calidad, la garantía y la factura son responsabilidad de la tienda que vende. Tus derechos como consumidor se explican en «Derechos del consumidor».',
			] },
			{ heading: '7. Cambios y ley aplicable', body: [
				'Si cambiamos estos términos de forma importante, te lo pediremos aceptar de nuevo. Se aplican las leyes del Estado Plurinacional de Bolivia.',
			] },
		],
	},
	privacidad: {
		title: 'Política de privacidad y protección de datos personales',
		short: 'Privacidad',
		summary: 'Qué datos guardamos, para qué, quién los ve y cómo ejercer tus derechos.',
		sections: [
			{ heading: 'Base legal', body: [
				'Tratamos tus datos conforme a la Constitución Política del Estado (art. 21, derecho a la privacidad e intimidad, y art. 130, Acción de Protección de Privacidad), la Ley 164 General de Telecomunicaciones y Tecnologías de Información y Comunicación y su reglamento (DS 1793), y la Ley 453 de los derechos de usuarios y consumidores.',
			] },
			{ heading: 'Qué datos guardamos', body: [
				'Cuenta: nombre, apellido, correo, teléfono (opcional) y tipo de cuenta.',
				'Clientes: vehículos (tipo, marca, modelo, año, notas y fotos), solicitudes, propuestas elegidas, favoritos y reseñas.',
				'Tiendas: nombre comercial, descripción, horario, teléfono, dirección, ubicación en el mapa, fotos, categorías, propuestas y promociones.',
				'Registro técnico: fechas de creación y cambios de estado, para que cada solicitud y propuesta tenga trazabilidad.',
			] },
			{ heading: 'Para qué los usamos', body: [
				'Solo para que la plataforma funcione: mostrar tus solicitudes a las tiendas de esa categoría, enviarte avisos, mostrar perfiles y reseñas, y moderar el contenido. No vendemos ni cedemos tus datos y no los usamos para publicidad.',
			] },
			{ heading: 'Quién ve qué', body: [
				'Las tiendas ven tu solicitud y tu vehículo, pero no tu teléfono ni tu correo.',
				'El teléfono, la dirección y la ubicación de una tienda solo los ve el cliente que eligió su propuesta.',
				'Las reseñas públicas no muestran el nombre de quien reseña; la tienda reseñada sí lo ve.',
				'El equipo de administración ve lo necesario para moderar, con verificación en dos pasos.',
			] },
			{ heading: 'Dónde se guardan', body: [
				'En Supabase, nuestro proveedor de base de datos y archivos, con cifrado en tránsito y reglas de acceso por fila. Los servidores pueden estar fuera de Bolivia.',
			] },
			{ heading: 'Tus derechos', body: [
				'Puedes acceder a tus datos, corregirlos desde Mi cuenta, pedir que se eliminen y oponerte a un uso concreto. Escríbenos al correo de soporte que figura en la plataforma; respondemos en un plazo máximo de 15 días hábiles.',
				'Al eliminar tu cuenta borramos tus datos personales; conservamos de forma anónima lo imprescindible para la trazabilidad de propuestas ya enviadas a otras personas.',
			] },
		],
	},
	cookies: {
		title: 'Cookies y almacenamiento local',
		short: 'Cookies',
		summary: 'Solo usamos lo imprescindible para que la sesión y tus preferencias funcionen.',
		sections: [
			{ heading: 'Qué usamos', body: [
				'DriveFix no usa cookies de publicidad ni de analítica, ni comparte datos de navegación con terceros.',
				'Usamos el almacenamiento local del navegador (similar a una cookie) para lo esencial: la sesión iniciada (Supabase Auth), si ya viste este aviso y preferencias como la barra lateral contraída o el periodo de las tendencias.',
				'El mapa de OpenStreetMap que aparece en algunos perfiles se carga desde su propio sitio y se rige por su política.',
			] },
			{ heading: 'Cómo borrarlo', body: [
				'Al cerrar sesión se borra la sesión guardada. Puedes borrar todo el almacenamiento de DriveFix desde la configuración de tu navegador; tendrás que volver a iniciar sesión.',
			] },
		],
	},
	'contrato-tiendas': {
		title: 'Condiciones para tiendas',
		short: 'Condiciones para tiendas',
		summary: 'El acuerdo que acepta cada tienda para publicar propuestas y promociones.',
		sections: [
			{ heading: '1. Aprobación', body: [
				'Cada tienda pasa por una revisión del equipo de DriveFix antes de aparecer y responder solicitudes. Si se rechaza, se indica el motivo; al corregir los datos vuelve a revisión.',
			] },
			{ heading: '2. Propuestas honestas', body: [
				'El precio de la propuesta es el total final por lo solicitado, en bolivianos e incluidos los impuestos. La marca, la disponibilidad y la garantía deben ser reales y se deben cumplir si el cliente elige la propuesta.',
			] },
			{ heading: '3. Venta, factura y garantía', body: [
				'La venta se realiza directamente entre la tienda y el cliente. La tienda emite la factura conforme a la normativa tributaria y responde por la garantía ofrecida y la legal (Ley 453).',
			] },
			{ heading: '4. Datos de clientes', body: [
				'La tienda solo usa los datos que recibe por DriveFix para atender esa solicitud. No puede usarlos para publicidad ni compartirlos.',
			] },
			{ heading: '5. Promociones y reseñas', body: [
				'Las promociones deben ser reales y vigentes en las fechas indicadas. Está prohibido crear reseñas propias o pedirlas a cambio de beneficios.',
			] },
			{ heading: '6. Suspensión', body: [
				'El incumplimiento puede llevar a la suspensión de la tienda, siempre con un motivo escrito. La tienda puede pedir la revisión de la decisión por correo al equipo de soporte.',
			] },
		],
	},
	consumidor: {
		title: 'Derechos del consumidor',
		short: 'Derechos del consumidor',
		summary: 'Lo que la Ley 453 garantiza cuando compras un repuesto a través de DriveFix.',
		sections: [
			{ heading: 'Tus derechos', body: [
				'La Constitución (art. 75) y la Ley 453 General de los Derechos de las Usuarias y los Usuarios y de las Consumidoras y los Consumidores te garantizan, entre otros:',
				'Información veraz, completa y en castellano sobre el producto, su precio total y su garantía antes de comprar.',
				'Trato equitativo y no discriminatorio.',
				'Garantía: reparación, cambio o devolución si el producto tiene fallas dentro del plazo ofrecido.',
				'Recibir factura por tu compra.',
			] },
			{ heading: 'Cómo reclamar', body: [
				'Primero, con la tienda que te vendió el repuesto (tienes su teléfono y ubicación desde que eliges su propuesta).',
				'Si no se resuelve, avísanos por el correo de soporte: podemos revisar la tienda y suspenderla si incumple.',
				'También puedes acudir al Viceministerio de Defensa de los Derechos del Usuario y del Consumidor.',
			] },
		],
	},
}

LEGAL_DOCS.creditos = {
	title: "Créditos de imágenes",
	short: "Créditos de imágenes",
	summary: "Las fotos de categorías, tiendas, vehículos y promociones de demostración son de Wikimedia Commons, con licencia libre.",
	sections: [
		{ heading: "Licencias", body: [
			"Cada foto se usa según su licencia (CC0, CC BY o CC BY-SA). Las fotos se recortaron y comprimieron para la web; no se cambió su contenido.",
		] },
	],
}

export const LEGAL_ORDER = ['terminos', 'privacidad', 'cookies', 'contrato-tiendas', 'consumidor']
export const legalPath = (slug) => `/legal/${slug}`
