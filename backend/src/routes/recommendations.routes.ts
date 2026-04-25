import { Router } from "express";
import { prisma } from "../lib/prisma";
import { buildRecommendation } from "../services/recommendation.service";
import { fetchWeatherForSite } from "../services/weather.service";

const router = Router();

function getRecentCutoffDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function buildLiveRecommendationForSite(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });

  if (!site) {
    return null;
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

  const recommendation = buildRecommendation({
    site,
    weather,
    recentIrrigationLogs,
  });

  return {
    site,
    weather,
    recentIrrigationLogs,
    recommendation,
  };
}

router.get("/site/:siteId", async (req, res, next) => {
  try {
    const result = await buildLiveRecommendationForSite(req.params.siteId);

    if (!result) {
      res.status(404).json({ error: "Site not found" });
      return;
    }

    res.json({
      site: {
        id: result.site.id,
        name: result.site.name,
        locationLabel: result.site.locationLabel,
        cropType: result.site.cropType,
        environment: result.site.environment,
        irrigationMethod: result.site.irrigationMethod,
        soilType: result.site.soilType,
        areaHa: result.site.areaHa,
      },
      recommendation: result.recommendation,
      weather: result.weather,
      recentIrrigationLogs: result.recentIrrigationLogs,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/site/:siteId/snapshot", async (req, res, next) => {
  try {
    const result = await buildLiveRecommendationForSite(req.params.siteId);

    if (!result) {
      res.status(404).json({ error: "Site not found" });
      return;
    }

    const snapshot = await prisma.recommendationSnapshot.create({
      data: {
        siteId: result.site.id,
        headline: result.recommendation.headline,
        actionLabel: result.recommendation.actionLabel,
        startBy: result.recommendation.startBy,
        urgency: result.recommendation.urgency,
        riskBand: result.recommendation.riskBand,
        recommendedMm: result.recommendation.recommendedMm,
        recommendedLitres: result.recommendation.recommendedLitres,
        modelScore: result.recommendation.modelScore,
        summary: result.recommendation.summary,
        reasonsJson: JSON.stringify(result.recommendation.reasons),
      },
    });

    res.status(201).json({
      snapshot,
      recommendation: result.recommendation,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/site/:siteId/snapshots", async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.siteId },
    });

    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }

    const snapshots = await prisma.recommendationSnapshot.findMany({
      where: {
        siteId: site.id,
      },
      orderBy: {
        capturedAt: "desc",
      },
      take: 30,
    });

    res.json(
      snapshots.map((snapshot) => ({
        ...snapshot,
        reasons: JSON.parse(snapshot.reasonsJson),
      }))
    );
  } catch (error) {
    next(error);
  }
});

export default router;