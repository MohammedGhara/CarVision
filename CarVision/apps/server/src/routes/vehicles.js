// apps/server/src/routes/vehicles.js
"use strict";
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authRequired } = require("../auth");
const { sendVehicleDoneEmail } = require("../email");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/vehicles/garages - Get all garages (for client to select when adding vehicle)
router.get("/garages", authRequired, async (req, res) => {
  try {
    const garages = await prisma.user.findMany({
      where: { role: "GARAGE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    res.json({ ok: true, garages });
  } catch (e) {
    console.error("GET /vehicles/garages error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// GET /api/vehicles - Get vehicles based on user role
// For CLIENT: Get vehicles they own
// For GARAGE: Get vehicles sent to them
router.get("/", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { role: true },
    });

    let vehicles;
    if (user.role === "GARAGE") {
      // Garages see vehicles sent to them AND vehicles they added
      vehicles = await prisma.vehicle.findMany({
        where: {
          OR: [
            { garageId: req.user.uid },
            { ownerId: req.user.uid }, // Vehicles added by garage
          ],
        },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          garage: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Clients see their own vehicles AND vehicles added by garages for them
      vehicles = await prisma.vehicle.findMany({
        where: { ownerId: req.user.uid },
        include: {
          garage: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }
    res.json({ ok: true, vehicles });
  } catch (e) {
    console.error("GET /vehicles error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// GET /api/vehicles/:id - Get a specific vehicle
router.get("/:id", authRequired, async (req, res) => {
  try {
    // Prevent "garages" from being treated as an ID
    if (req.params.id === "garages") {
      return res.status(404).json({ ok: false, error: "Invalid vehicle ID" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { role: true },
    });

    let vehicle;
    if (user.role === "GARAGE") {
      vehicle = await prisma.vehicle.findFirst({
        where: {
          id: req.params.id,
          garageId: req.user.uid,
        },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    } else {
      vehicle = await prisma.vehicle.findFirst({
        where: {
          id: req.params.id,
          ownerId: req.user.uid,
        },
        include: {
          garage: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }

    if (!vehicle) {
      return res.status(404).json({ ok: false, error: "Vehicle not found" });
    }
    res.json({ ok: true, vehicle });
  } catch (e) {
    console.error("GET /vehicles/:id error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// POST /api/vehicles - Create a new vehicle
router.post("/", authRequired, async (req, res) => {
  try {
    const { make, model, year, vin, licensePlate, color, mileage, notes, garageId } = req.body || {};
    
    if (!make || !model) {
      return res.status(400).json({ ok: false, error: "Make and model are required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { role: true },
    });

    // If client, garageId is required
    // If garage, they can add vehicles and assign to clients (ownerId should be provided)
    if (user.role === "CLIENT" && !garageId) {
      return res.status(400).json({ ok: false, error: "Garage selection is required" });
    }

    // Verify garage exists if provided
    if (garageId) {
      const garage = await prisma.user.findUnique({
        where: { id: garageId, role: "GARAGE" },
      });
      if (!garage) {
        return res.status(400).json({ ok: false, error: "Invalid garage selected" });
      }
    }

    // If garage is adding vehicle, they can specify ownerId (client)
    let finalOwnerId = req.user.uid;
    if (user.role === "GARAGE" && req.body.ownerId) {
      // Verify owner (client) exists
      const owner = await prisma.user.findUnique({
        where: { id: req.body.ownerId, role: "CLIENT" },
      });
      if (!owner) {
        return res.status(400).json({ ok: false, error: "Invalid client selected" });
      }
      finalOwnerId = req.body.ownerId;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        make: make.trim(),
        model: model.trim(),
        year: year ? parseInt(year) : null,
        vin: vin?.trim() || null,
        licensePlate: licensePlate?.trim() || null,
        color: color?.trim() || null,
        mileage: mileage ? parseInt(mileage) : null,
        notes: notes?.trim() || null,
        ownerId: finalOwnerId,
        garageId: user.role === "CLIENT" ? garageId : (user.role === "GARAGE" ? req.user.uid : null),
        status: "PENDING",
      },
      include: {
        garage: user.role === "CLIENT" ? {
          select: { id: true, name: true, email: true },
        } : undefined,
        owner: user.role === "GARAGE" ? {
          select: { id: true, name: true, email: true },
        } : undefined,
      },
    });

    res.json({ ok: true, vehicle });
  } catch (e) {
    console.error("POST /vehicles error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// PUT /api/vehicles/:id - Update a vehicle
router.put("/:id", authRequired, async (req, res) => {
  try {
    const { make, model, year, vin, licensePlate, color, mileage, notes, status } = req.body || {};
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { role: true },
    });

    // Check if vehicle exists and user has access
    let existing;
    if (user.role === "GARAGE") {
      // Garages can edit vehicles sent to them OR vehicles they added
      existing = await prisma.vehicle.findFirst({
        where: {
          id: req.params.id,
          OR: [
            { garageId: req.user.uid },
            { ownerId: req.user.uid }, // Vehicles added by garage
          ],
        },
      });
    } else {
      existing = await prisma.vehicle.findFirst({
        where: {
          id: req.params.id,
          ownerId: req.user.uid,
        },
      });
    }

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Vehicle not found" });
    }

    // Only garages can update status
    const updateData = {
      ...(make !== undefined && { make: make.trim() }),
      ...(model !== undefined && { model: model.trim() }),
      ...(year !== undefined && { year: year ? parseInt(year) : null }),
      ...(vin !== undefined && { vin: vin?.trim() || null }),
      ...(licensePlate !== undefined && { licensePlate: licensePlate?.trim() || null }),
      ...(color !== undefined && { color: color?.trim() || null }),
      ...(mileage !== undefined && { mileage: mileage ? parseInt(mileage) : null }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
    };

    // Only garages can update status
    const statusChanged = user.role === "GARAGE" && status !== undefined && existing.status !== status;
    const statusChangedToDone = statusChanged && status === "DONE";
    
    if (user.role === "GARAGE" && status !== undefined) {
      if (["PENDING", "IN_FIXING", "DONE"].includes(status)) {
        updateData.status = status;
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        garage: {
          select: { id: true, name: true, email: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Send email notification if status changed to DONE
    if (statusChangedToDone && vehicle.owner && vehicle.garage) {
      // Send email asynchronously (don't wait for it)
      sendVehicleDoneEmail(vehicle.owner, vehicle, vehicle.garage).catch(err => {
        console.error("Failed to send vehicle done email:", err);
      });
    }

    res.json({ ok: true, vehicle });
  } catch (e) {
    console.error("PUT /vehicles/:id error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// DELETE /api/vehicles/:id - Delete a vehicle (only by owner)
router.delete("/:id", authRequired, async (req, res) => {
  try {
    // Only owners can delete vehicles
    const existing = await prisma.vehicle.findFirst({
      where: {
        id: req.params.id,
        ownerId: req.user.uid,
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Vehicle not found" });
    }

    await prisma.vehicle.delete({
      where: { id: req.params.id },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /vehicles/:id error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

module.exports = router;

