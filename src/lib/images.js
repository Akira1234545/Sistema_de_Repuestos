// Downscales a photo in the browser before upload: phone pictures are often 4–10 MB,
// a 1600 px WebP keeps detail for spotting a part at a fraction of the size.
export async function compressImage(file, { maxSide = 1600, quality = 0.82 } = {}) {
	if (!file?.type?.startsWith('image/')) throw new Error('Elige una imagen (JPG, PNG o WebP).')
	const bitmap = await createImageBitmap(file).catch(() => null)
	if (!bitmap) throw new Error('No se pudo leer la imagen. Prueba con otra foto.')
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
	const canvas = document.createElement('canvas')
	canvas.width = Math.round(bitmap.width * scale)
	canvas.height = Math.round(bitmap.height * scale)
	canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
	bitmap.close?.()
	const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
	if (!blob) throw new Error('No se pudo procesar la imagen.')
	return blob
}
