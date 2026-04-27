# Smart Irrigation Intelligence Platform

A full-stack smart irrigation decision-support platform built with **React Native**, **Expo**, **TypeScript**, **Node.js**, **Express**, **Python**, **PostgreSQL**, and **Prisma**.

The Smart Irrigation Intelligence Platform helps growers and operators make faster, clearer irrigation decisions by combining **live weather data**, **forecast rainfall**, **evapotranspiration estimates**, **crop profiles**, **soil assumptions**, **irrigation methods**, and an explainable recommendation model into site-specific irrigation guidance.

The platform is designed for **remote, cold-climate agriculture in Northern Canada**, where growers may face short growing seasons, limited infrastructure, changing weather, and high costs for hardware-heavy irrigation systems.

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
