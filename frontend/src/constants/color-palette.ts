/**
 * Paleta curada de colores más usados en sistemas de gestión/stock (ERPs,
 * paneles admin, software clínico): azules y teals corporativos para
 * transmitir confianza, verdes/naranjas para estados, y grises neutros.
 * Se ofrece como punto de partida rápido en Configuración, sin obligar
 * a elegir un hex a mano.
 */
export interface ColorSwatch {
  nombre: string;
  hex: string;
}

export const PALETA_COLORES_SUGERIDOS: ColorSwatch[] = [
  { nombre: "Azul clínico", hex: "#00478D" },
  { nombre: "Azul corporativo", hex: "#1D4ED8" },
  { nombre: "Índigo", hex: "#4338CA" },
  { nombre: "Teal", hex: "#006A68" },
  { nombre: "Verde esmeralda", hex: "#047857" },
  { nombre: "Verde lima", hex: "#65A30D" },
  { nombre: "Ámbar", hex: "#D97706" },
  { nombre: "Naranja", hex: "#C2410C" },
  { nombre: "Rojo", hex: "#B91C1C" },
  { nombre: "Rosa", hex: "#BE185D" },
  { nombre: "Púrpura", hex: "#7E22CE" },
  { nombre: "Gris pizarra", hex: "#334155" },
];
