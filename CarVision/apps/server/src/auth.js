// apps/server/src/auth.js
"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("./email");

const prisma = new PrismaClient({
  log: ["error", "warn"]  // helps you see DB errors in the console
});

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
/* POST /api/auth/signup  {email, name?, password, role?} */
/* POST /api/auth/signup  {email, name?, password, role?} */
router.post("/signup", async (req, res) => {
  console.log("📥 Signup request received:", { 
    email: req.body?.email, 
    name: req.body?.name ? "***" : null, 
    role: req.body?.role,
    hasPassword: !!req.body?.password 
  });
  
  try {
    const { email, name, password, role } = (req.body || {});
    
    // Validate email format
    if (!email) {
      console.log("❌ Validation failed: Email missing");
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("❌ Validation failed: Invalid email format");
      return res.status(400).json({ ok: false, error: "Invalid email format" });
    }
    
    // Validate password
    if (!password) {
      console.log("❌ Validation failed: Password missing");
      return res.status(400).json({ ok: false, error: "Password is required" });
    }
    
    if (password.length < 6) {
      console.log("❌ Validation failed: Password too short");
      return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
    }

    // Check if email already exists
    console.log("🔍 Checking if email exists...");
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      console.log("❌ Email already exists:", email);
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    console.log("🔐 Hashing password...");
    const passwordHash = await bcrypt.hash(String(password), 10);

    // Provide default name if not provided (since schema requires it)
    const userName = name && name.trim() ? name.trim() : email.split("@")[0]; // Use email prefix as fallback
    console.log("👤 Creating user with name:", userName);

    const user = await prisma.user.create({
      data: {
        email,
        name: userName, // Always provide a name
        role: role || "CLIENT",
        passwordHash
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });

    console.log("✅ User created:", user.id);

    const token = sign(user);
    console.log("✅ Token generated");
    
    // Send welcome email (non-blocking)
    sendWelcomeEmail(user).then(result => {
      if (result.ok) {
        console.log("✅ Welcome email sent successfully");
      } else {
        console.log("⚠️  Welcome email failed:", result.error);
      }
    }).catch(err => {
      console.error("❌ Welcome email error:", err);
    });
    
    return res.json({ ok: true, user, token });
  } catch (e) {
    console.error("❌ SIGNUP ERROR:", e);
    console.error("Error code:", e.code);
    console.error("Error message:", e.message);
    console.error("Error meta:", e.meta);
    
    // Handle Prisma unique constraint errors
    if (e.code === "P2002") {
      const field = e.meta?.target?.[0] || "field";
      console.log("❌ Unique constraint violation on field:", field);
      if (field === "email") {
        return res.status(409).json({ ok: false, error: "Email already registered" });
      }
      return res.status(409).json({ ok: false, error: `${field} already taken` });
    }
    
    // Handle Prisma validation errors
    if (e.code === "P2003" || e.code === "P2011") {
      console.log("❌ Prisma validation error");
      return res.status(400).json({ ok: false, error: "Invalid data provided" });
    }
    
    // Handle database connection errors
    if (e.code === "P1001" || e.message?.includes("connect")) {
      console.log("❌ Database connection error");
      return res.status(503).json({ ok: false, error: "Database connection failed. Please try again later." });
    }
    
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || "Signup failed. Please try again.") 
    });
  }
});

/* POST /api/auth/login  {email OR username, password} */
/* POST /api/auth/login  {email OR username, password} */
router.post("/login", async (req, res) => {
  try {
    const { email, username, password } = (req.body || {});
    const identifier = email || username;
    
    if (!identifier) {
      return res.status(400).json({ ok: false, error: "Email or username is required" });
    }
    
    if (!password) {
      return res.status(400).json({ ok: false, error: "Password is required" });
    }

    // Try to find user by email first, then by name (username)
    let user = await prisma.user.findUnique({ where: { email: identifier } });
    
    if (!user) {
      // If not found by email, try finding by name (username)
      user = await prisma.user.findFirst({ 
        where: { name: identifier } 
      });
    }
    
    if (!user) {
      return res.status(401).json({ ok: false, error: "Invalid email/username or password" });
    }

    // Check if user has password
    if (!user.passwordHash) {
      return res.status(400).json({
        ok: false,
        error: "This account has no password. Please sign up again."
      });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "Invalid email/username or password" });
    }

    const clean = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    };

    const token = sign(clean);
    return res.json({ ok: true, user: clean, token });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ ok: false, error: String(e.message || "Login failed. Please try again.") });
  }
});

/* GET /api/auth/me */
router.get("/me", authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.uid },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });
  return res.json({ ok: true, user });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email format" });
    }
    
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Always return success (security: don't reveal if email exists)
    if (!user) {
      return res.json({ 
        ok: true, 
        message: "If an account exists with this email, a reset link has been sent." 
      });
    }
    
    // Generate reset token (32 random bytes as hex)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Save token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });
    
    console.log(`🔐 Reset token generated for ${email}: ${resetToken.substring(0, 8)}...`);
    
    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user, resetToken);
    
    // Always return success (security: don't reveal if email exists)
    // Only return token if email service is not configured (development mode)
    const response = { 
      ok: true, 
      message: "If an account exists with this email, a reset link has been sent."
    };
    
    // For development/testing: if email failed to send, return token
    // REMOVE THIS IN PRODUCTION - only return token when email service is not configured
    if (!emailResult.ok && emailResult.resetToken) {
      console.warn("⚠️  Email service not configured. Returning token for testing.");
      response.resetToken = resetToken;
    }
    
    return res.json(response);
    
  } catch (e) {
    console.error("FORGOT PASSWORD ERROR:", e);
    console.error("Error code:", e.code);
    console.error("Error message:", e.message);
    console.error("Error meta:", e.meta);
    
    // Check if it's a Prisma field error (missing columns)
    if (e.code === "P2025" || e.message?.includes("Unknown arg") || e.message?.includes("resetToken")) {
      return res.status(500).json({ 
        ok: false, 
        error: "Database schema error. Please run: npx prisma migrate dev" 
      });
    }
    
    // Check if it's a database connection error
    if (e.code === "P1001" || e.message?.includes("connect")) {
      return res.status(503).json({ 
        ok: false, 
        error: "Database connection failed. Please check your database settings." 
      });
    }
    
    return res.status(500).json({ 
      ok: false, 
      error: `Failed to process request: ${e.message || "Unknown error"}` 
    });
  }
});

/* POST /api/auth/reset-password  {token, newPassword} */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    
    if (!token) {
      return res.status(400).json({ ok: false, error: "Reset token is required" });
    }
    
    if (!newPassword) {
      return res.status(400).json({ ok: false, error: "New password is required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
    }
    
    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date() // Token not expired
        }
      }
    });
    
    if (!user) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid or expired reset token. Please request a new one." 
      });
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    
    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
    
    console.log(`✅ Password reset successful for ${user.email}`);
    
    return res.json({ 
      ok: true, 
      message: "Password reset successful. You can now log in with your new password." 
    });
    
  } catch (e) {
    console.error("RESET PASSWORD ERROR:", e);
    return res.status(500).json({ 
      ok: false, 
      error: "Failed to reset password. Please try again." 
    });
  }
});

module.exports = { router, authRequired };
