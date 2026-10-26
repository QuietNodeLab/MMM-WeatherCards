const { test } = require("node:test");
const assert = require("node:assert/strict");
const { frontend, helper } = require("./support.cjs");

test("configured metric units and counts reach independent API requests", async () => {
  const m = frontend({ units: "metric", hourlyCount: 4, forecastDays: 3 });
  const urls = [];
  m.fetchJSON = (url) => {
    urls.push(url);
    return Promise.resolve({});
  };
  m.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(m.config.hourlyCount, 4);
  assert.equal(m.config.forecastDays, 3);
  const u = new URL(urls[0]);
  assert.equal(u.searchParams.get("temperature_unit"), "celsius");
  assert.equal(u.searchParams.get("wind_speed_unit"), "kmh");
  assert.equal(urls.length, 2);
  m.suspend();
});
test("air-quality failure does not discard forecast data", async () => {
  const m = frontend();
  m.fetchJSON = (url) =>
    url.includes("air-quality")
      ? Promise.reject(Error("mock outage"))
      : Promise.resolve({ current: { temperature_2m: 12 } });
  m.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(m.weatherData.current.temperature_2m, 12);
  assert.equal(m.airError, "mock outage");
  m.suspend();
});
test("night descriptions, missing temperatures and wind direction are consistent", () => {
  const m = frontend();
  assert.equal(m.dayDescription(0, 0), "Clear");
  assert.equal(m.fmtTemp(null), "--°");
  assert.equal(m.windDirection(90), "E");
});
test("count limits are bounded and lunar approximation remains finite", () => {
  const m = frontend({ hourlyCount: 100, forecastDays: 100 });
  m.fetchAll = () => {};
  m.start();
  assert.equal(m.config.hourlyCount, 24);
  assert.equal(m.config.forecastDays, 7);
  assert.ok(Number.isFinite(m.moonData().illumination));
  m.suspend();
});
test("loading and error states render without forecast data", () => {
  const m = frontend();
  assert.match(m.getDom().textContent, /Loading/);
  m.weatherError = "Synthetic error";
  assert.match(m.getDom().textContent, /Synthetic error/);
});
