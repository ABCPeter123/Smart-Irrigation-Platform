import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Request failed:", err);

  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error ? err.message : "Internal server error";

  res.status(500).json({
    error: message,
  });
}