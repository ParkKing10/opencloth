import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/global.css'
import { App } from './App'
import { SuiteApp } from './suite/SuiteApp'
import { Dashboard } from './suite/pages/Dashboard/Dashboard'
import { DesignStudio } from './suite/pages/DesignStudio/DesignStudio'
import { PatternStudio } from './suite/pages/PatternStudio/PatternStudio'
import { AIDesigner } from './suite/pages/AIDesigner/AIDesigner'
import { TechPacks } from './suite/pages/TechPacks/TechPacks'
import { Manufacturers } from './suite/pages/Manufacturers/Manufacturers'
import { Production } from './suite/pages/Production/Production'
import { Collections } from './suite/pages/Collections/Collections'
import { Community } from './suite/pages/Community/Community'
import { Marketplace } from './suite/pages/Marketplace/Marketplace'
import { Analytics } from './suite/pages/Analytics/Analytics'
import { Settings } from './suite/pages/Settings/Settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Marketing site */}
        <Route path="/" element={<App />} />

        {/* Full-screen editor (no dashboard chrome) */}
        <Route path="/suite/design" element={<DesignStudio />} />

        {/* Dashboard suite shell */}
        <Route path="/suite" element={<SuiteApp />}>
          <Route index element={<Dashboard />} />
          <Route path="pattern" element={<PatternStudio />} />
          <Route path="ai" element={<AIDesigner />} />
          <Route path="tech-packs" element={<TechPacks />} />
          <Route path="manufacturers" element={<Manufacturers />} />
          <Route path="production" element={<Production />} />
          <Route path="collections" element={<Collections />} />
          <Route path="community" element={<Community />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/suite" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
