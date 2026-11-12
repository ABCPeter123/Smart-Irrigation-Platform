import { prisma } from "../lib/prisma";

type Site = { id: string; name: string; latitude: number; longitude: number; areaHa: number; cropType: string; soilType: string; irrigationMethod: string };
type Day = { date: string; high: number; low: number; rain: number; chance: number; wind: number; et0: number };
const COEFFICIENTS: Record<string,number> = { tomatoes:1.05,"leafy-greens":0.95,strawberries:0.85,corn:1.1,wheat:0.95,potatoes:1 };
const EFFICIENCY: Record<string,number> = { drip:0.9,sprinkler:0.75,pivot:0.8,flood:0.55 };
const SOIL: Record<string,{whc:number;sand:number;silt:number;clay:number}> = {
  loam:{whc:160,sand:40,silt:40,clay:20},
  "sandy-loam":{whc:110,sand:65,silt:25,clay:10},
  sand:{whc:70,sand:88,silt:7,clay:5},
  clay:{whc:210,sand:20,silt:30,clay:50}
};
const sum = (items:number[]) => items.reduce((a,b)=>a+b,0);
const round = (x:number,n=1) => Number(x.toFixed(n));

export async function fetchWeather(site:Site):Promise<{history:Day[];forecast:Day[]}> {
  const params=new URLSearchParams({
    latitude:String(site.latitude),longitude:String(site.longitude),timezone:"auto",
    past_days:"14",forecast_days:"7",
    daily:"temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration"
  });
  const response=await fetch("https://api.open-meteo.com/v1/forecast?"+params, {signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error("Weather fetch HTTP "+response.status);
  const data=await response.json() as {daily?:Record<string,unknown>;error?:boolean};
  const daily=data.daily;
  if(data.error||!daily||!Array.isArray(daily.time)||daily.time.length<21)throw new Error("Incomplete forecast");
  const get=(key:string,i:number)=>{
    const column=daily[key],val=Array.isArray(column)?column[i]:null;
    if(typeof val!=="number"||!Number.isFinite(val))throw new Error("Missing weather field "+key);
    return val;
  };
  const rows:Day[]=(daily.time as unknown[]).slice(0,21).map((date,i)=>{
    if(typeof date!=="string"||! /^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Invalid date");
    return {date,high:get("temperature_2m_max",i),low:get("temperature_2m_min",i),
      rain:Math.max(0,get("precipitation_sum",i)),
      chance:i<14?0:get("precipitation_probability_max",i),
      wind:get("wind_speed_10m_max",i),et0:get("et0_fao_evapotranspiration",i)};
  });
  return {history:rows.slice(0,14),forecast:rows.slice(14,21)};
}

/** Mirrors the Python educational water-balance model, using weather and estimated soil only. */
export function estimate(site:Site,history:Day[],forecast:Day[]) {
  const today=forecast[0];if(!today)throw new Error("No forecast");
  const soil=SOIL[site.soilType]??SOIL.loam,kc=COEFFICIENTS[site.cropType]??1,eff=EFFICIENCY[site.irrigationMethod]??0.75;
  const rain3=sum(history.slice(-3).map(d=>d.rain)),rain7=sum(history.slice(-7).map(d=>d.rain));
  const rain72=sum(forecast.slice(0,3).map(d=>d.rain));
  const cropEt=today.et0*kc;
  const deficit=Math.max(0,(cropEt-today.rain*0.8-Math.min(rain3*0.25,4))*(soil.whc<90?1.25:soil.whc<130?1.1:soil.whc>190?0.9:1));
  const rainy=rain72>=8||today.chance>=75,partlyRainy=rain72>=4||today.chance>=50;
  const score=Math.max(0,Math.min(100,Math.min(deficit/8,1)*60+
    (today.high>=30?15:today.high>=25?8:0)+(today.wind>=30?12:today.wind>=20?6:0)-
    (rainy?25:partlyRainy?12:0)));
  const urgency=score>=65?"High":score>=35?"Medium":"Low";
  const mm=urgency==="Low"?0:round(Math.max(0,deficit/eff*(rainy?0.4:partlyRainy?0.7:1)));
  const liters=Math.round(mm*site.areaHa*10000);
  const features={
    site_id:site.id,feature_date:today.date,temperature_max_c:today.high,temperature_min_c:today.low,
    wind_max_kmh:today.wind,rainfall_today_mm:today.rain,rainfall_3d_mm:rain3,
    rainfall_7d_mm:rain7,rainfall_14d_mm:sum(history.map(d=>d.rain)),
    forecast_rain_24h_mm:today.rain,forecast_rain_72h_mm:rain72,
    precipitation_probability_max_pct:today.chance,et0_today_mm:today.et0,
    et0_7d_mm:sum(history.slice(-7).map(d=>d.et0))+sum(forecast.slice(0,3).map(d=>d.et0)),
    crop_type:site.cropType,crop_coefficient:kc,root_depth_mm:site.cropType==="tomatoes"?700:300,
    soil_type:site.soilType,soil_texture:site.soilType,sand_pct:soil.sand,
    silt_pct:soil.silt,clay_pct:soil.clay,water_holding_capacity_mm:soil.whc,
    infiltration_class:"estimated",irrigation_method:site.irrigationMethod,
    irrigation_efficiency:eff,area_hectares:site.areaHa,
  };
  const action=mm===0?"No irrigation needed":urgency==="High"?"Irrigate "+mm.toFixed(1)+" mm":"Plan "+mm.toFixed(1)+" mm irrigation";
  return {features,urgency,mm,liters,deficit:round(deficit,2),action,
    reasons:["Forecast-based crop ET: "+cropEt.toFixed(1)+" mm.",
      "Expected rain credit: "+(today.rain*0.8).toFixed(1)+" mm.",
      "Soil properties are estimated, not measured.",
      "Weather data: Open-Meteo."],
    startBy:urgency==="High"?"Start within 24 hours":urgency==="Medium"?"Start within 48 hours":"Recheck tomorrow"};
}

async function save(site:Site,history:Day[],forecast:Day[]) {
  const result=estimate(site,history,forecast),today=forecast[0];
  const forecastJson=JSON.stringify(forecast),historyJson=JSON.stringify(history),features=result.features;
  const soil=SOIL[site.soilType]??SOIL.loam;
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`
      INSERT INTO raw_weather_forecast_daily
        (site_id,forecast_date,temperature_max_c,temperature_min_c,
         precipitation_sum_mm,precipitation_probability_max_pct,wind_speed_max_kmh,et0_fao_mm)
      SELECT ${site.id},r.date::date,r.high,r.low,r.rain,r.chance,r.wind,r.et0
      FROM jsonb_to_recordset(${forecastJson}::jsonb)
        AS r(date text,high float8,low float8,rain float8,chance float8,wind float8,et0 float8)
      ON CONFLICT(site_id,forecast_date) DO UPDATE SET
        fetched_at=now(),temperature_max_c=EXCLUDED.temperature_max_c,
        temperature_min_c=EXCLUDED.temperature_min_c,precipitation_sum_mm=EXCLUDED.precipitation_sum_mm,
        precipitation_probability_max_pct=EXCLUDED.precipitation_probability_max_pct,
        wind_speed_max_kmh=EXCLUDED.wind_speed_max_kmh,et0_fao_mm=EXCLUDED.et0_fao_mm
    `;
    await tx.$executeRaw`
      INSERT INTO raw_weather_history_daily
        (site_id,weather_date,temperature_max_c,temperature_min_c,precipitation_sum_mm,
         wind_speed_max_kmh,et0_fao_mm,source)
      SELECT ${site.id},r.date::date,r.high,r.low,r.rain,r.wind,r.et0,'open-meteo-past-days'
      FROM jsonb_to_recordset(${historyJson}::jsonb)
        AS r(date text,high float8,low float8,rain float8,wind float8,et0 float8)
      ON CONFLICT(site_id,weather_date) DO UPDATE SET
        fetched_at=now(),temperature_max_c=EXCLUDED.temperature_max_c,
        temperature_min_c=EXCLUDED.temperature_min_c,precipitation_sum_mm=EXCLUDED.precipitation_sum_mm,
        wind_speed_max_kmh=EXCLUDED.wind_speed_max_kmh,et0_fao_mm=EXCLUDED.et0_fao_mm
    `;
    await tx.$executeRaw`
      INSERT INTO raw_soil_profiles(site_id,soil_texture,sand_pct,silt_pct,clay_pct,
        water_holding_capacity_mm,source)
      VALUES (${site.id},${site.soilType},${soil.sand},${soil.silt},${soil.clay},
        ${soil.whc},'manual-estimate')
      ON CONFLICT(site_id) DO UPDATE SET fetched_at=now(),soil_texture=EXCLUDED.soil_texture,
        sand_pct=EXCLUDED.sand_pct,silt_pct=EXCLUDED.silt_pct,clay_pct=EXCLUDED.clay_pct,
        water_holding_capacity_mm=EXCLUDED.water_holding_capacity_mm
    `;
    await tx.$executeRaw`
      INSERT INTO irrigation_recommendations(site_id,recommendation_date,urgency,
        action_label,recommended_mm,estimated_liters,start_by,confidence_score,
        water_deficit_mm,model_version,reasons,input_features)
      VALUES (${site.id},${today.date}::date,${result.urgency},
        ${result.action},${result.mm},${result.liters},
        ${result.startBy},100,${result.deficit},'weather-balance-service-v1.0',
        ${JSON.stringify(result.reasons)}::jsonb,${JSON.stringify(features)}::jsonb)
      ON CONFLICT(site_id,recommendation_date) DO UPDATE SET
        generated_at=now(),urgency=EXCLUDED.urgency,action_label=EXCLUDED.action_label,
        recommended_mm=EXCLUDED.recommended_mm,estimated_liters=EXCLUDED.estimated_liters,
        start_by=EXCLUDED.start_by,confidence_score=EXCLUDED.confidence_score,
        water_deficit_mm=EXCLUDED.water_deficit_mm,model_version=EXCLUDED.model_version,
        reasons=EXCLUDED.reasons,input_features=EXCLUDED.input_features
    `;
  },{timeout:20000});
}

export async function refreshDemoForecasts() {
  const sites=await prisma.$queryRaw<Site[]>`
    SELECT id,name,latitude,longitude,area_hectares AS "areaHa",
      crop_type AS "cropType",soil_type AS "soilType",
      irrigation_method AS "irrigationMethod"
    FROM pipeline_sites WHERE id LIKE 'demo-%' ORDER BY id LIMIT 12
  `;
  const results:{siteId:string;status:"updated"|"failed"}[]=[];
  for(const site of sites) {
    try {
      const {history,forecast}=await fetchWeather(site);
      await save(site,history,forecast);
      results.push({siteId:site.id,status:"updated"});
    }catch(error) {
      console.error("Weather refresh failed",site.id,error instanceof Error?error.message:"unknown");
      results.push({siteId:site.id,status:"failed"});
    }
  }
  return {updated:results.filter(x=>x.status==="updated").length,
    failed:results.filter(x=>x.status==="failed").length,results};
}
