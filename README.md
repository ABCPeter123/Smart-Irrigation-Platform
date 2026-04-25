# Smart Irrigation Platform

An intelligent mobile irrigation decision-support app built with **Expo**, **React Native**, and **TypeScript**.

The Smart Irrigation Platform helps growers and operators make faster, smarter irrigation decisions by combining **live weather data**, **hourly evapotranspiration (ET)**, **crop profiles**, **soil characteristics**, **irrigation methods**, and **optional soil moisture readings** into clear, site-specific recommendations.

---

## Overview

Water management is one of the most important variables in agriculture. Too little irrigation can reduce yield and stress crops; too much irrigation wastes water, energy, and labor. This project was built to show how a modern mobile app can turn environmental data into practical irrigation guidance that is simple enough to use in the field.

The platform is designed around one core idea:

> **Give each site a clear irrigation action based on what is happening now and what is likely to happen next.**

Instead of making users interpret raw weather dashboards on their own, the app translates data into operational guidance such as:

- how much water to apply
- how urgent the action is
- when irrigation should begin
- why the recommendation was generated

---

## Problem It Solves

Traditional irrigation planning is often reactive, manual, and inconsistent. Farmers and greenhouse operators may rely on rough estimates, generic schedules, or delayed weather information. That creates several problems:

- overwatering and water waste
- underwatering during hot or windy periods
- poor adaptation to changing weather
- limited visibility across multiple growing sites
- weak integration between forecast data and real field decisions

The Smart Irrigation Platform addresses this by centralizing **weather intelligence**, **site profiles**, and **recommendation logic** into one mobile experience.

---

## Project Goals

This app was developed to demonstrate how a smart irrigation system can be turned into a polished, practical mobile product.

Its main goals are:

- provide **live, site-specific weather intelligence**
- generate **actionable irrigation recommendations**
- support **multiple agricultural sites**
- allow users to **add custom locations manually or from device location**
- combine agronomic logic with an intuitive mobile interface
- create a strong foundation for future expansion into sensors, alerts, analytics, and backend-connected farm operations

---

## Core Features

### 1. Operational Dashboard
The dashboard serves as the command center of the app.

It provides:
- a high-level overview of irrigation operations
- a top-priority recommended action for the day
- site switching across all active sites
- quick summary metrics for recommendations and model confidence
- a decision summary for the selected site
- a breakdown of the main drivers behind the recommendation

This gives users an immediate answer to the question:

**“What should I do today, and where should I focus first?”**

---

### 2. Site Management
The platform supports both built-in demo sites and user-created sites.

Users can:
- browse available irrigation sites
- select the active site used across the app
- add a site manually by entering:
  - site name
  - location label
  - latitude
  - longitude
  - area in hectares
  - crop type
  - environment type
  - irrigation method
  - soil type
- create a site from the phone’s current GPS location
- remove custom sites

This makes the app flexible enough for testing, demos, and future real-world deployment.

---

### 3. Live Weather Intelligence
Each site pulls live weather data and forecast information.

The weather experience includes:
- current weather conditions
- daily high and low temperature
- daily precipitation summary
- sunrise and sunset data
- next-24-hour hourly forecast
- hourly precipitation probability
- hourly evapotranspiration values

This weather layer is what powers the recommendation engine and makes the app feel operational rather than static.

---

### 4. Recommendation Engine
The core of the app is its recommendation model.

For each site, the app generates:
- a recommendation headline
- an irrigation action label
- urgency level (**Low**, **Medium**, or **High**)
- risk band (**Stable**, **Watch**, or **Priority**)
- recommended irrigation depth in **mm**
- estimated delivery volume in **litres**
- suggested action timing
- model confidence score
- a plain-language explanation of the drivers behind the decision

This transforms raw environmental inputs into clear decisions that users can trust and act on quickly.

---

### 5. Configuration / Settings View
The settings screen presents the app’s operating profile and model context, including platform configuration and recommendation inputs.

This screen is useful for showing that the platform is not just a UI demo — it has a defined operating model and data logic behind it.

---

## How the Recommendation Logic Works

The recommendation engine is designed to be understandable, practical, and extensible.

It considers factors such as:

- **crop water demand**
- **hourly evapotranspiration**
- **forecast precipitation**
- **greenhouse vs. open-field environment**
- **soil reserve behavior**
- **irrigation method limits**
- **current wind conditions**
- **heat load**
- **optional soil moisture sensor readings**

At a high level, the system:

1. estimates short-term crop water demand
2. adjusts for likely rainfall
3. adds environmental stress factors such as heat and wind
4. adjusts based on soil type
5. optionally calibrates using moisture sensor data
6. caps the output based on irrigation method
7. converts the result into both **mm** and **litres**
8. assigns urgency and timing guidance

This creates recommendations that are much more realistic than a fixed watering schedule.

---

## Current Screens

### Dashboard
A polished executive-style overview of irrigation operations, top action items, and recommendation summaries.

### Sites
A site management screen for adding, selecting, and reviewing irrigation locations.

### Weather
A live weather intelligence screen with next-24-hour forecast and ET data by site.

### Recommendations
A dedicated action screen showing site-by-site irrigation guidance with reasoning.

### Settings
A summary of platform configuration, recommendation model framing, and operating assumptions.

---

## Built With

- **Expo**
- **React Native**
- **TypeScript**
- **Expo Router**
- **Open-Meteo API**
- **expo-location**
- **React Navigation**
- **Ionicons**

---

## Tech Stack

### Frontend
- React Native
- Expo
- Expo Router
- TypeScript

### Data & Services
- Open-Meteo forecast API for weather and evapotranspiration
- Device location services through Expo Location

### State Management
- Context-based site management using a custom `SiteProvider`

### Domain Logic
- Custom irrigation recommendation service
- Typed agronomic site and weather models

---

## Project Structure

```bash
Smart-Irrigation-Platform/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── sites.tsx
│   ├── weather.tsx
│   ├── recommendations.tsx
│   └── settings.tsx
├── src/
│   ├── context/
│   ├── data/
│   ├── services/
│   └── types.ts
├── components/
├── constants/
├── hooks/
├── assets/
├── scripts/
├── app.json
├── package.json
└── tsconfig.json
