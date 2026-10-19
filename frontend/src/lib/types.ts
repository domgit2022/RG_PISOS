export interface Categoria {
  id: string;
  nombre: string;
  categoriaPadreId: string | null;
}

export interface Producto {
  id: string;
  sku: string;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  categoria: { id: string; nombre: string } | null;
  marca: string | null;
  unidadMedidaId: string;
  unidadMedida: { id: string; nombre: string; codigo: string };
  proveedorPrincipalId: string | null;
  imagenUrl: string | null;
  controlaVencimiento: boolean;
  diasAvisoVencimiento: number;
  controlaLote: boolean;
  stockMinimo: string;
  puntoReposicion: string;
  stockMaximo: string | null;
  /** Ausente si el usuario no tiene permiso "productos.ver_costo" (spec 2.1). */
  costoPromedio?: string;
  activo: boolean;
  stockActual: number;
  aReponer: boolean;
  createdAt: string;
}

export interface ProductosResponse {
  items: Producto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResumenDashboard {
  valorInventario: number;
  productosAReponer: number;
  lotesPorVencer: number;
  totalProductosActivos: number;
}

export interface DetalleProductoPanel {
  productoId: string;
  nombre: string;
  sku: string;
  categoria: string | null;
  unidad: string;
  proveedor: string | null;
  stockActual: number;
  stockMinimo: number;
  puntoReposicion: number;
  aReponer: boolean;
}

export interface DetalleLotePorVencer {
  loteId: string;
  productoId: string;
  nombre: string;
  sku: string;
  numeroLote: string | null;
  fechaVencimiento: string;
  diasRestantes: number;
  cantidad: number;
  stockActual: number;
}

export interface Configuracion {
  id: string;
  nombreComercial: string;
  razonSocial: string | null;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  monedaPredeterminada: "ARS" | "USD" | "EUR";
  formatoFecha: string;
  diasAlertaVencimiento: number;
  frecuenciaInformeVencimientos: "DIARIO" | "SEMANAL" | "QUINCENAL" | "MENSUAL";
  ultimoEnvioInformeVencimientos: string | null;
  idiomaPredeterminado: "ES" | "EN";
}

export interface Traduccion {
  id: string;
  namespace: string;
  clave: string;
  idioma: "ES" | "EN";
  valor: string;
}

export interface Rol {
  id: string;
  nombre: string;
}

export interface Usuario {
  id: string;
  nombreCompleto: string;
  username: string;
  email: string | null;
  activo: boolean;
  recibeAvisosVencimiento: boolean;
  idiomaPreferido: "ES" | "EN" | null;
  ultimoAcceso: string | null;
  createdAt: string;
  rol: { id: string; nombre: string };
}

export interface UnidadMedida {
  id: string;
  codigo: string;
  nombre: string;
}

export interface MedioPago {
  id: string;
  nombre: string;
}

export interface Ubicacion {
  id: string;
  nombre: string;
}

export interface Almacen {
  id: string;
  nombre: string;
  ubicaciones: Ubicacion[];
}

export interface ListaPrecio {
  id: string;
  nombre: string;
  moneda: "ARS" | "USD" | "EUR";
  activa: boolean;
}

export interface Proveedor {
  id: string;
  nombre: string;
  cuit: string | null;
  contactoNombre: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  condicionesPago: string | null;
  activo: boolean;
}

export type EstadoLote = "OK" | "POR_VENCER" | "VENCIDO";

export interface Lote {
  id: string;
  productoId: string;
  almacenId: string;
  numeroLote: string | null;
  fechaVencimiento: string | null;
  fechaIngreso: string;
  cantidadInicial: string;
  cantidadActual: string;
  costoUnitario: string;
  estado: EstadoLote;
  producto: { id: string; nombre: string; sku: string; controlaVencimiento: boolean; controlaLote: boolean };
  almacen: { id: string; nombre: string };
  ubicacion: { id: string; nombre: string } | null;
}

export interface MovimientoStock {
  id: string;
  tipo: string;
  cantidad: string;
  stockResultante: string;
  fecha: string;
  motivo: string | null;
  lote: { numeroLote: string | null; fechaVencimiento: string | null };
  usuario: { nombreCompleto: string };
  almacen: { nombre: string };
}

export interface PrecioProducto {
  id: string;
  precio: string;
  margenPorcentaje: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export interface PrecioListado {
  id: string;
  nombre: string;
  sku: string;
  /** Ausente si el usuario no tiene permiso "productos.ver_costo" (spec 2.1). */
  costoPromedio?: string;
  precioVigente: PrecioProducto | null;
}

export interface DetalleVenta {
  id: string;
  cantidad: string;
  precioUnitario: string;
  subtotal: string;
  producto: { nombre: string; sku: string };
}

export interface Venta {
  id: string;
  fecha: string;
  subtotal: string;
  descuento: string;
  total: string;
  estado: "CONFIRMADA" | "ANULADA";
  motivoAnulacion: string | null;
  cliente: { nombre: string } | null;
  usuario: { nombreCompleto: string };
  listaPrecio: { nombre: string };
  medioPago: { nombre: string };
  detalles: DetalleVenta[];
}

export interface DetalleOrdenCompra {
  id: string;
  cantidadPedida: string;
  cantidadRecibida: string;
  costoUnitarioPactado: string;
  producto: { nombre: string; sku: string };
}

export interface OrdenCompra {
  id: string;
  fecha: string;
  fechaEntregaEstimada: string | null;
  estado: "PENDIENTE" | "RECIBIDA_PARCIAL" | "RECIBIDA_COMPLETA" | "CANCELADA";
  proveedor: { nombre: string };
  detalles: DetalleOrdenCompra[];
}
