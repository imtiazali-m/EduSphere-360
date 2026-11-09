import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './styles.css'
import './styles/pro-dashboard.css'
import './styles/premium-refinement.css'
import './styles/module-workspaces.css'
import './styles/operational-hierarchy.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
