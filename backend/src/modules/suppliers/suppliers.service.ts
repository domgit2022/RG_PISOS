import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";

export async function listSuppliers() {
  return prisma.proveedor.findMany({ orderBy: { nombre: "asc" } });
}

export interface SupplierInput {
  nombre: string;
  cuit?: string | null;
  contactoNombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  condicionesPago?: string | null;
}

export async function createSupplier(input: SupplierInput) {
  if (input.cuit) {
    const existente = await prisma.proveedor.findUnique({ where: { cuit: input.cuit } });
    if (existente) throw new HttpError(409, "Ya existe un proveedor con ese CUIT");
  }
  return prisma.proveedor.create({ data: input });
}

export async function updateSupplier(id: string, input: Partial<SupplierInput> & { activo?: boolean }) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) throw new HttpError(404, "Proveedor no encontrado");

  if (input.cuit && input.cuit !== proveedor.cuit) {
    const existente = await prisma.proveedor.findUnique({ where: { cuit: input.cuit } });
    if (existente) throw new HttpError(409, "Ya existe un proveedor con ese CUIT");
  }

  return prisma.proveedor.update({ where: { id }, data: input });
}
