import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UsuarioSesion {
  id: string;
  nombreCompleto: string;
  username: string;
  rol: string;
  idiomaPreferido: "ES" | "EN" | null;
  permisos: string[];
}

interface AuthState {
  token: string | null;
  usuario: UsuarioSesion | null;
  setSesion: (token: string, usuario: UsuarioSesion) => void;
  cerrarSesion: () => void;
  tienePermiso: (permiso: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      setSesion: (token, usuario) => set({ token, usuario }),
      cerrarSesion: () => set({ token: null, usuario: null }),
      tienePermiso: (permiso) => get().usuario?.permisos.includes(permiso) ?? false,
    }),
    { name: "rgpisos-auth" }
  )
);
