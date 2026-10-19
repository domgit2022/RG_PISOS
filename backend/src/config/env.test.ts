import assert from "node:assert/strict";
import test from "node:test";

import { parseCorsOrigins } from "./env.js";

test("parseCorsOrigins acepta varios orígenes separados por coma", () => {
  const origins = parseCorsOrigins("http://app.local/, http://localhost:5173");

  assert.equal(origins.includes("http://app.local"), true);
  assert.equal(origins.includes("http://localhost:5173"), true);
});

test("parseCorsOrigins devuelve los orígenes por defecto cuando no viene config", () => {
  assert.deepEqual(parseCorsOrigins(""), [
    "http://localhost:5173",
  ]);
});
