## Search any location in the browser

Open the field selector in the dashboard to search for a place or street address worldwide. You can also enter exact `latitude, longitude` coordinates (for example `43.4516, -80.4925`) to choose a rural site not listed by a geocoder. Search uses OpenStreetMap-derived Photon results, with an Open-Meteo geocoding fallback. Public demo geocoding has fair-use and availability limits.

When you choose a location, the satellite tiles, current forecast, soil-moisture scenario, and **single-location irrigation forecast card** all switch to those coordinates. The five preset locations remain available. New locations inherit the previous crop and area *assumptions*; you can adjust them in the Field Overview. Custom searches are processed in your browser and **are not saved into Neon**.

For one of the two Neon sample farms with a current model record, the forecast card shows that specific stored result. For other locations, the card transparently shows a live browser-side simplified irrigation estimate, **not** a persisted Python/Neon record. If weather retrieval fails, no live estimate is presented as a real forecast.

---

## Current demo data and location imagery

The public web interface uses actual satellite raster tiles from Esri World Imagery for the approximate latitude/longitude of each of its five illustrative sites. These points are not verified real-world farm parcels. The imagery is fetched from Esri as needed when selecting a site, with attribution and a map link.

The API runs a separate **weather-balance service** for the hosted demo. It fetches up to 14 past and 7 forecast days from Open-Meteo, computes an educational irrigation estimate based on the same simplified formula used in the Python implementation, and stores the result in Neon PostgreSQL. The hosted version uses **estimated soil profiles**, not real soil sensors. It cannot replace farm management decisions.

The API's Vercel project has a daily cron configured at 10:00 UTC to GET `/api/cron/refresh`. That endpoint requires a **production-only, encrypted `CRON_SECRET`** of at least 32 characters. Vercel supplies the secret in the Authorization bearer header when invoking Cron. Do not place credentials in GitHub or expose the cron endpoint without this check.

The original Python ETL remains in `backend/data_pipeline` for independent batch execution and validation. Stored rows indicate their own `model_version`, so the UI does not incorrectly attribute the hosted Node service's output to Python. Never show empty or outdated database records as measured field recommendations.

---

## Full-stack hosting

The Vercel web dashboard is deployed independently from the Express API and Python ETL.

**Public API**: A second Vercel project builds from the repository's `backend/` root. Production mode exposes `GET /api/health` and `GET /api/public/pipeline` only. Legacy unauthenticated CRUD routes remain available for local development but are deliberately absent in production.

**PostgreSQL**: Provision a managed PostgreSQL instance (for example Neon) in the same or a nearby region as the API. Use a pooled connection string for the serverless API and a direct connection string for migrations and the ETL runner. Keep them in provider-managed secret settings, never in the repository.

**Migration and initial data**: The separate Python pipeline uses `backend/data_pipeline/sql/001_pipeline_tables.sql`. It creates its own tables, adds an idempotent unique index, and seeds illustrative public demo farms if the pipeline table is empty. Existing Prisma-based mobile tables are separate: apply `npx prisma migrate deploy` from `backend/` only if those native app tables are needed. Run migrations against an empty or carefully reviewed database, not an unknown production database with existing rows.

**Pipeline execution**: In GitHub, create a protected environment called `irrigation-pipeline` and add `PIPELINE_DATABASE_URL` as an encrypted environment secret. Run `Run irrigation ETL (manual)` once from the Actions tab to validate its full flow. The workflow is intentionally manual until the database is connected, tested, and approved for scheduled runs.

**Public provenance**: Only demo IDs beginning with `demo-` are returned by the public API. Exposed features are limited to modeled recommendations, location labels, and high-level metrics. "Data completeness" is not prediction confidence. Actual sensors are not connected. The public web dashboard currently runs its own weather-driven demonstration until the database connection and API UI are validated.

### Verify the backend locally

```bash
cd backend
npm ci
npm run build
npm run test:api
npm run dev
```

### Run the pipeline in a configured environment

```bash
cd backend/data_pipeline
python -m pip install -r requirements.txt
python run_pipeline.py
```

The pipeline reads the `DATABASE_URL` environment variable. No database credentials belong in the codebase.

---

# Smart Irrigation Intelligence Platform

A full-stack smart irrigation decision-support platform built with **React Native**, **Expo**, **TypeScript**, **Node.js**, **Express**, **Python**, **PostgreSQL**, and **Prisma**.

The Smart Irrigation Intelligence Platform helps growers and operators make faster, clearer irrigation decisions by combining **live weather data**, **forecast rainfall**, **evapotranspiration estimates**, **crop profiles**, **soil assumptions**, **irrigation methods**, and an explainable recommendation model into site-specific irrigation guidance.

The platform is designed for **remote, cold-climate agriculture in Northern Canada**, where growers may face short growing seasons, limited infrastructure, changing weather, and high costs for hardware-heavy irrigation systems.

---

## Live browser demo

**Production:** https://smart-irrigation-platform-eight.vercel.app/

The public website is an interactive portfolio demonstration, built from the Expo web target and deployed as a static site on Vercel.

- Weather data: Open-Meteo 14-day forecasts, fetched in the visitor's browser for the selected sample location. An explicit sample fallback is shown if the weather API is unavailable.
- Weather attribution: [Open-Meteo](https://open-meteo.com/), CC BY 4.0. The free endpoint is intended for non-commercial use subject to [Open-Meteo's terms](https://open-meteo.com/en/terms).
- Soil moisture: **simulated**, not measured. Sample farms and initial moisture percentages are illustrative. The 250 mm root zone, rainfall efficiency and 30% stress threshold are simplified assumptions.
- Irrigation estimate: an educational, simplified weather-based water-balance model. It is **not** the validated production Python data pipeline, does not represent a soil sensor feed, and must not be relied upon for farm operations.
- Production Express + Prisma + PostgreSQL and the Python ETL remain in \`backend/\`. They are separate from the public static demonstration and require a provisioned database, running backend and pipeline scheduling before they can serve real site records.

### Develop and verify the website

\`\`\`bash
npm ci
npm run web
npm run typecheck
npm run test:scenarios
npm run build:web
\`\`\`

Vercel uses the \`npm run build:web\` command and publishes \`dist/\`. Merging a pull request into \`main\` deploys the website automatically.

---

## Overview

Water management is one of the most important variables in agriculture. Too little irrigation can stress crops and reduce yield. Too much irrigation wastes water, energy, and labor.

This project shows how a software-first irrigation platform can turn environmental data into practical operational guidance.

The platform is built around one core idea:

> Give each growing site a clear irrigation action based on current conditions, forecast risk, crop needs, and site-specific constraints.

Instead of forcing users to interpret raw weather dashboards, the app translates environmental and agronomic inputs into clear recommendations such as:

- whether irrigation is needed
- how urgent the action is
- how many millimetres of water to apply
- the estimated water volume required
- when irrigation should begin
- why the recommendation was generated

---

## Problem It Solves

Traditional irrigation planning is often reactive, manual, and inconsistent. Growers may rely on fixed schedules, rough estimates, or delayed weather information.

This creates several problems:

- overwatering and water waste
- underwatering during hot, dry, or windy periods
- weak adaptation to short-term forecast changes
- limited visibility across multiple growing sites
- poor connection between weather data and field-level decisions
- high cost and complexity from hardware-heavy irrigation systems

The Smart Irrigation Intelligence Platform addresses these problems by combining weather intelligence, site profiles, a data pipeline, and an explainable recommendation model in one application.

---

## Project Goals

The project is designed to demonstrate how irrigation guidance can be delivered as a practical software product.

Its main goals are to:

- provide live, site-specific weather intelligence
- support multiple growing sites
- store site, crop, soil, weather, and recommendation data
- process weather and forecast data through a Python data pipeline
- generate explainable irrigation recommendations
- estimate urgency, irrigation depth, water volume, and recommended timing
- reduce dependence on expensive field hardware
- create a foundation for future sensor, satellite, analytics, and ML-based calibration features

---

## Core Features

### 1. Operational Dashboard

The dashboard acts as the main command center.

It provides:

- a high-level overview of irrigation operations
- total active sites
- high-priority irrigation alerts
- recommended water totals
- average model score
- top action item for the day
- per-site irrigation summaries
- explanation drivers behind each recommendation

The goal is to answer:

**What should I do today, and where should I focus first?**

---

### 2. Multi-Site Farm Management

The platform supports multiple growing sites.

Users can manage:

- site name
- location label
- latitude and longitude
- field area
- crop type
- soil profile
- irrigation method
- environment type
- planting or growing context
- custom user-created sites

The app uses this information to generate site-specific recommendations instead of giving generic irrigation advice.

---

### 3. Live Weather Intelligence

Each site can use live weather and forecast information.

The weather layer can include:

- current temperature
- humidity
- wind speed
- daily high and low temperature
- current precipitation
- forecast precipitation
- sunrise and sunset
- short-term hourly forecast
- evapotranspiration estimates

Weather data provides the foundation for the recommendation model.

---

### 4. Python Data Pipeline

The project includes a Python-based data pipeline for preparing weather and forecast data for irrigation analysis.

The pipeline is designed to:

- fetch weather and forecast data from external APIs
- normalize API responses into a consistent format
- clean missing or unusual values
- store raw weather snapshots
- calculate derived irrigation features
- prepare model-ready inputs
- support recommendation traceability
- enable future historical analysis and model calibration

Example pipeline stages:

```text
Fetch weather data
        ↓
Clean and normalize data
        ↓
Generate irrigation features
        ↓
Run recommendation model
        ↓
Store outputs in PostgreSQL
        ↓
Serve recommendations through the backend API
