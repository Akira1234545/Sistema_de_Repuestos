export default function Pagination({ page, hasMore, loading, onChange }) {
  return <nav className="admin-pagination" aria-label="Paginación">
    <button className="button button-secondary" type="button" disabled={loading || page === 0} onClick={() => onChange(page - 1)}>Anterior</button>
    <span>Página {page + 1}</span>
    <button className="button button-secondary" type="button" disabled={loading || !hasMore} onClick={() => onChange(page + 1)}>Siguiente</button>
  </nav>
}
