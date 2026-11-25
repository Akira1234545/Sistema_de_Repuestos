import { supabase } from './supabase.js'

function firstRow({ data, error }) {
	if (error) throw error
	return data?.[0] || null
}

export async function obtenerResumenCliente() {
	if (!supabase) throw new Error('Supabase no está configurado.')
	return firstRow(await supabase.rpc('client_dashboard_stats'))
}

export async function obtenerResumenTienda() {
	if (!supabase) throw new Error('Supabase no está configurado.')
	return firstRow(await supabase.rpc('store_dashboard_stats'))
}

// Daily counts for the panel trends: 2 × days points per series (previous and current period).
export async function obtenerSeriesPanel(dias) {
	if (!supabase) throw new Error('Supabase no está configurado.')
	const { data, error } = await supabase.rpc('dashboard_series', { p_dias: dias })
	if (error) throw error
	return data || []
}
