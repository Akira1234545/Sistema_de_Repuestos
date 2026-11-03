import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="route-message"><h1>No se pudo mostrar esta página</h1><p>Recarga para recuperar la aplicación. Tus cambios sin guardar podrían necesitar revisión.</p><button className="button" type="button" onClick={() => window.location.reload()}>Recargar página</button></main>
    return this.props.children
  }
}
