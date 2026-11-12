const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "production";
delete process.env.CRON_SECRET;

const { estimate } = require("../dist/services/weatherPipeline.service");
const { app } = require("../dist/app");

const site = {
  id: "demo-example", name: "Demo Farm", latitude: 43.4516, longitude: -80.4925,
  areaHa: 1.2, cropType: "tomatoes", soilType: "loam", irrigationMethod: "drip",
};

const weatherDay = (rain, et0, chance = 10) => ({
  date: "2026-11-12", high: 24, low: 12, rain, chance, wind: 10, et0,
});

test("forecast-based calculation generates finite values and a valid action", () => {
  const result = estimate(site, Array(14).fill(weatherDay(0, 4)), Array(7).fill(weatherDay(0, 6)));
  assert.ok(Number.isFinite(result.mm));
  assert.ok(result.mm >= 0);
  assert.equal(result.liters, Math.round(result.mm * site.areaHa * 10000));
  assert.ok(["High", "Medium", "Low"].includes(result.urgency));
});

test("high rainfall does not increase irrigation estimate", () => {
  const dry = estimate(site, Array(14).fill(weatherDay(0, 5)), Array(7).fill(weatherDay(0, 7)));
  const rain = estimate(site, Array(14).fill(weatherDay(0, 5)), Array(7).fill(weatherDay(12, 7, 80)));
  assert.ok(rain.mm <= dry.mm);
});

test("cron refresh refuses requests when no secret exists", async () => {
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise(resolve => server.once("listening", resolve));
    const address = server.address();
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/cron/refresh");
    assert.equal(response.status, 503);
    assert.equal((await response.json()).status, "disabled");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
