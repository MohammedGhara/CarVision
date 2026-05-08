"use strict";

const request = require("supertest");
const { app } = require("../server");

describe("Integration Testing - Express routes + middleware", () => {
  test("GET /api/auth/me without token rejects", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("GET /api/auth/me with malformed Authorization header rejects", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Token invalid-token");
    expect(res.status).toBe(401);
  });

  test("GET /api/auth/me with invalid Bearer token rejects", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
  });

  test("GET /api/vehicles without token returns protected behavior", async () => {
    const res = await request(app).get("/api/vehicles");
    expect([401, 403]).toContain(res.status);
  });

  test("GET /api/messages without token returns protected behavior", async () => {
    const res = await request(app).get("/api/messages");
    expect([401, 403, 404]).toContain(res.status);
  });

  test("GET /api/vehicles/:id without token returns protected behavior", async () => {
    const res = await request(app).get("/api/vehicles/123");
    expect([401, 403]).toContain(res.status);
  });

  test("API response contract is JSON for integrated route flow", async () => {
    const pingRes = await request(app).get("/api/ping");
    const loginRes = await request(app).post("/api/auth/login").send({});
    expect(pingRes.headers["content-type"]).toMatch(/application\/json/);
    expect(loginRes.headers["content-type"]).toMatch(/application\/json/);
  });
});
