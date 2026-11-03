import type { ErrorRequestHandler } from "express";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("Unhandled request error:", error);
  res.status(500).json({ message: "Internal server error." });
};
