const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

// Type-only imports disappear from the transpiled water-balance module.
const source = fs.readFileSync("src/services/irrigationScenario.web.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
vm.runInNewContext(output, { exports }, { filename: "irrigationScenario.web.js" });
const { calculateScenario, DEMO_FIELDS } = exports;

const field = DEMO_FIELDS[0];
const greenhouse = DEMO_FIELDS[1];
const days = Array.from({ length: 14 }, (_, i) => ({
  date: "2026-11-" + String(i + 10).padStart(2, "0"),
  highC: 20, lowC: 10, et0Mm: 3,
  precipitationMm: 0, rainChancePct: 0, weatherCode: 1,
}));
const run = (overrides = {}) => calculateScenario({
  field, weatherDays: days, days: 7,
  startingMoisturePct: 39,
  extraRainMm: 0,
  plannedIrrigationMm: 10,
  ...overrides,
});

test("zero irrigation makes both curves identical", () => {
  const output = run({ plannedIrrigationMm: 0 });
  assert.deepEqual(Array.from(output.baseline), Array.from(output.treated));
});

test("the irrigation pulse affects only day three onward", () => {
  const output = run();
  assert.equal(output.baseline[0], output.treated[0]);
  assert.equal(output.baseline[1], output.treated[1]);
  assert.equal(output.baseline[2], output.treated[2]);
  assert.ok(output.treated[3] > output.baseline[3]);
});

test("extra rain improves open-field moisture", () => {
  const dry = run({ extraRainMm: 0 });
  const wet = run({ extraRainMm: 12 });
  assert.ok(wet.baseline[2] > dry.baseline[2]);
});

test("outdoor rain does not change greenhouse moisture", () => {
  const dry = run({ field: greenhouse, extraRainMm: 0 });
  const wet = run({ field: greenhouse, extraRainMm: 12 });
  assert.deepEqual(Array.from(dry.baseline), Array.from(wet.baseline));
});

test("volume converts mm times hectares into litres", () => {
  const output = run();
  assert.equal(output.estimatedVolumeLitres, Math.round(output.estimatedNeedMm * field.areaHa * 10000));
});

test("more forecast rain lowers recommended water balance", () => {
  const dry = run();
  const wetDays = days.map(d => ({ ...d, precipitationMm: 9 }));
  const wet = run({ weatherDays: wetDays });
  assert.ok(wet.estimatedNeedMm <= dry.estimatedNeedMm);
});

test("moisture stays bounded and 14 day window is available", () => {
  const result = run({ days: 14, startingMoisturePct: 47, plannedIrrigationMm: 25 });
  assert.equal(result.baseline.length, 15);
  assert.equal(result.treated.length, 15);
  assert.ok(result.treated.every(v => v >= 5 && v <= 48));
});
