import React, { useEffect, useMemo, useState } from "react";
import { fetchPublicWeather, sampleWeather, weatherEmoji, type PublicWeather } from "../src/services/publicWeather.web";
import { calculateScenario, DEMO_FIELDS, type DemoField } from "../src/services/irrigationScenario.web";

import "../styles/irrigation-dashboard.css";

type PipelinePreviewRow = {
  id: string;
  name: string;
  urgency: string | null;
  forecastDate: string | null;
  recommendedMm: number | null;
  estimatedLitres: number | null;
  dataCompletenessPct: number | null;
  modelVersion: string | null;
};
type PipelinePreview = { status: string; records?: PipelinePreviewRow[] };


const FIELDS = DEMO_FIELDS;
const round = (x: number) => Math.round(x * 10) / 10;
const dayName = (i: number) => i === 0 ? "today" : i === 1 ? "tomorrow" : "day " + (i + 1);
const calendarLabel = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-CA", { weekday: "short", timeZone: "UTC" }).toUpperCase();

function chartPoints(values: number[], maxX: number) {
  return values.map((v, i) => {
    const x = 66 + (i * 840) / maxX;
    const y = 288 - v * 5.15;
    return [round(x), round(y)] as const;
  });
}

function pathFrom(points: readonly (readonly [number, number])[]) {
  return points.map((point, index) => (index === 0 ? "M " : "L ") + point[0] + " " + point[1]).join(" ");
}

function ForecastChart({ baseline, treated, days }: { baseline: number[]; treated: number[]; days: number }) {
  const base = chartPoints(baseline, days);
  const withWater = chartPoints(treated, days);
  const ticks = [10, 20, 25, 30, 40, 50];
  return (
    <svg viewBox="0 0 960 342" className="ir-chart" role="img" aria-label="Illustrative soil moisture forecast comparing no irrigation with the selected irrigation plan.">
      <defs>
        <linearGradient id="healthyBand" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#c9eac7" stopOpacity=".48"/>
          <stop offset="100%" stopColor="#d9eedb" stopOpacity=".18"/>
        </linearGradient>
      </defs>
      <rect x="66" y="30.5" width="840" height="103" fill="url(#healthyBand)"/>
      <rect x="66" y="133.5" width="840" height="25.75" fill="#fdf2bf" opacity=".7"/>
      <rect x="66" y="159.25" width="840" height="51.5" fill="#ffe3b0" opacity=".75"/>
      <rect x="66" y="210.75" width="840" height="77.25" fill="#fbd2ce" opacity=".75"/>
      {ticks.map(t => (
        <g key={t}>
          <line x1="66" x2="906" y1={288 - t * 5.15} y2={288 - t * 5.15} stroke="#dce5dc" strokeDasharray={t === 25 || t === 30 ? "6 6" : undefined}/>
          <text x="52" y={292 - t * 5.15} textAnchor="end" fill="#607568" fontSize="13">{t}%</text>
        </g>
      ))}
      <line x1="66" x2="906" y1="288" y2="288" stroke="#afbeb6"/>
      <line x1="66" x2="66" y1="30" y2="288" stroke="#d5ded7"/>
      <line x1={66 + 3 * 840 / days} x2={66 + 3 * 840 / days} y1="30" y2="288" stroke="#549a68" strokeDasharray="6 6" opacity=".7"/>
      <path d={pathFrom(base)} fill="none" stroke="#245f82" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={pathFrom(withWater)} fill="none" stroke="#479759" strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round"/>
      {base.map(([x,y],i) => <circle key={"b"+i} cx={x} cy={y} r={i===0 ? 6 : 4.1} fill="#245f82" stroke="white" strokeWidth="1.5"/>)}
      {withWater.filter((_,i)=>i>=3).map(([x,y],i) => <circle key={"w"+i} cx={x} cy={y} r="3.4" fill="#479759" stroke="white" strokeWidth="1.3"/>)}
      {Array.from({length: days + 1}, (_,i) => i).filter(i => days===7 || i%2===0).map(i => (
        <text key={i} x={66 + i * 840 / days} y="312" textAnchor="middle" fill="#52655a" fontSize="12">{i===0?"Now":"+"+i+"d"}</text>
      ))}
      <text x="906" y="24" textAnchor="end" fill="#66786c" fontSize="12">Simulated volumetric moisture (%)</text>
    </svg>
  );
}

function BrandMark() {
  return (
    <svg className="ir-logo" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M23 42V23" stroke="#c2e69d" strokeWidth="4" strokeLinecap="round"/>
      <path d="M24 25C9 25 6 15 7 8c11-1 21 5 17 17Z" fill="#c2e69d"/>
      <path d="M25 21C25 10 34 5 43 6c0 12-7 17-18 15Z" fill="#87ba71"/>
      <path d="M22 34c-9 1-13-3-14-11 8-1 15 2 14 11Z" fill="#89c38b"/>
    </svg>
  );
}

export default function IrrigationWebDashboard() {
  const [fieldId, setFieldId] = useState(FIELDS[0].id);
  const [days, setDays] = useState(7);
  const [rainMm, setRainMm] = useState(0);
  const [irrigationMm, setIrrigationMm] = useState(10);
  const [moistureOverrides, setMoistureOverrides] = useState<Record<string, number>>({});
  const [weather, setWeather] = useState<PublicWeather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"loading" | "live" | "sample">("loading");
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [pipelineRecords, setPipelineRecords] = useState<PipelinePreviewRow[]>([]);

  const field: DemoField = FIELDS.find(f => f.id === fieldId) ?? FIELDS[0];
  const sample = useMemo(() => sampleWeather(), []);
  const forecastData = weather ?? sample;
  const startingMoisturePct = moistureOverrides[field.id] ?? field.initialMoisturePct;

  useEffect(() => {
    const controller = new AbortController();
    setWeather(null);
    setWeatherStatus("loading");
    setWeatherError(null);

    fetchPublicWeather(field.latitude, field.longitude, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setWeather(data);
        setWeatherStatus("live");
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setWeather(sampleWeather());
        setWeatherStatus("sample");
        setWeatherError(error instanceof Error ? error.message : "Weather is temporarily unavailable.");
      });
    return () => controller.abort();
  }, [field.id, refreshCounter]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pipeline", { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<PipelinePreview> : null)
      .then(data => {
        if (!controller.signal.aborted && data?.status === "ready" && Array.isArray(data.records)) {
          setPipelineRecords(data.records.slice(0, 20));
        }
      })
      .catch(() => {
        // The Python data pipeline is optional. Keep the public demo usable.
      });
    return () => controller.abort();
  }, []);

  const scenario = useMemo(
    () => calculateScenario({
      field,
      weatherDays: forecastData.daily,
      days,
      startingMoisturePct,
      extraRainMm: rainMm,
      plannedIrrigationMm: irrigationMm,
    }),
    [field, forecastData, days, startingMoisturePct, rainMm, irrigationMm]
  );
  const firstStressDay = scenario.firstStressDay;
  const minimum = scenario.minimumWithoutIrrigation;
  const status = minimum < 25 ? "Critical" : minimum < 30 ? "Warning" : "Healthy";
  const statusClass = status.toLowerCase();
  const improved = scenario.day5LiftPct;
  return (
    <div className="ir-site">
      <header className="ir-topbar">
        <div className="ir-topbar-inner">
          <a href="/" className="ir-brand"><BrandMark/><span>Irrigation <strong>Decision Support</strong></span></a>
          <div className="ir-topbar-actions">
            <label className="ir-top-select"><span>⌖</span><select aria-label="Select farm" value={fieldId} onChange={e=>setFieldId(e.target.value)}>{FIELDS.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
            <label className="ir-top-select ir-days"><select aria-label="Forecast window" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option></select></label>
            <a className="ir-top-github" href="https://github.com/ABCPeter123/Smart-Irrigation-Platform" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
        </div>
      </header>
      <main className="ir-shell">
        <div className="ir-heading">
          <div><span className="ir-eyebrow">PRECISION AGRICULTURE / INTERACTIVE DEMO</span><h1>Field intelligence, <em>made actionable.</em></h1><p>Explore how weather, moisture, and irrigation decisions affect a field over time.</p></div>
          <div className="ir-demo-tag" aria-live="polite"><span className="ir-demo-dot"></span> {weatherStatus === "live" ? "Live weather · Modeled soil" : weatherStatus === "loading" ? "Loading live weather · Sample preview" : "Sample weather · Modeled soil"}</div>
        </div>
        <div className="ir-dashboard-grid">
          <aside className="ir-side">
            <section className="ir-panel">
              <div className="ir-panel-heading"><h2>Field overview</h2><span className="ir-small-tag">01 / FIELD</span></div>
              <div className="ir-panel-pad">
                <div className="ir-farm-image" role="img" aria-label="Illustration of agricultural fields from above">
                  <div className="ir-farm-grid"></div>
                  <div className="ir-farm-boundary"><span className="ir-map-pin">●</span></div>
                  <div className="ir-farm-caption"><span className="ir-live-dot"></span> {field.name}</div>
                </div>
                <div className="ir-field-meta"><div><small>LOCATION</small><strong>{field.location}</strong></div><div><small>CROP</small><strong>{field.crop}</strong></div><div><small>FIELD AREA</small><strong>{field.areaHa.toFixed(2)} ha</strong></div><div><small>STARTING MOISTURE</small><strong>{startingMoisturePct}% assumed</strong></div></div>
              </div>
            </section>
            <section className="ir-panel">
              <div className="ir-panel-heading"><h2>Weather outlook</h2><span className="ir-small-tag">{weatherStatus === "live" ? "OPEN-METEO" : "SAMPLE"}</span></div>
              <div className="ir-weather-row">
                {forecastData.daily.slice(0, 5).map((w, i) => <div className="ir-weather-day" key={w.date}><span className="ir-weather-label">{i === 0 ? "TODAY" : calendarLabel(w.date)}</span><span className="ir-weather-icon">{weatherEmoji(w.weatherCode)}</span><strong>{Math.round(w.highC)}°</strong><small>{Math.round(w.lowC)}°</small><small>{Math.round(w.rainChancePct)}% rain</small></div>)}
              </div>
              <div className="ir-weather-foot"><p>{weatherStatus === "live" ? "Forecast weather · " + (forecastData.currentTemperatureC === null ? "" : "Now " + round(forecastData.currentTemperatureC) + "°C · ") + forecastData.timezone : weatherStatus === "loading" ? "Fetching current forecast. Sample values shown temporarily." : "Live forecast unavailable. Showing sample values."}</p><button type="button" onClick={() => setRefreshCounter(c => c + 1)} disabled={weatherStatus === "loading"} aria-label="Refresh weather forecast">↻ Refresh</button></div>
              {weatherError ? <p className="ir-weather-error" role="status">{weatherError}</p> : null}
            </section>
            <section className="ir-panel ir-controls">
              <div className="ir-panel-heading"><h2>Scenario controls</h2><span className="ir-small-tag">TRY IT</span></div>
              <div className="ir-panel-pad">
                <label className="ir-range-label" htmlFor="extra-rain"><span>Additional rainfall · day 2</span><strong>{rainMm} mm</strong></label>
                <input id="extra-rain" aria-label="Additional rainfall in millimetres" type="range" min="0" max="20" step="1" value={rainMm} onChange={e => setRainMm(Number(e.target.value))} disabled={field.environment === "greenhouse"} />
                {field.environment === "greenhouse" ? <p className="ir-control-tip">Outdoor rain does not reach greenhouse crops in this model.</p> : null}
                <label className="ir-range-label" htmlFor="planned-water"><span>Planned irrigation · day 3</span><strong>{irrigationMm} mm</strong></label>
                <input id="planned-water" aria-label="Planned irrigation in millimetres" type="range" min="0" max="25" step="1" value={irrigationMm} onChange={e => setIrrigationMm(Number(e.target.value))}/>
                <label className="ir-range-label" htmlFor="assumed-moisture"><span>Assumed current moisture</span><strong>{startingMoisturePct}%</strong></label>
                <input id="assumed-moisture" aria-label="Assumed starting soil moisture percentage" type="range" min="20" max="48" step="1" value={startingMoisturePct} onChange={e => setMoistureOverrides(previous => ({ ...previous, [field.id]: Number(e.target.value) }))}/>
                <p className="ir-control-tip">Moisture is a scenario assumption, not a sensor reading.</p>
                <button type="button" className="ir-reset" onClick={() => { setRainMm(0); setIrrigationMm(10); setMoistureOverrides(previous => ({ ...previous, [field.id]: field.initialMoisturePct })); }}>Reset scenario ↺</button>
              </div>
            </section>
          </aside>
          <div className="ir-main-column">
            <section className="ir-panel ir-chart-panel">
              <div className="ir-panel-heading ir-chart-heading"><div><h2>Soil moisture scenario</h2><p>Illustrative water-balance response to forecast conditions and your inputs</p></div><span className={"ir-status ir-" + statusClass}><span>●</span> {status} without irrigation</span></div>
              <div className="ir-chart-wrap"><ForecastChart baseline={scenario.baseline} treated={scenario.treated} days={days}/></div>
              <div className="ir-chart-legend"><span><i className="ir-key-blue"></i> Without irrigation</span><span><i className="ir-key-green"></i> With irrigation</span><span><i className="ir-key-amber"></i> Water stress threshold: 30%</span></div>
              <div className="ir-chart-footer"><span>Model assumptions: 250 mm root zone · 30% illustrative stress threshold</span><strong>Without irrigation: {minimum}% minimum</strong></div>
            </section>
            <div className="ir-bottom-grid">
              <section className="ir-panel">
                <div className="ir-panel-heading"><h2>Irrigation estimate</h2><span className="ir-small-tag">MODEL PREVIEW</span></div>
                <div className="ir-recommendation">
                  <span className="ir-reco-icon">↗</span>
                  <div><span className="ir-eyebrow">ILLUSTRATIVE 3-DAY WATER BALANCE</span><div className="ir-reco-number">{scenario.estimatedNeedMm} <span>mm</span></div><strong>{scenario.estimatedNeedMm > 0 ? "Estimated application: " + scenario.estimatedVolumeLitres.toLocaleString() + " L" : "No water deficit estimated"}</strong><p>Forecast ET₀ demand: {scenario.threeDayDemandMm} mm · effective rain: {scenario.threeDayRainCreditMm} mm</p><p>Your {irrigationMm} mm irrigation trial adds <b>+{improved} modeled moisture points</b> by day 5.</p></div>
                </div>
                <div className="ir-reco-note"><strong>{firstStressDay < 0 ? "Above the illustrative stress threshold" : "Modeled stress begins " + dayName(firstStressDay)}</strong><span>{firstStressDay < 0 ? "Simulated moisture remains above 30%." : "Simulated moisture drops below 30% without irrigation. Verify actual soil conditions before acting."}</span></div>
              </section>
              <section className="ir-panel">
                <div className="ir-panel-heading"><h2>Upcoming water stress</h2><span className="ir-small-tag">RISK MONITOR</span></div>
                <div className="ir-stress-bars">
                  {scenario.baseline.slice(1,8).map((value,i)=><div className="ir-stress-col" key={i}><span className="ir-stress-value">{value}%</span><div className="ir-stress-track"><div className={"ir-stress-fill " + (value<25?"critical":value<30?"warning":"healthy")} style={{height: value*1.75+"%"}}></div></div><span className="ir-stress-day">D{i+1}</span></div>)}
                </div>
                <div className="ir-stress-footer"><span><i className="ir-key-green"></i> Healthy ≥30%</span><span><i className="ir-key-amber"></i> Warning 25–29%</span><span><i className="ir-key-red"></i> Critical &lt;25%</span></div>
              </section>
            </div>
          </div>
        </div>
        {pipelineRecords.length > 0 ? (
          <section className="ir-panel ir-pipeline-panel">
            <div className="ir-panel-heading">
              <div><h2>Python data pipeline</h2><p>Latest stored model snapshots for public demonstration sites</p></div>
              <span className="ir-small-tag">POSTGRESQL · ETL</span>
            </div>
            <div className="ir-pipeline-grid">
              {pipelineRecords.map(record => (
                <article key={record.id} className="ir-pipeline-item">
                  <div className="ir-pipeline-top">
                    <strong>{record.name}</strong>
                    <span className="ir-small-tag">{record.urgency ? record.urgency.toUpperCase() + " PRIORITY" : "PENDING"}</span>
                  </div>
                  <div className="ir-pipeline-value">{record.recommendedMm === null ? "Pending" : record.recommendedMm.toFixed(1) + " mm"}</div>
                  <p>{record.estimatedLitres === null ? "No estimate stored" : Math.round(record.estimatedLitres).toLocaleString() + " L modeled"}</p>
                  <div className="ir-pipeline-meta"><span>{record.forecastDate ?? "No model date"}</span><span>{record.dataCompletenessPct === null ? "Completeness unknown" : Math.round(record.dataCompletenessPct) + "% input completeness"}</span></div>
                </article>
              ))}
            </div>
            <p className="ir-pipeline-note">Stored outputs use the Python feature-store model. They are separate from the interactive soil-moisture scenario and are not based on live sensor readings.</p>
          </section>
        ) : null}
        <footer className="ir-footer"><span>Weather data: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0) · Scenario outputs are illustrative, not agronomic advice.</span><span>Built by Peter Pu · <a href="https://github.com/ABCPeter123/Smart-Irrigation-Platform" target="_blank" rel="noreferrer">Source code ↗</a></span></footer>
      </main>
    </div>
  );
}
