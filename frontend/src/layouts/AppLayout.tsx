import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Package,
  Layers,
  Tag,
  ShoppingCart,
  Truck,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useBranding } from "@/hooks/useBranding";
import { ConexionServidor } from "@/components/ConexionServidor";
import logoFallback from "@/assets/logo-rgpisos.png";

const navItems = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true, permiso: null },
  { to: "/inventario", labelKey: "nav.inventory", icon: Package, end: false, permiso: null },
  { to: "/lotes", labelKey: "nav.batches", icon: Layers, end: false, permiso: null },
  { to: "/precios", labelKey: "nav.pricing", icon: Tag, end: false, permiso: null },
  { to: "/ventas", labelKey: "nav.sales", icon: ShoppingCart, end: false, permiso: null },
  { to: "/proveedores", labelKey: "nav.suppliers", icon: Truck, end: false, permiso: "proveedores.gestionar" },
  {
    to: "/ordenes-compra",
    labelKey: "nav.purchaseOrders",
    icon: ClipboardList,
    end: false,
    permiso: "proveedores.gestionar",
  },
  { to: "/reportes", labelKey: "nav.reports", icon: BarChart3, end: false, permiso: "reportes.ver" },
  { to: "/usuarios", labelKey: "nav.users", icon: Users, end: false, permiso: "usuarios.gestionar" },
  { to: "/configuracion", labelKey: "nav.settings", icon: Settings, end: false, permiso: "configuracion.gestionar" },
] as const;

export function AppLayout() {
  const { t } = useTranslation();
  const usuario = useAuthStore((s) => s.usuario);
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const tienePermiso = useAuthStore((s) => s.tienePermiso);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { logoUrl, nombreComercial } = useBranding();
  const logoSrc = logoUrl ?? logoFallback;

  const itemsVisibles = navItems.filter((item) => !item.permiso || tienePermiso(item.permiso));

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Barra superior: solo mobile (<768px) */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-outline-variant/40 bg-surface-container-lowest px-4 md:hidden">
        <button
          onClick={() => setMenuAbierto(true)}
          aria-label={t("nav.openMenu")}
          className="text-on-surface-variant"
        >
          <Menu size={22} />
        </button>
        <img src={logoSrc} alt={nombreComercial} className="h-10 w-auto max-w-[140px] object-contain" />
        <div className="w-[22px]" />
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMenuAbierto(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col justify-between overflow-y-auto border-r border-outline-variant/40 bg-surface-container-lowest px-4 py-6 transition-transform duration-200 md:static md:z-auto md:w-20 md:translate-x-0 md:px-2 lg:w-64 lg:px-4 ${
          menuAbierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="mb-6 flex items-center justify-between py-2 md:justify-center">
            <img src={logoSrc} alt={nombreComercial} className="h-16 w-auto max-w-[200px] object-contain md:h-12 lg:h-20" />
            <button onClick={() => setMenuAbierto(false)} className="text-on-surface-variant md:hidden" aria-label={t("common.close")}>
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            {itemsVisibles.map(({ to, labelKey, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuAbierto(false)}
                title={t(labelKey)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:justify-center lg:justify-start ${
                    isActive
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="md:hidden lg:inline">{t(labelKey)}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="border-t border-outline-variant/40 pt-4">
          <p className="truncate px-2 text-sm font-medium md:hidden lg:block">{usuario?.nombreCompleto}</p>
          <p className="truncate px-2 text-xs text-on-surface-variant md:hidden lg:block">{usuario?.rol}</p>
          <button
            onClick={cerrarSesion}
            title={t("nav.logout")}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low md:justify-center lg:justify-start"
          >
            <LogOut size={16} className="shrink-0" />
            <span className="md:hidden lg:inline">{t("nav.logout")}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 pt-20 sm:p-6 md:p-8 md:pt-8">
        <ConexionServidor />
        <Outlet />
      </main>
    </div>
  );
}
