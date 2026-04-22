// apps/server/src/routes/garages.js — authenticated garage discovery APIs
"use strict";
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authRequired } = require("../auth");

const router = express.Router();
const prisma = new PrismaClient();

const EARTH_RADIUS_KM = 6371;

/** Haversine distance in kilometers between two WGS-84 points. */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function parseRequiredNumber(value, field) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: false, error: `${field} is required` };
  }
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${field} must be a valid number` };
  }
  return { ok: true, value: n };
}

function parseOptionalLimit(value, defaultLimit = 10, max = 50) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: defaultLimit };
  }
  const n = Number(String(value).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > max) {
    return {
      ok: false,
      error: `limit must be an integer between 1 and ${max}`,
    };
  }
  return { ok: true, value: n };
}

// GET /api/garages/nearby?lat=...&lng=...&limit=10
router.get("/nearby", authRequired, async (req, res) => {
  try {
    const latParsed = parseRequiredNumber(req.query.lat, "lat");
    if (!latParsed.ok) {
      return res.status(400).json({ ok: false, error: latParsed.error });
    }
    const lngParsed = parseRequiredNumber(req.query.lng, "lng");
    if (!lngParsed.ok) {
      return res.status(400).json({ ok: false, error: lngParsed.error });
    }

    const { value: lat } = latParsed;
    const { value: lng } = lngParsed;

    if (lat < -90 || lat > 90) {
      return res.status(400).json({
        ok: false,
        error: "lat must be between -90 and 90",
      });
    }
    if (lng < -180 || lng > 180) {
      return res.status(400).json({
        ok: false,
        error: "lng must be between -180 and 180",
      });
    }

    const limitParsed = parseOptionalLimit(req.query.limit, 10, 50);
    if (!limitParsed.ok) {
      return res.status(400).json({ ok: false, error: limitParsed.error });
    }
    const limit = limitParsed.value;

    const rows = await prisma.user.findMany({
      where: {
        role: "GARAGE",
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        latitude: true,
        longitude: true,
        garageDescription: true,
        workingHoursText: true,
      },
    });

    const withDistance = rows
      .filter(
        (g) =>
          g.latitude != null &&
          g.longitude != null &&
          Number.isFinite(g.latitude) &&
          Number.isFinite(g.longitude)
      )
      .map((g) => {
        const distanceKm = haversineKm(lat, lng, g.latitude, g.longitude);
        const rounded =
          Math.round(distanceKm * 100) / 100;
        const descTrim =
          g.garageDescription != null && String(g.garageDescription).trim() !== ""
            ? String(g.garageDescription).trim()
            : null;
        const hoursTrim =
          g.workingHoursText != null && String(g.workingHoursText).trim() !== ""
            ? String(g.workingHoursText).trim()
            : null;
        return {
          id: g.id,
          name: g.name,
          email: g.email,
          address: g.address,
          latitude: g.latitude,
          longitude: g.longitude,
          distanceKm: rounded,
          garageDescription: descTrim,
          workingHoursText: hoursTrim,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return res.json({ ok: true, garages: withDistance });
  } catch (e) {
    console.error("GET /garages/nearby error:", e);
    return res.status(500).json({ ok: false, error: String(e.message) });
  }
});

module.exports = router;
