-- Normaliza el stock al modelo material + almacén + lote + vencimiento:
--   * Sin control de lote no se guarda número de lote; sin control de vencimiento, no hay fecha.
--   * Un número de lote tiene una sola fecha de vencimiento por material.
--   * Hay un único registro por material + almacén + lote + vencimiento (los ingresos se acumulan).

-- 2) Números de lote sin espacios; vacío = sin lote
UPDATE "lotes" SET "numeroLote" = NULLIF(btrim("numeroLote"), '')
WHERE "numeroLote" IS NOT NULL;

-- 3) Sin control de lote: sin número de lote
UPDATE "lotes" l SET "numeroLote" = NULL
FROM "productos" p
WHERE p."id" = l."productoId" AND p."controlaLote" = false AND l."numeroLote" IS NOT NULL;

-- 4) Sin control de vencimiento: sin fecha
UPDATE "lotes" l SET "fechaVencimiento" = NULL
FROM "productos" p
WHERE p."id" = l."productoId" AND p."controlaVencimiento" = false
  AND l."fechaVencimiento" IS NOT NULL;

-- 5) Con control de lote pero cargados sin número: "S/L" (+ fecha si tiene)
UPDATE "lotes" l
SET "numeroLote" = 'S/L' || COALESCE('-' || to_char(l."fechaVencimiento", 'YYYYMMDD'), '')
FROM "productos" p
WHERE p."id" = l."productoId" AND p."controlaLote" = true AND l."numeroLote" IS NULL;

-- 6) Un mismo número de lote con varias fechas: se separa agregando la fecha
UPDATE "lotes" l
SET "numeroLote" = l."numeroLote" || '-' || to_char(l."fechaVencimiento", 'YYYYMMDD')
FROM (
  SELECT "productoId", "numeroLote"
  FROM "lotes"
  WHERE "numeroLote" IS NOT NULL
  GROUP BY "productoId", "numeroLote"
  HAVING COUNT(DISTINCT "fechaVencimiento") > 1
) c
WHERE l."productoId" = c."productoId" AND l."numeroLote" = c."numeroLote"
  AND l."fechaVencimiento" IS NOT NULL;

-- 7) Unificar registros duplicados de material + almacén + lote + vencimiento
CREATE TEMP TABLE "_lotes_merge" AS
SELECT "id",
       FIRST_VALUE("id") OVER (
         PARTITION BY "productoId", "almacenId", COALESCE("numeroLote", ''), "fechaVencimiento"
         ORDER BY "fechaIngreso", "id"
       ) AS "keepId"
FROM "lotes";

DELETE FROM "_lotes_merge" WHERE "id" = "keepId";

UPDATE "lotes" k SET
  "cantidadActual"  = s."cantidadActual",
  "cantidadInicial" = s."cantidadInicial",
  "costoUnitario"   = s."costoUnitario",
  "ubicacionId"     = COALESCE(k."ubicacionId", s."ubicacionId"),
  "updatedAt"       = CURRENT_TIMESTAMP
FROM (
  SELECT g."keepId",
         SUM(l."cantidadActual")  AS "cantidadActual",
         SUM(l."cantidadInicial") AS "cantidadInicial",
         CASE WHEN SUM(l."cantidadActual") > 0
              THEN SUM(l."cantidadActual" * l."costoUnitario") / SUM(l."cantidadActual")
              ELSE MAX(l."costoUnitario") END AS "costoUnitario",
         MAX(l."ubicacionId") AS "ubicacionId"
  FROM (SELECT "id", "keepId" FROM "_lotes_merge"
        UNION ALL
        SELECT DISTINCT "keepId", "keepId" FROM "_lotes_merge") g
  JOIN "lotes" l ON l."id" = g."id"
  GROUP BY g."keepId"
) s
WHERE k."id" = s."keepId";

UPDATE "movimientos_stock" m SET "loteId" = g."keepId"
FROM "_lotes_merge" g WHERE m."loteId" = g."id";

UPDATE "alertas" a SET "loteId" = g."keepId"
FROM "_lotes_merge" g WHERE a."loteId" = g."id";

DELETE FROM "lotes" l USING "_lotes_merge" g WHERE l."id" = g."id";

DROP TABLE "_lotes_merge";
