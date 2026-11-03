// Hidden while everything fits on the first page.
export default function Pagination({ page, hasMore, loading, onChange }) {
  if (page === 0 && !hasMore) return null
  return <nav className="admin-pagination" aria-label="Paginación">
    <button className="button button-secondary" type="button" disabled={loading || page === 0} onClick={() => onChange(page - 1)}>Anterior</button>
    <span>Página {page + 1}</span>
    <button className="button button-secondary" type="button" disabled={loading || !hasMore} onClick={() => onChange(page + 1)}>Siguiente</button>
  </nav>
}
