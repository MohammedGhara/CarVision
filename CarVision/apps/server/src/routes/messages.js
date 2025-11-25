// apps/server/src/routes/messages.js
"use strict";
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authRequired } = require("../auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const prisma = new PrismaClient();

// File upload configuration
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, "file-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, and documents
    const allowedMimes = [
      // Images
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
      // Videos
      "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo",
      // Documents
      "application/pdf", "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", "application/rtf"
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: images, videos, PDF, Word, Excel, text files.`), false);
    }
  },
});

// Helper function to determine message type from MIME type
function getMessageType(mimeType) {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

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

// POST /api/messages - Send a text message or file
router.post("/", authRequired, upload.single("file"), async (req, res) => {
  try {
    const { receiverId, content } = req.body || {};
    const file = req.file;
    
    if (!receiverId) {
      // If file was uploaded but receiverId missing, delete the file
      if (file) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      return res.status(400).json({ ok: false, error: "Receiver ID is required" });
    }

    // Must have either content or file
    if ((!content || !content.trim()) && !file) {
      return res.status(400).json({ ok: false, error: "Message content or file is required" });
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      // Delete uploaded file if receiver not found
      if (file) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      return res.status(404).json({ ok: false, error: "Receiver not found" });
    }

    // Ensure user is messaging between CLIENT and GARAGE
    const sender = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { role: true },
    });

    if (sender.role === receiver.role) {
      // Delete uploaded file if roles don't match
      if (file) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      return res.status(400).json({ ok: false, error: "Can only message between CLIENT and GARAGE" });
    }

    // Determine message type and prepare data
    let messageType = "TEXT";
    let fileName = null;
    let fileUrl = null;
    let fileType = null;
    let fileSize = null;

    if (file) {
      messageType = getMessageType(file.mimetype);
      fileName = file.originalname;
      // File URL will be relative to server base URL
      fileUrl = `/uploads/${file.filename}`;
      fileType = file.mimetype;
      fileSize = file.size;
    }

    const messageContent = content ? content.trim() : (file ? fileName : "");

    const message = await prisma.message.create({
      data: {
        senderId: req.user.uid,
        receiverId,
        content: messageContent,
        type: messageType,
        fileName: fileName,
        fileUrl: fileUrl,
        mimeType: fileType,
        fileSize: fileSize,
      },
    });

    res.json({ ok: true, message });
  } catch (e) {
    // If file was uploaded but error occurred, try to delete it
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
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

// DELETE /api/messages/conversation/:userId - Delete entire conversation with a user
// NOTE: This must come BEFORE /:id route to avoid route matching conflicts
router.delete("/conversation/:userId", authRequired, async (req, res) => {
  console.log("DELETE /api/messages/conversation/:userId called", { userId: req.user.uid, otherUserId: req.params.userId });
  try {
    const otherUserId = req.params.userId;
    const userId = req.user.uid;

    // Get all messages in the conversation
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      select: {
        id: true,
        fileUrl: true,
      },
    });

    // Delete all associated files from disk
    const deletedFiles = [];
    for (const msg of messages) {
      if (msg.fileUrl) {
        const filePath = path.join(UPLOADS_DIR, path.basename(msg.fileUrl));
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles.push(filePath);
          }
        } catch (fileError) {
          console.error("Error deleting file:", filePath, fileError);
        }
      }
    }

    // Delete all messages from database
    const deleteResult = await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });

    console.log(`Deleted ${deleteResult.count} messages and ${deletedFiles.length} files`);

    res.json({ 
      ok: true, 
      message: "Conversation deleted successfully",
      deletedMessages: deleteResult.count,
      deletedFiles: deletedFiles.length,
    });
  } catch (e) {
    console.error("DELETE /messages/conversation/:userId error:", e);
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// DELETE /api/messages/:id - Delete a message (and optionally its file)
// NOTE: This must come AFTER /conversation/:userId route to avoid route matching conflicts
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

    // Delete the file from disk if it exists
    if (message.fileUrl) {
      const filePath = path.join(UPLOADS_DIR, path.basename(message.fileUrl));
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("Deleted file from disk:", filePath);
        }
      } catch (fileError) {
        console.error("Error deleting file:", fileError);
        // Continue with message deletion even if file deletion fails
      }
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

