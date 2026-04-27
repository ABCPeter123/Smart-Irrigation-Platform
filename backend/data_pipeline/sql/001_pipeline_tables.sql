CREATE TABLE IF NOT EXISTS pipeline_sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    area_hectares DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    crop_type TEXT NOT NULL DEFAULT 'tomatoes',
    soil_type TEXT NOT NULL DEFAULT 'loam',
    irrigation_method TEXT NOT NULL DEFAULT 'drip',
    planting_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_weather_forecast_daily (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    forecast_date DATE NOT NULL,

    temperature_max_c DOUBLE PRECISION,
    temperature_min_c DOUBLE PRECISION,
    precipitation_sum_mm DOUBLE PRECISION,
    precipitation_probability_max_pct DOUBLE PRECISION,
    wind_speed_max_kmh DOUBLE PRECISION,
    et0_fao_mm DOUBLE PRECISION,

    source TEXT NOT NULL DEFAULT 'open-meteo',

    UNIQUE(site_id, forecast_date)
);

CREATE TABLE IF NOT EXISTS raw_weather_history_daily (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    weather_date DATE NOT NULL,

    temperature_max_c DOUBLE PRECISION,
    temperature_min_c DOUBLE PRECISION,
    precipitation_sum_mm DOUBLE PRECISION,
    wind_speed_max_kmh DOUBLE PRECISION,
    et0_fao_mm DOUBLE PRECISION,

    source TEXT NOT NULL DEFAULT 'open-meteo-archive',

    UNIQUE(site_id, weather_date)
);

CREATE TABLE IF NOT EXISTS raw_soil_profiles (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    soil_texture TEXT NOT NULL,
    sand_pct DOUBLE PRECISION,
    silt_pct DOUBLE PRECISION,
    clay_pct DOUBLE PRECISION,
    organic_carbon_g_kg DOUBLE PRECISION,
    bulk_density_kg_m3 DOUBLE PRECISION,
    water_holding_capacity_mm DOUBLE PRECISION,
    infiltration_class TEXT,

    source TEXT NOT NULL DEFAULT 'manual-estimate',

    UNIQUE(site_id)
);

CREATE TABLE IF NOT EXISTS site_features_daily (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    feature_date DATE NOT NULL,

    temperature_max_c DOUBLE PRECISION,
    temperature_min_c DOUBLE PRECISION,
    wind_max_kmh DOUBLE PRECISION,

    rainfall_today_mm DOUBLE PRECISION,
    rainfall_3d_mm DOUBLE PRECISION,
    rainfall_7d_mm DOUBLE PRECISION,
    rainfall_14d_mm DOUBLE PRECISION,

    forecast_rain_24h_mm DOUBLE PRECISION,
    forecast_rain_72h_mm DOUBLE PRECISION,
    precipitation_probability_max_pct DOUBLE PRECISION,

    et0_today_mm DOUBLE PRECISION,
    et0_7d_mm DOUBLE PRECISION,

    crop_type TEXT,
    crop_coefficient DOUBLE PRECISION,
    root_depth_mm DOUBLE PRECISION,

    soil_type TEXT,
    soil_texture TEXT,
    sand_pct DOUBLE PRECISION,
    silt_pct DOUBLE PRECISION,
    clay_pct DOUBLE PRECISION,
    water_holding_capacity_mm DOUBLE PRECISION,
    infiltration_class TEXT,

    irrigation_method TEXT,
    irrigation_efficiency DOUBLE PRECISION,

    area_hectares DOUBLE PRECISION,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(site_id, feature_date)
);

CREATE TABLE IF NOT EXISTS irrigation_recommendations (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recommendation_date DATE NOT NULL,

    urgency TEXT NOT NULL,
    action_label TEXT NOT NULL,
    recommended_mm DOUBLE PRECISION NOT NULL,
    estimated_liters DOUBLE PRECISION NOT NULL,
    start_by TEXT NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,

    water_deficit_mm DOUBLE PRECISION NOT NULL,
    model_version TEXT NOT NULL,

    reasons JSONB NOT NULL,
    input_features JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forecast_site_date
ON raw_weather_forecast_daily(site_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_history_site_date
ON raw_weather_history_daily(site_id, weather_date);

CREATE INDEX IF NOT EXISTS idx_features_site_date
ON site_features_daily(site_id, feature_date);

CREATE INDEX IF NOT EXISTS idx_recommendations_site_generated
ON irrigation_recommendations(site_id, generated_at DESC);