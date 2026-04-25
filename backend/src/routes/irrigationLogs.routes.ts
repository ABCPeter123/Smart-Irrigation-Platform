import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const createIrrigationLogSchema = z.object({
  siteId: z.string().min(1),
  appliedMm: z.number().positive(),
  appliedLitres: z.number().positive(),
  performedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

router.get("/", async (req, res) => {
  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;

  const logs = await prisma.irrigationLog.findMany({
    where: siteId ? { siteId } : undefined,
    orderBy: { performedAt: "desc" },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          locationLabel: true,
          cropType: true,
        },
      },
    },
  });

  res.json(logs);
});

router.get("/:id", async (req, res) => {
  const log = await prisma.irrigationLog.findUnique({
    where: { id: req.params.id },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          locationLabel: true,
          cropType: true,
        },
      },
    },
  });

  if (!log) {
    res.status(404).json({ error: "Irrigation log not found" });
    return;
  }

  res.json(log);
});

router.post("/", async (req, res) => {
  const parsed = createIrrigationLogSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid irrigation log payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const site = await prisma.site.findUnique({
    where: { id: parsed.data.siteId },
  });

  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const log = await prisma.irrigationLog.create({
    data: {
      siteId: parsed.data.siteId,
      appliedMm: parsed.data.appliedMm,
      appliedLitres: parsed.data.appliedLitres,
      performedAt: parsed.data.performedAt
        ? new Date(parsed.data.performedAt)
        : new Date(),
      notes: parsed.data.notes,
    },
  });

  res.status(201).json(log);
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.irrigationLog.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    res.status(404).json({ error: "Irrigation log not found" });
    return;
  }

  await prisma.irrigationLog.delete({
    where: { id: req.params.id },
  });

  res.status(204).send();
});

export default router;