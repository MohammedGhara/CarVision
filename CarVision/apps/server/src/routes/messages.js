// apps/server/src/routes/messages.js
"use strict";
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authRequired } = require("../auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/messages/conversations - Get all conversations for the user
router.get("/conversations", authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get all unique users the current user has messaged with
    const sentTo = await prisma.message.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ["receiverId"],
    });
    
    const receivedFrom = await prisma.message.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ["senderId"],
    });

    const allUserIds = new Set();
    sentTo.forEach(m => allUserIds.add(m.receiverId));
    receivedFrom.forEach(m => allUserIds.add(m.senderId));

    // Get user details and last message for each conversation
    const conversations = await Promise.all(
      Array.from(allUserIds).map(async (otherUserId) => {
        const otherUser = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, name: true, email: true, role: true },
        });

        if (!otherUser) return null;

        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        const unreadCount = await prisma.message.count({
          where: {
            senderId: otherUserId,
            receiverId: userId,
            read: false,
          },
        });

        return {
          user: otherUser,
          lastMessage,
          unreadCount,
        };
      })
    );

    res.json({ ok: true, conversations: conversations.filter(Boolean) });
  } catch (e) {
    console.error("GET /messages/conversations error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// GET /api/messages/:userId - Get messages with a specific user
router.get("/:userId", authRequired, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const userId = req.user.uid;

    // Verify other user exists
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!otherUser) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Get all messages between the two users
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        read: false,
      },
      data: { read: true },
    });

    res.json({ ok: true, messages, otherUser });
  } catch (e) {
    console.error("GET /messages/:userId error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// POST /api/messages - Send a text message
router.post("/", authRequired, async (req, res) => {
  try {
    const { receiverId, content } = req.body || {};
    
    if (!receiverId) {
      return res.status(400).json({ ok: false, error: "Receiver ID is required" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ ok: false, error: "Message content is required" });
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return res.status(404).json({ ok: false, error: "Receiver not found" });
    }

    // Ensure user is messaging between CLIENT and GARAGE
    const sender = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { role: true },
    });

    if (sender.role === receiver.role) {
      return res.status(400).json({ ok: false, error: "Can only message between CLIENT and GARAGE" });
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.user.uid,
        receiverId,
        content: content.trim(),
        type: "TEXT",
      },
    });

    res.json({ ok: true, message });
  } catch (e) {
    console.error("POST /messages error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});


// GET /api/messages/users/:role - Get users of a specific role
// For GARAGE users: only show CLIENTs who have sent messages
// For CLIENT users: show all GARAGEs (so they can start conversations)
router.get("/users/:role", authRequired, async (req, res) => {
  try {
    const role = req.params.role.toUpperCase();
    if (role !== "CLIENT" && role !== "GARAGE") {
      return res.status(400).json({ ok: false, error: "Invalid role" });
    }

    const currentUserId = req.user.uid;
    
    // Get current user's role
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    // If current user is GARAGE and requesting CLIENTs, only show clients who sent messages
    if (currentUser.role === "GARAGE" && role === "CLIENT") {
      const messagesFromUsers = await prisma.message.findMany({
        where: {
          receiverId: currentUserId,
          sender: {
            role: "CLIENT",
          },
        },
        select: {
          senderId: true,
        },
        distinct: ["senderId"],
      });

      const userIds = messagesFromUsers.map(m => m.senderId);

      // If no messages found, return empty array
      if (userIds.length === 0) {
        return res.json({ ok: true, users: [] });
      }

      // Get user details for those who sent messages
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          role: "CLIENT",
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });

      return res.json({ ok: true, users });
    }

    // For CLIENT users requesting GARAGEs, or any other case, show all users of that role
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    res.json({ ok: true, users });
  } catch (e) {
    console.error("GET /messages/users/:role error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});


// DELETE /api/messages/:id - Delete a message (and optionally its file)
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.uid;

    // Find the message - user must be sender or receiver
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
    });

    if (!message) {
      return res.status(404).json({ ok: false, error: "Message not found or unauthorized" });
    }

    // Delete the message
    await prisma.message.delete({
      where: { id: messageId },
    });

    res.json({ ok: true, message: "Message deleted successfully" });
  } catch (e) {
    console.error("DELETE /messages/:id error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

module.exports = router;

