// apps/server/src/auth.js
"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "7d";

// create JWT
function sign(user) {
  return jwt.sign(
    { uid: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

// middleware to protect routes
function authRequired(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

/* POST /api/auth/signup  {email, name?, password, role?} */
router.post("/signup", async (req, res) => {
  try {
    const { email, name, password, role } = (req.body || {});
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ ok: false, error: "Email already registered" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: { email, name: name || null, role: role || "CLIENT", passwordHash },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });

    const token = sign(user);
    res.json({ ok: true, user, token });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* POST /api/auth/login  {email, password} */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = (req.body || {});
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const clean = { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
    const token = sign(clean);
    res.json({ ok: true, user: clean, token });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* GET /api/me (protected) */
router.get("/me", authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.uid },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });
  res.json({ ok: true, user });
});

module.exports = { router, authRequired };
