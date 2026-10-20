import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { corsOrigins, env } from "@/config/env.js";
import { apiRouter } from "@/routes/index.js";
import { errorHandler, notFoundHandler } from "@/middleware/error-handler.js";

export const app = express();

const isProduction = env.NODE_ENV === "production";
const allowedOrigins = new Set(corsOrigins);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    if (isProduction) {
      return callback(new Error("Origen no permitido por CORS"));
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(
  helmet({
    // La web compilada se sirve desde este mismo backend (servidor propio)
    // y las imágenes de /uploads se muestran desde el puerto del frontend
    // en desarrollo.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(morgan(isProduction ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", apiRouter);
app.use("/uploads", express.static(env.UPLOADS_DIR, { maxAge: "1h" }));

const indexFrontend = path.join(env.FRONTEND_DIST_DIR, "index.html");
if (fs.existsSync(indexFrontend)) {
  app.use(express.static(env.FRONTEND_DIST_DIR));
  // Rutas del frontend (React Router): cualquier GET que no sea de la API.
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(indexFrontend));
}

app.use(notFoundHandler);
app.use(errorHandler);
