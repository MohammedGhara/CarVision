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

/** Wrong DB password, Postgres down, bad host — https://www.prisma.io/docs/orm/reference/error-reference */
function isPrismaDatabaseUnavailable(e) {
  if (!e || typeof e !== "object") return false;
  const c = String(e.code ?? e.errorCode ?? "");
  if (/^(P1000|P1001|P1002|P1003|P1011|P1017)$/.test(c)) return true;
  const msg = String(e.message ?? "");
  return /Authentication failed|Can't reach database server|Can't reach database|Server has closed the connection/i.test(
    msg
  );
}

const router = express.Router();

/** Same validation as mobile — used to choose email vs username login path */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Uniform JSON for wrong user / wrong password (do not reveal which). */
const INVALID_LOGIN_BODY = {
  ok: false,
  error: "Invalid email/username or password.",
  code: "INVALID_CREDENTIALS",
};

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

/* POST /api/auth/signup  {email, name?, phone?, password, role?} */
router.post("/signup", async (req, res) => {
  console.log("📥 Signup request received:", { 
    email: req.body?.email, 
    name: req.body?.name ? "***" : null, 
    hasPhone: !!req.body?.phone,
    role: req.body?.role,
    hasPassword: !!req.body?.password 
  });
  
  try {
    const { email, name, phone, password, role } = (req.body || {});
    
    // Validate email format
    if (!email) {
      console.log("❌ Validation failed: Email missing");
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    
    const emailTrim = String(email).trim();
    if (!EMAIL_REGEX.test(emailTrim)) {
      console.log("❌ Validation failed: Invalid email format");
      return res.status(400).json({ ok: false, error: "Invalid email format" });
    }
    const emailNorm = emailTrim.toLowerCase();
    
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
    const emailExists = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" } },
    });
    if (emailExists) {
      console.log("❌ Email already exists:", emailNorm);
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    console.log("🔐 Hashing password...");
    const passwordHash = await bcrypt.hash(String(password), 10);

    // Provide default name if not provided (since schema requires it)
    const userName = name && name.trim() ? name.trim() : emailNorm.split("@")[0]; // Use email prefix as fallback
    const phoneTrim = phone != null ? String(phone).trim() : "";
    if (phoneTrim.length > 40) {
      return res.status(400).json({ ok: false, error: "Phone number must be at most 40 characters" });
    }
    console.log("👤 Creating user with name:", userName);

    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        name: userName, // Always provide a name
        phone: phoneTrim || null,
        role: role || "CLIENT",
        passwordHash
      },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, updatedAt: true }
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

    if (isPrismaDatabaseUnavailable(e)) {
      return res.status(503).json({
        ok: false,
        error:
          "Database unavailable. Start Postgres (Docker: apps/server → docker compose up -d) or fix DATABASE_URL (password + port).",
      });
    }

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
    const identifier = String(email || username || "").trim();

    if (!identifier) {
      return res.status(400).json({ ok: false, error: "Email or username is required" });
    }

    if (!password) {
      return res.status(400).json({ ok: false, error: "Password is required" });
    }

    let user = null;
    if (EMAIL_REGEX.test(identifier)) {
      user = await prisma.user.findFirst({
        where: { email: { equals: identifier, mode: "insensitive" } },
      });
    } else {
      user = await prisma.user.findFirst({
        where: { name: identifier },
      });
    }

    if (!user) {
      return res.status(401).json({ ...INVALID_LOGIN_BODY });
    }

    // Check if user has password
    if (!user.passwordHash) {
      return res.status(400).json({
        ok: false,
        error: "This account has no password. Please sign up again.",
      });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ ...INVALID_LOGIN_BODY });
    }

    const clean = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      address: user.address ?? null,
      latitude: user.latitude ?? null,
      longitude: user.longitude ?? null,
      garageDescription: user.garageDescription ?? null,
      workingHoursText: user.workingHoursText ?? null,
    };

    const token = sign(clean);
    return res.json({ ok: true, user: clean, token });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    if (isPrismaDatabaseUnavailable(e)) {
      return res.status(503).json({
        ok: false,
        error:
          "Database unavailable. Start Postgres (Docker: apps/server → docker compose up -d) or fix DATABASE_URL.",
      });
    }
    return res.status(500).json({ ok: false, error: String(e.message || "Login failed. Please try again.") });
  }
});

/* GET /api/auth/me */
router.get("/me", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        role: true, 
        createdAt: true,
        updatedAt: true,
        address: true,
        latitude: true,
        longitude: true,
        garageDescription: true,
        workingHoursText: true,
        phone: true,
        services: true,
        rating: true,
      }
    });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }
    
    return res.json({ ok: true, user });
  } catch (e) {
    console.error("GET /me error:", e);
    return res.status(500).json({ ok: false, error: String(e.message || "Failed to fetch user") });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    
    const emailTrim = String(email).trim();
    if (!EMAIL_REGEX.test(emailTrim)) {
      return res.status(400).json({ ok: false, error: "Invalid email format" });
    }

    // Find user (case-insensitive so it matches login/signup)
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailTrim, mode: "insensitive" } },
    });
    
    // Show error if email doesn't exist - tell user to signup
    if (!user) {
      return res.status(404).json({ 
        ok: false, 
        error: "Email not found. Please sign up to create an account." 
      });
    }
    
    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Save code to database (stored in resetToken field)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetCode,
        resetTokenExpiry
      }
    });
    
    console.log(`🔐 Reset code generated for ${emailTrim}: ${resetCode}`);
    
    // Send password reset email with code
    const emailResult = await sendPasswordResetEmail(user, resetCode);
    
    const response = { 
      ok: true, 
      message: "A 6-digit verification code has been sent to your email. Please check your inbox."
    };
    
    // For development/testing: if email failed to send, return code
    if (!emailResult.ok && emailResult.resetCode) {
      console.warn("⚠️  Email service not configured. Returning code for testing.");
      response.resetCode = resetCode;
    }
    
    return res.json(response);
    
  } catch (e) {
    console.error("FORGOT PASSWORD ERROR:", e);
    console.error("Error code:", e.code);
    console.error("Error message:", e.message);
    console.error("Error meta:", e.meta);

    if (isPrismaDatabaseUnavailable(e)) {
      return res.status(503).json({
        ok: false,
        error:
          "Database unavailable. Start Postgres (Docker: apps/server → docker compose up -d) or fix DATABASE_URL.",
      });
    }

    // Check if it's a Prisma field error (missing columns)
    if (e.code === "P2025" || e.message?.includes("Unknown arg") || e.message?.includes("resetToken")) {
      return res.status(500).json({ 
        ok: false, 
        error: "Database schema error. Please run: npx prisma migrate dev" 
      });
    }

    return res.status(500).json({
      ok: false, 
      error: `Failed to process request: ${e.message || "Unknown error"}` 
    });
  }
});

/* POST /api/auth/verify-reset-code  {email, code} */
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    
    if (!code) {
      return res.status(400).json({ ok: false, error: "Verification code is required" });
    }
    
    const emailTrim = String(email).trim();

    // Find user with matching email and code
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { email: { equals: emailTrim, mode: "insensitive" } },
          { resetToken: String(code) },
          {
            resetTokenExpiry: {
              gt: new Date(), // Code not expired
            },
          },
        ],
      },
    });
    
    if (!user) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid or expired verification code. Please request a new one." 
      });
    }
    
    console.log(`✅ Verification code validated for ${emailTrim}`);
    
    return res.json({ 
      ok: true, 
      message: "Verification code is valid. You can now reset your password.",
      verified: true
    });
    
  } catch (e) {
    console.error("VERIFY RESET CODE ERROR:", e);
    return res.status(500).json({ 
      ok: false, 
      error: "Failed to verify code. Please try again." 
    });
  }
});

/* POST /api/auth/reset-password  {email, code, newPassword} */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    
    if (!code) {
      return res.status(400).json({ ok: false, error: "Verification code is required" });
    }
    
    if (!newPassword) {
      return res.status(400).json({ ok: false, error: "New password is required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
    }
    
    const emailTrim = String(email).trim();

    // Find user with valid code
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { email: { equals: emailTrim, mode: "insensitive" } },
          { resetToken: String(code) },
          {
            resetTokenExpiry: {
              gt: new Date(),
            },
          },
        ],
      },
    });
    
    if (!user) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid or expired verification code. Please request a new one." 
      });
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    
    // Update password and clear reset code
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

const MAX_GARAGE_DESCRIPTION_LEN = 400;
const MAX_WORKING_HOURS_TEXT_LEN = 120;
const MAX_GARAGE_PHONE_LEN = 40;
const MAX_SERVICES_COUNT = 24;
const MAX_SERVICE_LABEL_LEN = 80;

/* PUT /api/auth/update-profile  { name?, email?, phone?, ...garage fields } — phone optional for any role; listing fields GARAGE only */
router.put("/update-profile", authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name,
      email,
      address,
      latitude,
      longitude,
      garageDescription,
      workingHoursText,
      phone,
      services,
    } = body;
    const updates = {};

    const current = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { role: true },
    });
    if (!current) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const hasGarageListingField =
      Object.prototype.hasOwnProperty.call(body, "address") ||
      Object.prototype.hasOwnProperty.call(body, "latitude") ||
      Object.prototype.hasOwnProperty.call(body, "longitude") ||
      Object.prototype.hasOwnProperty.call(body, "garageDescription") ||
      Object.prototype.hasOwnProperty.call(body, "workingHoursText") ||
      Object.prototype.hasOwnProperty.call(body, "services");
    if (hasGarageListingField && current.role !== "GARAGE") {
      return res.status(403).json({ ok: false, error: "Only garages can update garage listing fields" });
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ ok: false, error: "Name is required" });
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ ok: false, error: "Invalid email format" });
      }
      updates.email = email.trim().toLowerCase();
    }

    /** Optional contact phone — allowed for CLIENT and GARAGE */
    if (Object.prototype.hasOwnProperty.call(body, "phone")) {
      if (phone === null || phone === "") {
        updates.phone = null;
      } else {
        const trimmed = String(phone).trim();
        if (trimmed.length > MAX_GARAGE_PHONE_LEN) {
          return res.status(400).json({
            ok: false,
            error: `Phone must be at most ${MAX_GARAGE_PHONE_LEN} characters`,
          });
        }
        updates.phone = trimmed;
      }
    }

    if (current.role === "GARAGE") {
      if (Object.prototype.hasOwnProperty.call(body, "address")) {
        if (address === null || address === "") {
          updates.address = null;
        } else {
          const trimmed = String(address).trim();
          updates.address = trimmed === "" ? null : trimmed;
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, "latitude")) {
        if (latitude === null || latitude === "") {
          updates.latitude = null;
        } else {
          const lat = typeof latitude === "number" ? latitude : parseFloat(String(latitude).trim());
          if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            return res.status(400).json({ ok: false, error: "Latitude must be between -90 and 90" });
          }
          updates.latitude = lat;
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, "longitude")) {
        if (longitude === null || longitude === "") {
          updates.longitude = null;
        } else {
          const lng = typeof longitude === "number" ? longitude : parseFloat(String(longitude).trim());
          if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            return res.status(400).json({ ok: false, error: "Longitude must be between -180 and 180" });
          }
          updates.longitude = lng;
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, "garageDescription")) {
        if (garageDescription === null || garageDescription === "") {
          updates.garageDescription = null;
        } else {
          const trimmed = String(garageDescription).trim();
          if (trimmed.length > MAX_GARAGE_DESCRIPTION_LEN) {
            return res.status(400).json({
              ok: false,
              error: `Description must be at most ${MAX_GARAGE_DESCRIPTION_LEN} characters`,
            });
          }
          updates.garageDescription = trimmed === "" ? null : trimmed;
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, "workingHoursText")) {
        if (workingHoursText === null || workingHoursText === "") {
          updates.workingHoursText = null;
        } else {
          const trimmed = String(workingHoursText).trim();
          if (trimmed.length > MAX_WORKING_HOURS_TEXT_LEN) {
            return res.status(400).json({
              ok: false,
              error: `Working hours must be at most ${MAX_WORKING_HOURS_TEXT_LEN} characters`,
            });
          }
          updates.workingHoursText = trimmed === "" ? null : trimmed;
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, "services")) {
        if (services === null || services === "") {
          updates.services = null;
        } else if (!Array.isArray(services)) {
          return res.status(400).json({ ok: false, error: "services must be an array of strings" });
        } else {
          const cleaned = [];
          for (const raw of services) {
            const s = String(raw ?? "").trim();
            if (!s) continue;
            if (s.length > MAX_SERVICE_LABEL_LEN) {
              return res.status(400).json({
                ok: false,
                error: `Each service label must be at most ${MAX_SERVICE_LABEL_LEN} characters`,
              });
            }
            cleaned.push(s);
            if (cleaned.length > MAX_SERVICES_COUNT) {
              return res.status(400).json({
                ok: false,
                error: `At most ${MAX_SERVICES_COUNT} services allowed`,
              });
            }
          }
          updates.services = cleaned.length ? cleaned : null;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: "Nothing to update" });
    }

    if (updates.email) {
      const existing = await prisma.user.findUnique({ where: { email: updates.email } });
      if (existing && existing.id !== req.user.uid) {
        return res.status(409).json({ ok: false, error: "Email already registered" });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.uid },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        address: true,
        latitude: true,
        longitude: true,
        garageDescription: true,
        workingHoursText: true,
        phone: true,
        services: true,
        rating: true,
      },
    });

    return res.json({ ok: true, user });
  } catch (e) {
    console.error("UPDATE PROFILE ERROR:", e);
    if (e.code === "P2002" && e.meta?.target?.includes("email")) {
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }
    return res.status(500).json({ ok: false, error: "Failed to update profile" });
  }
});

module.exports = { router, authRequired };
