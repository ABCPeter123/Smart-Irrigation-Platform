const { test } = require("node:test");
const assert = require("node:assert/strict");

// The public hosted service must work without database credentials and must
// never expose the legacy unauthenticated CRUD API to the public.
process.env.NODE_ENV = "production";
delete process.env.DATABASE_URL;

const { app } = require("../dist/app");

async function withServer(action) {
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise(resolve => server.once("listening", resolve));
    const address = server.address();
    return await action("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("health endpoint is available without database credentials", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/api/health");
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, "ok");
    assert.equal(payload.mode, "public-read-only");
    assert.equal(payload.pipelineDatabase, "not-configured");
  });
});

test("pipeline status is explicit when database is not connected", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/api/public/pipeline");
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.status, "not-configured");
  });
});

test("public hosting blocks legacy read/write routes", async () => {
  await withServer(async base => {
    for (const [method, path] of [
      ["GET", "/api/sites"],
      ["POST", "/api/sites"],
      ["DELETE", "/api/sites/demo"],
      ["POST", "/api/irrigation-logs"],
      ["POST", "/api/recommendations/site/demo/snapshot"],
    ]) {
      const response = await fetch(base + path, { method });
      assert.equal(response.status, 404, method + " " + path);
    }
  });
});
