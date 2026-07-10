import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/global.css'
import { App } from './App'
import { initTheme } from './suite/theme'
import { StoreProvider } from './suite/data/store'
import { AuthProvider, RequireAuth, RequireAdmin } from './suite/auth/auth'
import { ToastProvider } from './suite/components/ui/Toast'
import { Login } from './suite/pages/Auth/Login'
import { Signup } from './suite/pages/Auth/Signup'
import { SuiteApp } from './suite/SuiteApp'
import { Dashboard } from './suite/pages/Dashboard/Dashboard'
import { DesignStudio } from './suite/pages/DesignStudio/DesignStudio'
import { GarmentLab } from './suite/pages/GarmentLab/GarmentLab'
import { GarmentsHome } from './suite/pages/Garments/GarmentsHome'
import { PatternStudio } from './suite/pages/PatternStudio/PatternStudio'
import { AIDesigner } from './suite/pages/AIDesigner/AIDesigner'
import { TechPacks } from './suite/pages/TechPacks/TechPacks'
import { Manufacturers } from './suite/pages/Manufacturers/Manufacturers'
import { Production } from './suite/pages/Production/Production'
import { Collections } from './suite/pages/Collections/Collections'
import { Community } from './suite/pages/Community/Community'
import { Marketplace } from './suite/pages/Marketplace/Marketplace'
import { GarmentShop } from './suite/pages/Shop/GarmentShop'
import { Analytics } from './suite/pages/Analytics/Analytics'
import { Settings } from './suite/pages/Settings/Settings'
import { AdminApp } from './suite/admin/AdminApp'
import { AdminOverview } from './suite/admin/pages/AdminOverview'
import { AdminGarments } from './suite/admin/pages/AdminGarments'
import { AdminUsers } from './suite/admin/pages/AdminUsers'
import { AdminDesigns } from './suite/admin/pages/AdminDesigns'
import { AdminManufacturers } from './suite/admin/pages/AdminManufacturers'
import { AdminOrders } from './suite/admin/pages/AdminOrders'
import { AdminSettings } from './suite/admin/pages/AdminSettings'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<App />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Full-screen editor (auth required) */}
              <Route
                path="/suite/design"
                element={
                  <RequireAuth>
                    <DesignStudio />
                  </RequireAuth>
                }
              />
              <Route
                path="/suite/garment-lab/:garmentId"
                element={
                  <RequireAuth>
                    <GarmentLab />
                  </RequireAuth>
                }
              />

              {/* Suite (auth required) */}
              <Route
                path="/suite"
                element={
                  <RequireAuth>
                    <SuiteApp />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="garments" element={<GarmentsHome />} />
                <Route path="shop" element={<GarmentShop />} />
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

              {/* Admin (admin role required) */}
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminApp />
                  </RequireAdmin>
                }
              >
                <Route index element={<AdminOverview />} />
                <Route path="garments" element={<AdminGarments />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="designs" element={<AdminDesigns />} />
                <Route path="manufacturers" element={<AdminManufacturers />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
)
