import Pagination from '../../components/Pagination.jsx'
import SkeletonList from '../../components/ui/Skeleton.jsx'
import Icon from '../../components/Icon.jsx'
import { publicError } from '../../lib/errors.js'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { contarSolicitudesPorVehiculo, obtenerVehiculosUsuario } from '../../services/vehiculoService.js'
import { vehicleName } from '../../lib/vehicles.js'

function Vehiculos() {
	const { user } = useAuth()
	const [vehicles, setVehicles] = useState([])
	const [usage, setUsage] = useState({})
	const [page, setPage] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		async function loadVehicles() {
			try {
				const data = await obtenerVehiculosUsuario(user.id, page)
				if (!active) return
				setVehicles(data.items); setHasMore(data.hasMore)
				const counts = await contarSolicitudesPorVehiculo(data.items.map((item) => item.id)).catch(() => ({}))
				if (active) setUsage(counts)
			} catch (loadError) {
				if (active) setError(`No se pudieron cargar tus vehículos: ${publicError(loadError)}`)
			} finally {
				if (active) setLoading(false)
			}
		}
		if (user?.id) loadVehicles()
		return () => { active = false }
	}, [user?.id, page])

	return <section className="vehicles-page">
		<div className="vehicles-heading"><div><p className="vehicles-eyebrow">Panel de cliente / Vehículos</p><h1>Mis vehículos</h1></div><Link className="button vehicle-button" to="/cliente/vehiculos/crear"><Icon name="plus" size={18} /> Agregar</Link></div>
		{loading && <SkeletonList label="Cargando tus vehículos…" />}
		{error && <p className="vehicle-error" role="alert">{error}</p>}
		{!loading && !error && vehicles.length === 0 && <div className="vehicle-empty"><h2>No tienes vehículos registrados</h2><p>Agrega tu primer vehículo para pedir repuestos.</p><Link className="button vehicle-button" to="/cliente/vehiculos/crear">Registrar vehículo</Link></div>}
		{!loading && !error && vehicles.length > 0 && <div className="vehicle-rows">{vehicles.map((vehicle) => {
			const requests = usage[vehicle.id] || 0
			return <article className="vehicle-row" key={vehicle.id}>
				<Link className="vehicle-row-main" to={`/cliente/vehiculos/${vehicle.id}`}>
					<span className="vehicle-thumb">{vehicle.fotos?.[0] ? <img src={vehicle.fotos[0]} alt="" loading="lazy" /> : <Icon name="vehicle" size={24} />}</span>
					<span className="vehicle-row-text">
						<strong>{vehicleName(vehicle)}</strong>
						<span>{[vehicle.anio, vehicle.tipoNombre].filter(Boolean).join(' · ')}{requests > 0 ? ` · ${requests} ${requests === 1 ? 'solicitud' : 'solicitudes'}` : ''}</span>
					</span>
				</Link>
				<div className="vehicle-row-actions">
					<Link className="icon-action" to={`/cliente/vehiculos/${vehicle.id}`} aria-label={`Ver ${vehicleName(vehicle)}`} title="Ver detalles"><Icon name="eye" size={18} /></Link>
					<Link className="icon-action" to={`/cliente/vehiculos/editar/${vehicle.id}`} aria-label={`Editar ${vehicleName(vehicle)}`} title={requests ? 'Editar notas' : 'Editar'}><Icon name="edit" size={18} /></Link>
				</div>
			</article>
		})}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}

export default Vehiculos
