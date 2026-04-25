import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import healthRoutes from "./routes/health.routes";
import irrigationLogsRoutes from "./routes/irrigationLogs.routes";
import recommendationInputsRoutes from "./routes/recommendationInputs.routes";
import recommendationsRoutes from "./routes/recommendations.routes";
import sitesRoutes from "./routes/sites.routes";
import weatherRoutes from "./routes/weather.routes";

export const app = express();

app.use(
  cors({
    origin: env.clientOrigin === "*" ? true : env.clientOrigin,
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "Northern Irrigation Backend",
    version: "1.0.0",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/sites", sitesRoutes);
app.use("/api/irrigation-logs", irrigationLogsRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/recommendation-inputs", recommendationInputsRoutes);
app.use("/api/recommendations", recommendationsRoutes);

app.use(notFound);
app.use(errorHandler);