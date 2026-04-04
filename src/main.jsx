import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { ToastProvider } from './toast/ToastProvider.jsx'
import { isPerfEnabled, startPerfMonitoring } from './utils/perf.js'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider position="bottom-right">
        <App />
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
)

const splash = document.getElementById('splash')
if (splash) splash.style.display = 'none'

if (isPerfEnabled()) {
  startPerfMonitoring()
}
