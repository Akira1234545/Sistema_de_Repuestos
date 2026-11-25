// E37: in LIKE/ILIKE patterns % and _ are wildcards and \ escapes them. A visitor who types
// "50%" or "a_b" searches for those characters literally, as the database RPCs already do.
export function escapeLike(text) {
	return String(text ?? '').replace(/[\\%_]/g, (character) => `\\${character}`)
}
