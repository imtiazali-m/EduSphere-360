import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './styles.css'
import './styles/pro-dashboard.css'
import './styles/premium-refinement.css'
import './styles/module-workspaces.css'
import './styles/operational-hierarchy.css'
import './styles/institutional-premium.css'
import './styles/design-system.css'
import './styles/visual-refresh.css'
import './styles/navigation-refinement.css'
import './styles/student-admission-workspace.css'
import './styles/examination-workspace.css'
import './styles/dashboard-display-settings.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
