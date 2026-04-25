import { Router } from "express";
import { prisma } from "../lib/prisma";
import { fetchWeatherForSite } from "../services/weather.service";

const router = Router();

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

    res.json(weather);
  } catch (error) {
    next(error);
  }
});

export default router;