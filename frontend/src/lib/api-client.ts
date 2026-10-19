import axios from "axios";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Sin VITE_API_URL explícito, se arma la URL de la API a partir del host con
 * el que se accedió al frontend (localhost en la PC, la IP de la red local
 * desde el celular), así funciona en ambos casos sin tocar configuración.
 */
function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return `${window.location.protocol}//${window.location.hostname}:4000/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/** Resuelve una URL relativa devuelta por el backend (ej. /uploads/logo.png) contra el origen de la API. */
export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().cerrarSesion();
    }
    return Promise.reject(error);
  }
);
