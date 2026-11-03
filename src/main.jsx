import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/shell.css'
import './styles/pages.css'
import './styles/admin.css'
import './styles/home.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<AppErrorBoundary><App /></AppErrorBoundary>
	</StrictMode>,
)
