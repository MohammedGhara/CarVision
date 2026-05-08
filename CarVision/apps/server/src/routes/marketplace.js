// apps/server/src/routes/marketplace.js — marketplace listings (Sprint 1)
"use strict";
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const { authRequired } = require("../auth");

const router = express.Router();
const prisma = new PrismaClient();

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 4000;
const MAX_PRICE_CENTS = 99_999_999;

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || "";
    cb(null, "marketplace-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"), false);
  },
});

function maybeUploadImage(req, res, next) {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    return upload.single("image")(req, res, next);
  }
  next();
}

function uploadsLocalPath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const s = imageUrl.trim();
  let tail = null;
  const mAbs = s.match(/\/uploads\/([^/?#\s]+)/);
  if (mAbs) tail = mAbs[1];
  else {
    const mRel = s.match(/^uploads\/([^/?#\s]+)/i);
    if (mRel) tail = mRel[1];
  }
  if (!tail) return null;
  const base = path.basename(tail);
  if (!base || base === "." || base === "..") return null;
  const candidate = path.resolve(path.join(UPLOADS_DIR, base));
  const root = path.resolve(UPLOADS_DIR);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

function tryUnlinkUpload(imageUrl) {
  const full = uploadsLocalPath(imageUrl);
  if (!full) {
    if (imageUrl && String(imageUrl).trim()) {
      console.warn("[marketplace] Could not map imageUrl to uploads dir:", imageUrl);
    }
    return false;
  }
  try {
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      return true;
    }
  } catch (e) {
    console.error("[marketplace] Failed to delete upload file:", full, e.message || e);
  }
  return false;
}

function parsePriceCents(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  if (body.priceCents !== undefined && body.priceCents !== null && String(body.priceCents).trim() !== "") {
    const n = Number(body.priceCents);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return { ok: false, error: "priceCents must be a positive integer" };
    }
    return { ok: true, value: n };
  }
  const raw = body.price != null ? String(body.price).trim() : "";
  if (raw === "") return { ok: false, error: "price or priceCents is required" };
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    return { ok: false, error: "price must be a positive number" };
  }
  return { ok: true, value: Math.round(num * 100) };
}

function parseOptionalCompareAtPriceCents(body) {
  if (!body || typeof body !== "object") return { ok: true, value: null };
  if (body.compareAtPriceCents !== undefined && body.compareAtPriceCents !== null && String(body.compareAtPriceCents).trim() !== "") {
    const n = Number(body.compareAtPriceCents);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return { ok: false, error: "compareAtPriceCents must be a positive integer" };
    }
    return { ok: true, value: n };
  }
  if (body.compareAtPrice !== undefined && body.compareAtPrice !== null && String(body.compareAtPrice).trim() !== "") {
    const n = Number(String(body.compareAtPrice).trim());
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: "compareAtPrice must be a positive number" };
    }
    return { ok: true, value: Math.round(n * 100) };
  }
  return { ok: true, value: null };
}

function validateListingFields(title, description, priceCents, compareAtPriceCents) {
  const t = title != null ? String(title).trim() : "";
  if (!t) return { ok: false, error: "title is required" };
  if (t.length > MAX_TITLE) return { ok: false, error: `title must be at most ${MAX_TITLE} characters` };
  const d = description != null ? String(description).trim() : "";
  if (d.length > MAX_DESCRIPTION) {
    return { ok: false, error: `description must be at most ${MAX_DESCRIPTION} characters` };
  }
  if (priceCents > MAX_PRICE_CENTS) return { ok: false, error: "price is too large" };
  if (compareAtPriceCents != null) {
    if (!Number.isInteger(compareAtPriceCents) || compareAtPriceCents <= 0) {
      return { ok: false, error: "compareAtPriceCents must be a positive integer" };
    }
    if (compareAtPriceCents <= priceCents) {
      return { ok: false, error: "compareAtPriceCents must be greater than priceCents" };
    }
    if (compareAtPriceCents > MAX_PRICE_CENTS) {
      return { ok: false, error: "compare-at price is too large" };
    }
  }
  return { ok: true, title: t, description: d, priceCents, compareAtPriceCents };
}

const sellerSelect = {
  id: true,
  name: true,
  email: true,
  address: true,
  latitude: true,
  longitude: true,
  garageDescription: true,
  workingHoursText: true,
};

function listingResponse(row) {
  if (!row) return null;
  const { seller, ...rest } = row;
  return {
    ...rest,
    seller: seller
      ? {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          address: seller.address,
          latitude: seller.latitude,
          longitude: seller.longitude,
          garageDescription: seller.garageDescription,
          workingHoursText: seller.workingHoursText,
        }
      : undefined,
  };
}

// GET /api/marketplace/mine — seller's listings (including inactive)
router.get("/mine", authRequired, async (req, res) => {
  try {
    if (req.user.role !== "GARAGE") {
      return res.status(403).json({ ok: false, error: "Only garage accounts can view their listings" });
    }
    const rows = await prisma.marketplaceListing.findMany({
      where: { sellerId: req.user.uid },
      include: { seller: { select: sellerSelect } },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ ok: true, listings: rows.map(listingResponse) });
  } catch (e) {
    console.error("GET /marketplace/mine error:", e);
    return res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// GET /api/marketplace — active listings (all authenticated users)
router.get("/", authRequired, async (req, res) => {
  try {
    const q = req.query.q != null ? String(req.query.q).trim() : "";
    const where = {
      isActive: true,
      seller: { role: "GARAGE" },
      ...(q
        ? {
            title: { contains: q, mode: "insensitive" },
          }
        : {}),
    };
    const rows = await prisma.marketplaceListing.findMany({
      where,
      include: { seller: { select: sellerSelect } },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return res.json({ ok: true, listings: rows.map(listingResponse) });
  } catch (e) {
    console.error("GET /marketplace error:", e);
    return res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// GET /api/marketplace/garage/:garageId — active listings for a specific garage
router.get("/garage/:garageId", authRequired, async (req, res) => {
  try {
    const garageId = req.params.garageId != null ? String(req.params.garageId).trim() : "";
    if (!garageId) {
      return res.status(400).json({ ok: false, error: "garageId is required" });
    }

    const rows = await prisma.marketplaceListing.findMany({
      where: {
        sellerId: garageId,
        isActive: true,
        seller: { role: "GARAGE" },
      },
      include: { seller: { select: sellerSelect } },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return res.json({ ok: true, listings: rows.map(listingResponse) });
  } catch (e) {
    console.error("GET /marketplace/garage/:garageId error:", e);
    return res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// GET /api/marketplace/:id
router.get("/:id", authRequired, async (req, res) => {
  try {
    const row = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
      include: { seller: { select: sellerSelect } },
    });
    if (!row) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }
    const isOwner = row.sellerId === req.user.uid;
    if (!row.isActive && !isOwner) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }
    return res.json({ ok: true, listing: listingResponse(row) });
  } catch (e) {
    console.error("GET /marketplace/:id error:", e);
    return res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// POST /api/marketplace — create (GARAGE only); JSON or multipart with optional image
router.post("/", authRequired, maybeUploadImage, async (req, res) => {
  const file = req.file;
  try {
    if (req.user.role !== "GARAGE") {
      if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
      return res.status(403).json({ ok: false, error: "Only garage accounts can create listings" });
    }

    const seller = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { role: true },
    });
    if (!seller || seller.role !== "GARAGE") {
      if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
      return res.status(403).json({ ok: false, error: "Only garage accounts can create listings" });
    }

    const priceParsed = parsePriceCents(req.body);
    if (!priceParsed.ok) {
      if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
      return res.status(400).json({ ok: false, error: priceParsed.error });
    }

    const compareParsed = parseOptionalCompareAtPriceCents(req.body);
    if (!compareParsed.ok) {
      if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
      return res.status(400).json({ ok: false, error: compareParsed.error });
    }

    const fields = validateListingFields(
      req.body.title,
      req.body.description,
      priceParsed.value,
      compareParsed.value
    );
    if (!fields.ok) {
      if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
      return res.status(400).json({ ok: false, error: fields.error });
    }

    const isFeatured =
      req.body.isFeatured === true ||
      req.body.isFeatured === "true" ||
      req.body.isFeatured === "1";

    let imageUrl = null;
    if (file) imageUrl = `/uploads/${file.filename}`;

    const row = await prisma.marketplaceListing.create({
      data: {
        sellerId: req.user.uid,
        title: fields.title,
        description: fields.description,
        priceCents: fields.priceCents,
        compareAtPriceCents: fields.compareAtPriceCents,
        imageUrl,
        isFeatured,
      },
      include: { seller: { select: sellerSelect } },
    });
    return res.status(201).json({ ok: true, listing: listingResponse(row) });
  } catch (e) {
    if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
    console.error("POST /marketplace error:", e);
    return res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// PUT /api/marketplace/:id — update own listing
router.put("/:id", authRequired, maybeUploadImage, async (req, res) => {
  const file = req.file;
  try {
    if (req.user.role !== "GARAGE") {
      if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
      return res.status(403).json({ ok: false, error: "Only garage accounts can update listings" });
    }

    const existing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
    });
    if (!existing || existing.sellerId !== req.user.uid) {
      if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }

    const nextTitle =
      req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
    const nextDesc =
      req.body.description !== undefined ? String(req.body.description).trim() : existing.description;

    let nextPrice = existing.priceCents;
    if (req.body.priceCents !== undefined || req.body.price !== undefined) {
      const priceParsed = parsePriceCents(req.body);
      if (!priceParsed.ok) {
        if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
        return res.status(400).json({ ok: false, error: priceParsed.error });
      }
      nextPrice = priceParsed.value;
    }

    let nextCompareAt = existing.compareAtPriceCents;
    if (req.body.compareAtPriceCents !== undefined || req.body.compareAtPrice !== undefined) {
      const compareParsed = parseOptionalCompareAtPriceCents(req.body);
      if (!compareParsed.ok) {
        if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
        return res.status(400).json({ ok: false, error: compareParsed.error });
      }
      nextCompareAt = compareParsed.value;
    }
    const clearCompareAt =
      req.body.clearCompareAtPrice === true ||
      req.body.clearCompareAtPrice === "true" ||
      req.body.clearCompareAtPrice === "1";
    if (clearCompareAt) {
      nextCompareAt = null;
    }

    const fields = validateListingFields(nextTitle, nextDesc, nextPrice, nextCompareAt);
    if (!fields.ok) {
      if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
      return res.status(400).json({ ok: false, error: fields.error });
    }

    let nextImage = existing.imageUrl;
    const removeImage =
      req.body.removeImage === true ||
      req.body.removeImage === "true" ||
      req.body.removeImage === "1";

    if (file) {
      tryUnlinkUpload(existing.imageUrl);
      nextImage = `/uploads/${file.filename}`;
    } else if (removeImage) {
      tryUnlinkUpload(existing.imageUrl);
      nextImage = null;
    }

    let nextActive = existing.isActive;
    if (req.body.isActive !== undefined) {
      const v = req.body.isActive;
      nextActive = v === true || v === "true" || v === "1";
    }
    let nextFeatured = existing.isFeatured;
    if (req.body.isFeatured !== undefined) {
      const v = req.body.isFeatured;
      nextFeatured = v === true || v === "true" || v === "1";
    }

    const row = await prisma.marketplaceListing.update({
      where: { id: req.params.id },
      data: {
        title: fields.title,
        description: fields.description,
        priceCents: fields.priceCents,
        compareAtPriceCents: fields.compareAtPriceCents,
        imageUrl: nextImage,
        isFeatured: nextFeatured,
        isActive: nextActive,
      },
      include: { seller: { select: sellerSelect } },
    });
    return res.json({ ok: true, listing: listingResponse(row) });
  } catch (e) {
    if (file) tryUnlinkUpload(`/uploads/${file.filename}`);
    console.error("PUT /marketplace/:id error:", e);
    return res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// DELETE /api/marketplace/:id — remove own listing and local image
router.delete("/:id", authRequired, async (req, res) => {
  try {
    if (req.user.role !== "GARAGE") {
      return res.status(403).json({ ok: false, error: "Only garage accounts can delete listings" });
    }
    const existing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
    });
    if (!existing || existing.sellerId !== req.user.uid) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }
    tryUnlinkUpload(existing.imageUrl);
    await prisma.marketplaceListing.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /marketplace/:id error:", e);
    return res.status(500).json({ ok: false, error: String(e.message) });
  }
});

module.exports = router;
