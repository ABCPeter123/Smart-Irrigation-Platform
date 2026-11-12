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
  vm.runInNewContext(js, { exports, URLSearchParams, AbortSignal, ...globals }, { filename: path });
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

test("place name search resolves through fast Open-Meteo provider", async () => {
  const calls = [];
  const fetch = async input => {
    calls.push(String(input));
    return { ok: true, json: async () => ({ results: [{
      id: 1, name: "London", admin1: "England", country: "United Kingdom",
      latitude: 51.5074, longitude: -0.1278,
    }] }) };
  };
  const { searchPlaces } = loadModule("src/services/locationSearch.web.ts", { fetch });
  const matches = await searchPlaces("London");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].latitude, 51.5074);
  assert.equal(matches[0].longitude, -0.1278);
  assert.equal(matches[0].source, "open-meteo");
  assert.equal(calls.length, 1);
});

test("search understands city followed by country", async () => {
  const calls = [];
  const fetch = async input => {
    calls.push(String(input));
    const exact = String(input).includes("name=Tokyo&");
    return {
      ok: true,
      json: async () => exact ? {results: [{
        id: 123, name: "Tokyo", admin1: "Tokyo", country: "Japan",
        latitude: 35.6895, longitude: 139.6917,
      }]} : { results: [] },
    };
  };
  const { searchPlaces } = loadModule("src/services/locationSearch.web.ts", { fetch });
  const matches = await searchPlaces("Tokyo Japan");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].latitude, 35.6895);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.includes("open-meteo.com")));
});

test("street address search tries OSM-based Photon with a timeout, then falls back", async () => {
  const calls = [];
  const fetch = async input => {
    calls.push(String(input));
    if (calls.length === 1) throw Error("Photon down");
    return { ok: true, json: async () => ({ results: [{
      id: 1, name: "Toronto", admin1: "Ontario", country: "Canada",
      latitude: 43.6532, longitude: -79.3832,
    }] }) };
  };
  const { searchPlaces } = loadModule("src/services/locationSearch.web.ts", { fetch });
  const matches = await searchPlaces("123 King Street, Toronto");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /photon/);
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

test("repeated searches reuse cached place results", async () => {
  let calls = 0;
  const { searchPlaces } = loadModule("src/services/locationSearch.web.ts", {
    fetch: async () => {
      calls += 1;
      return {ok: true, json: async () => ({results: [{
        name:"Waterloo",latitude:43.4668,longitude:-80.5164,
      }]})};
    },
  });
  await searchPlaces("Waterloo");
  await searchPlaces("waterloo");
  assert.equal(calls, 1);
});
