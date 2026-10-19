import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { SetupPage } from "@/pages/SetupPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { BatchesPage } from "@/pages/BatchesPage";
import { PricingPage } from "@/pages/PricingPage";
import { SalesPage } from "@/pages/SalesPage";
import { SuppliersPage } from "@/pages/SuppliersPage";
import { PurchaseOrdersPage } from "@/pages/PurchaseOrdersPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { UsersPage } from "@/pages/UsersPage";
import { RemoteScanPage } from "@/pages/RemoteScanPage";
import { RemotePhotoPage } from "@/pages/RemotePhotoPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        {/* Pública: la abre el celular al escanear el QR de vinculación, sin login. */}
        <Route path="/escanear/:token" element={<RemoteScanPage />} />
        <Route path="/foto/:token" element={<RemotePhotoPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/lotes" element={<BatchesPage />} />
            <Route path="/precios" element={<PricingPage />} />
            <Route path="/ventas" element={<SalesPage />} />
            <Route path="/proveedores" element={<SuppliersPage />} />
            <Route path="/ordenes-compra" element={<PurchaseOrdersPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
