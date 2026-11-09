// Accepts only public Storage URLs of this Supabase project (https, same origin, given bucket).
// Used before showing photos saved by other users, so a crafted URL cannot load an
// external image (tracking) or a non-https resource.
export function isProjectPhotoUrl(url, projectUrl, bucket) {
	if (typeof url !== 'string' || !projectUrl || !bucket) return false
	try {
		const parsed = new URL(url)
		const project = new URL(projectUrl)
		return parsed.protocol === 'https:' && parsed.origin === project.origin
			&& parsed.pathname.startsWith(`/storage/v1/object/public/${bucket}/`)
			&& !parsed.pathname.includes('..')
	} catch {
		return false
	}
}
