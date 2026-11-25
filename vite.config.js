import react from '@vitejs/plugin-react'
import process from 'node:process'
import { defineConfig } from 'vite'

// Versión de la web empaquetada. GitHub Actions la fija con el commit; en local queda «dev».
// La app Android la compara con la publicada para saber si hay una actualización (src/lib/liveUpdate.js).
const appVersion = process.env.VITE_APP_VERSION || 'dev'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
})
