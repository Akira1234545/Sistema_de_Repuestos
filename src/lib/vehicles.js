export function vehicleName(vehicle) {
	return [vehicle?.marcaNombre, vehicle?.modeloNombre].filter(Boolean).join(' ') || (vehicle?.anio ? `Vehículo de ${vehicle.anio}` : 'Vehículo')
}
