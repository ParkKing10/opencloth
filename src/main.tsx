import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './styles/global.css'
import { initTheme } from './suite/theme'
import { I18nProvider, LanguagePicker } from '@/i18n'
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
import { Rewards } from './suite/pages/Rewards/Rewards'
import { Pricing } from './suite/pages/Pricing/Pricing'
import { MarketingShell } from './suite/pages/Marketing/MarketingShell'
import { MkHome } from './suite/pages/Marketing/MkHome'
import { MkTemplates } from './suite/pages/Marketing/MkTemplates'
import { MkCharacters } from './suite/pages/Marketing/MkCharacters'
import { MkProducts } from './suite/pages/Marketing/MkProducts'
import { MkCampaigns } from './suite/pages/Marketing/MkCampaigns'
import { MkAssets } from './suite/pages/Marketing/MkAssets'
import { MkBrandKitPage } from './suite/pages/Marketing/MkBrandKit'
import { MkLibrary } from './suite/pages/Marketing/MkLibrary'
import { MkGenerate } from './suite/pages/Marketing/MkGenerate'
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

/** Old bookmarks/deep links: /suite/... → the same path at root. */
function LegacySuiteRedirect() {
  const { pathname, search } = useLocation()
  return <Navigate to={`${pathname.replace(/^\/suite/, '') || '/'}${search}`} replace />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
    <BrowserRouter>
      <StoreProvider>
        <AuthProvider>
          <ToastProvider>
            <PresentationProvider>
            <Routes>
              {/* Public — the suite IS the site now; the old marketing landing is gone. */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/suite/*" element={<LegacySuiteRedirect />} />

              {/* Full-screen editor (auth required). The Design Studio LANDING lives inside the suite
                  shell (see /suite/design below); the editor itself is full-screen at /suite/studio. */}
              <Route
                path="/studio"
                element={
                  <RequireAuth>
                    <StudioMobileGate />
                  </RequireAuth>
                }
              />
              <Route
                path="/garment-lab/:garmentId"
                element={
                  <RequireAuth>
                    <GarmentLabMobileGate />
                  </RequireAuth>
                }
              />

              {/* The suite shell at the root. Guests may browse — any real interaction
                  opens the login/register gate inside SuiteApp. */}
              <Route path="/" element={<SuiteApp />}>
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
                {/* Marketing Studio — the AI marketing department (product-within-the-product). */}
                <Route path="marketing" element={<MarketingShell />}>
                  <Route index element={<MkHome />} />
                  <Route path="templates" element={<MkTemplates />} />
                  <Route path="characters" element={<MkCharacters />} />
                  <Route path="products" element={<MkProducts />} />
                  <Route path="campaigns" element={<MkCampaigns />} />
                  <Route path="assets" element={<MkAssets />} />
                  <Route path="brand" element={<MkBrandKitPage />} />
                  <Route path="library" element={<MkLibrary />} />
                  <Route path="generate" element={<MkGenerate />} />
                </Route>
                <Route path="analytics" element={<Analytics />} />
                <Route path="rewards" element={<Rewards />} />
                <Route path="pricing" element={<Pricing />} />
                <Route path="explainer" element={<RequireAdmin><Explainer /></RequireAdmin>} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
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
            {/* First-visit language gate — asks EN/DE before anything else, once. */}
            <LanguagePicker />
            </PresentationProvider>
          </ToastProvider>
        </AuthProvider>
      </StoreProvider>
    </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
