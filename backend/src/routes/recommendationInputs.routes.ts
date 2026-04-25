import { Router } from "express";
import { prisma } from "../lib/prisma";
import { fetchWeatherForSite } from "../services/weather.service";

const router = Router();

function getRecentCutoffDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

router.get("/site/:siteId", async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.siteId },
    });

    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }

    const weather = await fetchWeatherForSite({
      siteId: site.id,
      latitude: site.latitude,
      longitude: site.longitude,
    });

    const recentIrrigationLogs = await prisma.irrigationLog.findMany({
      where: {
        siteId: site.id,
        performedAt: {
          gte: getRecentCutoffDate(7),
        },
      },
      orderBy: {
        performedAt: "desc",
      },
    });

    res.json({
      site,
      weather,
      recentIrrigationLogs,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;