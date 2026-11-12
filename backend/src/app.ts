import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import healthRoutes from "./routes/health.routes";
import publicPipelineRoutes from "./routes/publicPipeline.routes";
import cronRoutes from "./routes/cron.routes";

// Public deployments expose read-only endpoints only.
export const app = express();
app.disable("x-powered-by");
app.use(cors({
  origin: env.clientOrigin === "*" ? true : env.clientOrigin,
  methods: env.publicReadOnly ? ["GET", "HEAD", "OPTIONS"] : ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "32kb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Smart Irrigation API",
    version: "2.0.0",
    mode: env.publicReadOnly ? "public-read-only" : "local-development",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/public", publicPipelineRoutes);
app.use("/api/cron", cronRoutes);

if (!env.publicReadOnly) {
  // The existing mobile CRUD API stays available for local development.
  // Never expose its unauthenticated mutations in a public deployment.
  const irrigationLogsRoutes = require("./routes/irrigationLogs.routes").default;
  const recommendationInputsRoutes = require("./routes/recommendationInputs.routes").default;
  const recommendationsRoutes = require("./routes/recommendations.routes").default;
  const sitesRoutes = require("./routes/sites.routes").default;
  const weatherRoutes = require("./routes/weather.routes").default;

  app.use("/api/sites", sitesRoutes);
  app.use("/api/irrigation-logs", irrigationLogsRoutes);
  app.use("/api/weather", weatherRoutes);
  app.use("/api/recommendation-inputs", recommendationInputsRoutes);
  app.use("/api/recommendations", recommendationsRoutes);
}

app.use(notFound);
app.use(errorHandler);

// Express on Vercel uses the default-exported application.
export default app;
