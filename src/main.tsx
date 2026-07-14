import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/global.css'
import { App } from './App'
import { initTheme } from './suite/theme'
import { I18nProvider } from '@/i18n'
import { StoreProvider } from './suite/data/store'
import { AuthProvider, RequireAuth, RequireAdmin } from './suite/auth/auth'
import { ToastProvider } from './suite/components/ui/Toast'
import { PresentationProvider } from './suite/presentation/PresentationContext'
import { PresentationOverlay } from './suite/presentation/PresentationOverlay'
import { Login } from './suite/pages/Auth/Login'
import { Signup } from './suite/pages/Auth/Signup'
import { SuiteApp } from './suite/SuiteApp'
import { Dashboard } from './suite/pages/Dashboard/Dashboard'
import { StudioMobileGate } from './suite/pages/DesignStudio/StudioMobileGate'
import { DesignStudioLanding } from './suite/pages/DesignStudio/DesignStudioLanding'
import { GarmentLabMobileGate } from './suite/pages/GarmentLab/GarmentLabMobileGate'
import { GarmentsHome } from './suite/pages/Garments/GarmentsHome'
import { AIDesigner } from './suite/pages/AIDesigner/AIDesigner'
import { TechPacks } from './suite/pages/TechPacks/TechPacks'
import { Manufacturers } from './suite/pages/Manufacturers/Manufacturers'
import { Collections } from './suite/pages/Collections/Collections'
import { CollectionDetail } from './suite/pages/Collections/CollectionDetail'
import { Assets } from './suite/pages/Assets/Assets'
import { Community } from './suite/pages/Community/Community'
import { Marketplace } from './suite/pages/Marketplace/Marketplace'
import { GarmentShop } from './suite/pages/Shop/GarmentShop'
import { Analytics } from './suite/pages/Analytics/Analytics'
import { Explainer } from './suite/pages/Explainer/Explainer'
import { Settings } from './suite/pages/Settings/Settings'
import { AdminApp } from './suite/admin/AdminApp'
import { AdminOverview } from './suite/admin/pages/AdminOverview'
import { AdminGarments } from './suite/admin/pages/AdminGarments'
import { AdminAccessories } from './suite/admin/pages/AdminAccessories'
import { AdminUsers } from './suite/admin/pages/AdminUsers'
import { AdminDesigns } from './suite/admin/pages/AdminDesigns'
import { AdminManufacturers } from './suite/admin/pages/AdminManufacturers'
import { AdminOrders } from './suite/admin/pages/AdminOrders'
import { AdminSettings } from './suite/admin/pages/AdminSettings'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
    <BrowserRouter>
      <StoreProvider>
        <AuthProvider>
          <ToastProvider>
            <PresentationProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<App />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Full-screen editor (auth required). The Design Studio LANDING lives inside the suite
                  shell (see /suite/design below); the editor itself is full-screen at /suite/studio. */}
              <Route
                path="/suite/studio"
                element={
                  <RequireAuth>
                    <StudioMobileGate />
                  </RequireAuth>
                }
              />
              <Route
                path="/suite/garment-lab/:garmentId"
                element={
                  <RequireAuth>
                    <GarmentLabMobileGate />
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
                <Route path="design" element={<DesignStudioLanding />} />
                <Route path="garments" element={<GarmentsHome />} />
                <Route path="shop" element={<GarmentShop />} />
                <Route path="ai" element={<AIDesigner />} />
                <Route path="tech-packs" element={<TechPacks />} />
                <Route path="manufacturers" element={<Manufacturers />} />
                <Route path="collections" element={<Collections />} />
                <Route path="collections/:id" element={<CollectionDetail />} />
                <Route path="assets" element={<Assets />} />
                <Route path="community" element={<Community />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="explainer" element={<Explainer />} />
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
                <Route path="accessories" element={<AdminAccessories />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="designs" element={<AdminDesigns />} />
                <Route path="manufacturers" element={<AdminManufacturers />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <PresentationOverlay />
            </PresentationProvider>
          </ToastProvider>
        </AuthProvider>
      </StoreProvider>
    </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
