-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationLabel" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "areaHa" DOUBLE PRECISION NOT NULL,
    "cropType" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "irrigationMethod" TEXT NOT NULL,
    "soilType" TEXT NOT NULL,
    "connectedProbes" INTEGER,
    "sensorMoisturePct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrigationLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "appliedMm" DOUBLE PRECISION NOT NULL,
    "appliedLitres" DOUBLE PRECISION NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrrigationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "moisturePct" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationSnapshot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "actionLabel" TEXT NOT NULL,
    "startBy" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "riskBand" TEXT NOT NULL,
    "recommendedMm" DOUBLE PRECISION NOT NULL,
    "recommendedLitres" DOUBLE PRECISION NOT NULL,
    "modelScore" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "reasonsJson" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationSnapshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IrrigationLog" ADD CONSTRAINT "IrrigationLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationSnapshot" ADD CONSTRAINT "RecommendationSnapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
