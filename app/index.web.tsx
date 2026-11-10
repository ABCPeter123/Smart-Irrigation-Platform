import React, { useMemo, useState } from "react";
import "../styles/irrigation-dashboard.css";

type Field = {
  id: string;
  name: string;
  location: string;
  crop: string;
  area: string;
  startingMoisture: number;
};

const FIELDS: Field[] = [
  { id: "north-ridge", name: "North Ridge Farm", location: "Hay River, NT", crop: "Leafy greens", area: "0.90 ha", startingMoisture: 39 },
  { id: "aurora", name: "Aurora Greenhouse", location: "Whitehorse, YT", crop: "Tomatoes", area: "0.18 ha", startingMoisture: 35 },
  { id: "boreal", name: "Boreal Berry Plot", location: "Prince George, BC", crop: "Strawberries", area: "0.42 ha", startingMoisture: 42 },
];

const WEATHER = [
  { icon: "🌤️", high: 24, low: 12, rain: 10 },
  { icon: "☀️", high: 22, low: 11, rain: 0 },
  { icon: "☁️", high: 23, low: 13, rain: 15 },
  { icon: "🌦️", high: 25, low: 12, rain: 40 },
  { icon: "🌤️", high: 25, low: 14, rain: 10 },
  { icon: "☀️", high: 26, low: 15, rain: 0 },
  { icon: "🌧️", high: 20, low: 12, rain: 70 },
];

const clamp = (x: number, low: number, high: number) => Math.min(high, Math.max(low, x));
const round = (x: number) => Math.round(x * 10) / 10;
const dayName = (i: number) => i === 0 ? "Today" : i === 1 ? "Tomorrow" : "Day " + (i + 1);

function buildForecast(field: Field, days: number, rainMm: number, irrigationMm: number) {
  const baseline: number[] = [];
  const treated: number[] = [];
  for (let i = 0; i <= days; i++) {
    const drainage = i * 2.25;
    const rainBoost = i >= 3 ? rainMm * 0.42 : 0;
    const projected = clamp(field.startingMoisture - drainage + rainBoost, 5, 48);
    baseline.push(round(projected));
    treated.push(round(clamp(projected + (i >= 3 ? irrigationMm * 0.72 * Math.exp(-(i - 3) * 0.15) : 0), 5, 48)));
  }
  return { baseline, treated };
}

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
  const [rainMm, setRainMm] = useState(4);
  const [irrigationMm, setIrrigationMm] = useState(14);
  const field = FIELDS.find(f => f.id === fieldId) ?? FIELDS[0];
  const forecast = useMemo(() => buildForecast(field, days, rainMm, irrigationMm), [field, days, rainMm, irrigationMm]);
  const firstStressDay = forecast.baseline.findIndex(x => x < 30);
  const minimum = Math.min(...forecast.baseline);
  const status = minimum < 25 ? "Critical" : minimum < 30 ? "Warning" : "Healthy";
  const statusClass = status.toLowerCase();
  const improved = round(forecast.treated[Math.min(5, days)] - forecast.baseline[Math.min(5, days)]);
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
          <div className="ir-demo-tag"><span className="ir-demo-dot"></span> Illustrative data · Not a live sensor feed</div>
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
                <div className="ir-field-meta"><div><small>LOCATION</small><strong>{field.location}</strong></div><div><small>CROP</small><strong>{field.crop}</strong></div><div><small>FIELD AREA</small><strong>{field.area}</strong></div><div><small>STARTING MOISTURE</small><strong>{field.startingMoisture}% estimated</strong></div></div>
              </div>
            </section>
            <section className="ir-panel">
              <div className="ir-panel-heading"><h2>Weather outlook</h2><span className="ir-small-tag">FORECAST</span></div>
              <div className="ir-weather-row">
                {WEATHER.slice(0,5).map((w,i)=><div className="ir-weather-day" key={i}><span className="ir-weather-label">{i===0?"TODAY": "D"+(i+1)}</span><span className="ir-weather-icon">{w.icon}</span><strong>{w.high}°</strong><small>{w.low}°</small></div>)}
              </div>
              <p className="ir-help-line">Sample conditions for scenario exploration.</p>
            </section>
            <section className="ir-panel ir-controls">
              <div className="ir-panel-heading"><h2>Scenario controls</h2><span className="ir-small-tag">TRY IT</span></div>
              <div className="ir-panel-pad">
                <label className="ir-range-label"><span>Expected rainfall</span><strong>{rainMm} mm</strong></label>
                <input aria-label="Expected rainfall in millimetres" type="range" min="0" max="20" step="1" value={rainMm} onChange={e=>setRainMm(Number(e.target.value))}/>
                <label className="ir-range-label"><span>Planned irrigation</span><strong>{irrigationMm} mm</strong></label>
                <input aria-label="Planned irrigation in millimetres" type="range" min="0" max="25" step="1" value={irrigationMm} onChange={e=>setIrrigationMm(Number(e.target.value))}/>
                <button className="ir-reset" onClick={()=>{setRainMm(4);setIrrigationMm(14);}}>Reset scenario ↺</button>
              </div>
            </section>
          </aside>
          <div className="ir-main-column">
            <section className="ir-panel ir-chart-panel">
              <div className="ir-panel-heading ir-chart-heading"><div><h2>Soil moisture forecast</h2><p>How the field could respond over the selected period</p></div><span className={"ir-status ir-" + statusClass}><span>●</span> {status} without irrigation</span></div>
              <div className="ir-chart-wrap"><ForecastChart {...forecast} days={days}/></div>
              <div className="ir-chart-legend"><span><i className="ir-key-blue"></i> Without irrigation</span><span><i className="ir-key-green"></i> With irrigation</span><span><i className="ir-key-amber"></i> Water stress threshold: 30%</span></div>
              <div className="ir-chart-footer"><span>Planned irrigation applied on day 3</span><strong>Projected minimum: {minimum}%</strong></div>
            </section>
            <div className="ir-bottom-grid">
              <section className="ir-panel">
                <div className="ir-panel-heading"><h2>Irrigation recommendation</h2><span className="ir-small-tag">ACTION PLAN</span></div>
                <div className="ir-recommendation">
                  <span className="ir-reco-icon">↗</span>
                  <div><span className="ir-eyebrow">PROPOSED APPLICATION</span><div className="ir-reco-number">{irrigationMm} <span>mm</span></div><strong>{irrigationMm > 0 ? "Schedule irrigation on day 3" : "No irrigation planned"}</strong><p>Estimated lift by day 5: <b>+{improved} moisture points</b> versus no irrigation.</p></div>
                </div>
                <div className="ir-reco-note"><strong>{firstStressDay < 0 ? "No stress forecast" : "Water stress forecast on " + dayName(firstStressDay).toLowerCase()}</strong><span>{firstStressDay < 0 ? "Estimated moisture stays above 30%." : "Projected soil moisture falls below the 30% scenario threshold."}</span></div>
              </section>
              <section className="ir-panel">
                <div className="ir-panel-heading"><h2>Upcoming water stress</h2><span className="ir-small-tag">RISK MONITOR</span></div>
                <div className="ir-stress-bars">
                  {forecast.baseline.slice(1,8).map((value,i)=><div className="ir-stress-col" key={i}><span className="ir-stress-value">{value}%</span><div className="ir-stress-track"><div className={"ir-stress-fill " + (value<25?"critical":value<30?"warning":"healthy")} style={{height: value*1.75+"%"}}></div></div><span className="ir-stress-day">D{i+1}</span></div>)}
                </div>
                <div className="ir-stress-footer"><span><i className="ir-key-green"></i> Healthy ≥30%</span><span><i className="ir-key-amber"></i> Warning 25–29%</span><span><i className="ir-key-red"></i> Critical &lt;25%</span></div>
              </section>
            </div>
          </div>
        </div>
        <footer className="ir-footer"><span>Smart Irrigation Intelligence Platform · Scenario explorer</span><span>Designed and built by Peter Pu · <a href="https://github.com/ABCPeter123/Smart-Irrigation-Platform">View source ↗</a></span></footer>
      </main>
    </div>
  );
}
