import Pagination from '../../components/Pagination.jsx'
import { publicError } from '../../lib/errors.js'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { obtenerVehiculosUsuario } from '../../services/vehiculoService.js'

function Vehiculos() {
	const { user } = useAuth()
	const [vehicles, setVehicles] = useState([])
	const [page, setPage] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		async function loadVehicles() {
			try {
				const data = await obtenerVehiculosUsuario(user.id, page)
				if (active) { setVehicles(data.items); setHasMore(data.hasMore) }
			} catch (loadError) {
				if (active) setError(`No se pudieron cargar tus vehículos: ${publicError(loadError)}`)
			} finally {
				if (active) setLoading(false)
			}
		}
		if (user?.id) loadVehicles()
		return () => { active = false }
	}, [user?.id, page])

	return <section className="vehicles-page"><div className="vehicles-heading"><div><p className="vehicles-eyebrow">Panel de cliente / Vehículos</p><h1>Mis vehículos</h1><p className="vehicles-lead">Registra tus vehículos para encontrar repuestos de forma más sencilla.</p></div><Link className="button vehicle-button" to="/cliente/vehiculos/crear">+ Agregar vehículo</Link></div><div className="vehicles-divider" />{loading && <p className="vehicle-message">Cargando tus vehículos...</p>}{error && <p className="vehicle-error" role="alert">{error}</p>}{!loading && !error && vehicles.length === 0 && <div className="vehicle-empty"><h2>No tienes vehículos registrados</h2><p>Agrega tu primer vehículo para continuar.</p><Link className="button vehicle-button" to="/cliente/vehiculos/crear">Registrar vehículo</Link></div>}{!loading && !error && vehicles.length > 0 && <div className="vehicle-list">{vehicles.map((vehicle, index) => <article className="vehicle-card" key={vehicle.id}><span className="vehicle-card-number">VEHÍCULO {String(page * 25 + index + 1).padStart(2, '0')}</span><h2>{[vehicle.marcaNombre, vehicle.modeloNombre].filter(Boolean).join(' ') || `Vehículo de ${vehicle.anio}`}</h2><p>Año: {vehicle.anio}</p>{vehicle.descripcion && <p>{vehicle.descripcion}</p>}<div className="vehicle-card-actions"><Link to={`/cliente/vehiculos/editar/${vehicle.id}`}>Editar vehículo ↗</Link></div></article>)}</div>}<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} /></section>
}

export default Vehiculos
