import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/index.css'

// StrictMode is intentionally not used: its double-mount in development would
// spawn and immediately kill an extra shell process for every terminal pane.
createRoot(document.getElementById('root')!).render(<App />)
