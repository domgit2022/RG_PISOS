import { Router } from "express";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth } from "@/middleware/auth.js";
import * as authController from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(authController.postLogin));
authRouter.get("/me", requireAuth, asyncHandler(authController.getMe));
