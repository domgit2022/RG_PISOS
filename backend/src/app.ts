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

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(morgan(isProduction ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
