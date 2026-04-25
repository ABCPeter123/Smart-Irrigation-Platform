import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const siteSchema = z.object({
  name: z.string().min(1),
  locationLabel: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  areaHa: z.number().positive(),
  cropType: z.string().min(1),
  environment: z.string().min(1),
  irrigationMethod: z.string().min(1),
  soilType: z.string().min(1),
  connectedProbes: z.number().int().nonnegative().optional(),
});

const updateSiteSchema = siteSchema.partial();

router.get("/", async (_req, res) => {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.json(sites);
});

router.get("/:id", async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.id },
    include: {
      irrigationLogs: {
        orderBy: { performedAt: "desc" },
        take: 10,
      },
      recommendationSnapshots: {
        orderBy: { capturedAt: "desc" },
        take: 10,
      },
      weatherCache: true,
    },
  });

  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  res.json(site);
});

router.post("/", async (req, res) => {
  const parsed = siteSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid site payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const site = await prisma.site.create({
    data: {
      connectedProbes: 0,
      ...parsed.data,
    },
  });

  res.status(201).json(site);
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSiteSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid site update payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const existing = await prisma.site.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const updated = await prisma.site.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.site.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  await prisma.site.delete({
    where: { id: req.params.id },
  });

  res.status(204).send();
});

export default router;