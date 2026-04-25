/*
  Warnings:

  - You are about to drop the column `sensorMoisturePct` on the `Site` table. All the data in the column will be lost.
  - Made the column `connectedProbes` on table `Site` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Site" DROP COLUMN "sensorMoisturePct",
ALTER COLUMN "connectedProbes" SET NOT NULL,
ALTER COLUMN "connectedProbes" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "WeatherCache" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeatherCache_siteId_key" ON "WeatherCache"("siteId");

-- CreateIndex
CREATE INDEX "WeatherCache_expiresAt_idx" ON "WeatherCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "WeatherCache" ADD CONSTRAINT "WeatherCache_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
