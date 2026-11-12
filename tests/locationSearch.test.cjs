const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

function loadModule(path, globals = {}) {
  const source = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, URLSearchParams, ...globals }, { filename: path });
  return exports;
}

test("exact latitude and longitude resolve without geocoding", () => {
  const { parseCoordinates } = loadModule("src/services/locationSearch.web.ts");
  const location = parseCoordinates("43.4516, -80.4925");
  assert.equal(location.latitude, 43.4516);
  assert.equal(location.longitude, -80.4925);
  assert.equal(location.source, "coordinates");
  assert.equal(parseCoordinates("Toronto, Ontario"), null);
  assert.throws(() => parseCoordinates("91, 0"), /Latitude/);
  assert.throws(() => parseCoordinates("43.1, -181"), /Longitude/);
});

test("the user can move any demo crop profile to arbitrary coordinates", () => {
  const { customFieldAt, DEMO_FIELDS } = loadModule("src/services/irrigationScenario.web.ts");
  const field = customFieldAt(51.5074, -0.1278, "London, England, United Kingdom", DEMO_FIELDS[0]);
  assert.equal(field.latitude, 51.5074);
  assert.equal(field.longitude, -0.1278);
  assert.equal(field.crop, DEMO_FIELDS[0].crop);
  assert.equal(field.location, "London, England, United Kingdom");
  assert.ok(field.id.startsWith("custom-"));
  assert.notEqual(field.id, DEMO_FIELDS[0].id);
});

test("on-demand place search returns Photon coordinates and names", async () => {
  let url = "";
  const fetch = async input => {
    url = String(input);
    return {
      ok: true,
      json: async () => ({ features: [{
        geometry: { coordinates: [-0.1278, 51.5074] },
        properties: { name: "London", state: "England", country: "United Kingdom" },
      }] }),
    };
  };
  const { searchPlaces } = loadModule("src/services/locationSearch.web.ts", { fetch });
  const matches = await searchPlaces("London");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].latitude, 51.5074);
  assert.equal(matches[0].longitude, -0.1278);
  assert.match(matches[0].label, /London/);
  assert.match(url, /photon\.komoot\.io/);
});

test("search falls back to Open-Meteo geocoding when Photon is unavailable", async () => {
  const calls = [];
  const fetch = async input => {
    calls.push(String(input));
    if (calls.length === 1) throw Error("Photon down");
    return { ok: true, json: async () => ({ results: [{
      id: 1, name: "Waterloo", admin1: "Ontario", country: "Canada",
      latitude: 43.4668, longitude: -80.5164,
    }] }) };
  };
  const { searchPlaces } = loadModule("src/services/locationSearch.web.ts", { fetch });
  const matches = await searchPlaces("Waterloo");
  assert.equal(calls.length, 2);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].source, "open-meteo");
});

test("latitude and longitude searches do not call external services", async () => {
  const { searchPlaces } = loadModule("src/services/locationSearch.web.ts", {
    fetch: () => { throw Error("Coordinates should be used directly"); },
  });
  const places = await searchPlaces(" 40.7128 , -74.0060 ");
  assert.equal(places.length, 1);
  assert.equal(places[0].latitude, 40.7128);
});
