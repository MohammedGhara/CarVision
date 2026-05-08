"use strict";

const request = require("supertest");
const { app } = require("../server");

describe("Functional Testing - API behavior", () => {
  test("GET /api/ping returns 200", async () => {
    const res = await request(app).get("/api/ping");
    expect(res.status).toBe(200);
  });

  test("GET /api/ping returns JSON", async () => {
    const res = await request(app).get("/api/ping");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(typeof res.body).toBe("object");
    expect(res.body).toEqual(expect.objectContaining({ ok: true }));
  });

  test("unknown route returns 404", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist");
    expect(res.status).toBe(404);
  });

  test("POST /api/auth/login empty body rejects", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect([400, 401]).toContain(res.status);
    expect(typeof res.body).toBe("object");
  });

  test("POST /api/auth/login missing identifier rejects", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "123456" });
    expect([400, 401]).toContain(res.status);
    expect(typeof res.body).toBe("object");
  });

  test("POST /api/auth/login missing password rejects", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "test@example.com" });
    expect([400, 401]).toContain(res.status);
    expect(typeof res.body).toBe("object");
  });

  test("wrong login input does not crash and returns JSON error contract", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "" });
    expect([400, 401]).toContain(res.status);
    expect(typeof res.body).toBe("object");
  });
});
