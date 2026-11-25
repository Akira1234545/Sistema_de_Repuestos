import { useEffect, useState } from 'react'
import { obtenerSeriesPanel } from '../services/dashboardService.js'
import { groupSeries, isMissingRpc } from '../lib/panel.js'
import { useViewMode } from './useViewMode.js'

// Loads dashboard_series for the chosen period (7 or 30 days, remembered on this device).
// `available` turns false when the RPC is not installed yet, so the panel hides the trends.
export function useDashboardSeries(reload = 0) {
	const [period, setPeriod] = useViewMode('panel-period', ['7', '30'], '7')
	const days = Number(period)
	const [state, setState] = useState({ series: null, loading: true, error: null, available: true })

	useEffect(() => {
		let active = true
		Promise.resolve().then(() => { if (active) setState((current) => ({ ...current, loading: true, error: null })) })
		obtenerSeriesPanel(days)
			.then((rows) => { if (active) setState({ series: groupSeries(rows), loading: false, error: null, available: true }) })
			.catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error, available: !isMissingRpc(error) })) })
		return () => { active = false }
	}, [days, reload])

	return { ...state, days, setDays: (value) => setPeriod(String(value)) }
}
