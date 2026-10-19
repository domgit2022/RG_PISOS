-- CreateEnum
CREATE TYPE "FrecuenciaInforme" AS ENUM ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL');

-- AlterTable
ALTER TABLE "configuracion" ADD COLUMN     "frecuenciaInformeVencimientos" "FrecuenciaInforme" NOT NULL DEFAULT 'DIARIO',
ADD COLUMN     "ultimoEnvioInformeVencimientos" TIMESTAMP(3);
