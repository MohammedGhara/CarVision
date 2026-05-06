// apps/server/src/routes/forum.js — Community forum API
"use strict";
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const { PrismaClient, ForumPostStatus } = require("@prisma/client");
const { authRequired } = require("../auth");

const prisma = new PrismaClient();
const router = express.Router();

const MAX_TITLE = 200;
const MAX_DESC = 8000;
const MAX_COMMENT = 4000;

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const forumStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || "";
    cb(null, "forum-" + uniqueSuffix + ext);
  },
});

const forumUpload = multer({
  storage: forumStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"), false);
  },
});

function maybeUploadForumImage(req, res, next) {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    return forumUpload.single("image")(req, res, next);
  }
  next();
}

function unlinkForumUpload(file) {
  if (!file?.filename) return;
  try {
    const full = path.join(UPLOADS_DIR, file.filename);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (_) {}
}

const CATEGORIES = [
  "Engine",
  "Battery",
  "Tires",
  "Brakes",
  "Transmission",
  "Cooling System",
  "Fuel System",
  "Electrical",
  "OBD-II / DTC Codes",
  "Maintenance",
  "General Question",
];

function serializePost(p, { likedPostIds = new Set(), userId = null } = {}) {
  return {
    id: p.id,
    userId: p.authorId,
    authorName: p.author?.name ?? "User",
    authorRole: p.author?.role ?? "CLIENT",
    title: p.title,
    description: p.description,
    category: p.category,
    carBrand: p.carBrand,
    carModel: p.carModel,
    carYear: p.carYear,
    engineType: p.engineType,
    dtcCode: p.dtcCode,
    imageUrl: p.imageUrl ?? null,
    status: p.status === ForumPostStatus.SOLVED ? "solved" : "open",
    likes: p.likesCount,
    commentsCount: p.commentsCount,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    likedByMe: likedPostIds.has(p.id),
    isAuthor: !!(userId && p.authorId === userId),
  };
}

function serializeComment(c, { likedCommentIds = new Set() } = {}) {
  return {
    id: c.id,
    postId: c.postId,
    userId: c.authorId,
    authorName: c.author?.name ?? "User",
    authorRole: c.author?.role ?? "CLIENT",
    content: c.content,
    likes: c.likesCount,
    isSolution: c.isSolution,
    createdAt: c.createdAt.toISOString(),
    likedByMe: likedCommentIds.has(c.id),
  };
}

async function getUserIdFromOptionalToken(req) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return null;
  try {
    const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
    const p = jwt.verify(token, JWT_SECRET);
    return p.uid || null;
  } catch {
    return null;
  }
}

/** GET /api/forum/posts */
router.get("/posts", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const category = (req.query.category || "").trim();
    const sort = (req.query.sort || "newest").toLowerCase();
    const take = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10) || 50));

    const where = {};
    if (category && category !== "all") {
      where.category = category;
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { dtcCode: { contains: q, mode: "insensitive" } },
      ];
    }
    if (sort === "solved") {
      where.status = ForumPostStatus.SOLVED;
    } else if (sort === "unanswered") {
      where.commentsCount = 0;
    }

    let orderBy = { createdAt: "desc" };
    if (sort === "helpful") {
      orderBy = [{ likesCount: "desc" }, { createdAt: "desc" }];
    }

    const posts = await prisma.forumPost.findMany({
      where,
      orderBy,
      take,
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    const uid = await getUserIdFromOptionalToken(req);
    let likedPostIds = new Set();
    if (uid && posts.length) {
      const likes = await prisma.forumPostLike.findMany({
        where: { userId: uid, postId: { in: posts.map((p) => p.id) } },
        select: { postId: true },
      });
      likedPostIds = new Set(likes.map((l) => l.postId));
    }

    res.json({
      ok: true,
      posts: posts.map((p) => serializePost(p, { likedPostIds, userId: uid })),
    });
  } catch (e) {
    console.error("forum list", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** GET /api/forum/posts/:id */
router.get("/posts/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const userId = await getUserIdFromOptionalToken(req);

    const post = await prisma.forumPost.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, role: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!post) return res.status(404).json({ ok: false, error: "Post not found" });

    let likedPostIds = new Set();
    let likedCommentIds = new Set();
    if (userId) {
      const [pl, cl] = await Promise.all([
        prisma.forumPostLike.findMany({ where: { userId, postId: id }, select: { postId: true } }),
        prisma.forumCommentLike.findMany({
          where: { userId, commentId: { in: post.comments.map((c) => c.id) } },
          select: { commentId: true },
        }),
      ]);
      likedPostIds = new Set(pl.map((x) => x.postId));
      likedCommentIds = new Set(cl.map((x) => x.commentId));
    }

    res.json({
      ok: true,
      post: serializePost(post, { likedPostIds, userId }),
      comments: post.comments.map((c) => serializeComment(c, { likedCommentIds })),
    });
  } catch (e) {
    console.error("forum get", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** POST /api/forum/posts — JSON or multipart (optional image field "image") */
router.post("/posts", authRequired, maybeUploadForumImage, async (req, res) => {
  try {
    const uid = req.user.uid;
    const b = req.body || {};
    const title = (b.title || "").trim();
    const description = (b.description || "").trim();
    const category = (b.category || "").trim();

    const fail = (status, msg) => {
      unlinkForumUpload(req.file);
      return res.status(status).json({ ok: false, error: msg });
    };

    if (!title) return fail(400, "Title is required");
    if (!description) return fail(400, "Description is required");
    if (!category) return fail(400, "Category is required");
    if (!CATEGORIES.includes(category)) {
      return fail(400, "Invalid category");
    }
    if (title.length > MAX_TITLE) return fail(400, "Title too long");
    if (description.length > MAX_DESC) return fail(400, "Description too long");

    const carYearRaw = b.carYear;
    const carYear =
      carYearRaw != null && carYearRaw !== ""
        ? parseInt(String(carYearRaw).trim(), 10)
        : null;
    if (carYear != null && (!Number.isFinite(carYear) || carYear < 1900 || carYear > 2100)) {
      return fail(400, "Invalid year");
    }

    const dtcCode = b.dtcCode != null ? String(b.dtcCode).trim().toUpperCase() : null;
    if (dtcCode && dtcCode.length > 20) {
      return fail(400, "DTC code too long");
    }

    let imageUrl = null;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;

    const post = await prisma.forumPost.create({
      data: {
        authorId: uid,
        title,
        description,
        category,
        carBrand: b.carBrand != null ? String(b.carBrand).trim() || null : null,
        carModel: b.carModel != null ? String(b.carModel).trim() || null : null,
        carYear,
        engineType: b.engineType != null ? String(b.engineType).trim() || null : null,
        dtcCode: dtcCode || null,
        imageUrl,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    res.json({ ok: true, post: serializePost(post, { userId: uid }) });
  } catch (e) {
    unlinkForumUpload(req.file);
    console.error("forum create", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** POST /api/forum/posts/:id/comments */
router.post("/posts/:id/comments", authRequired, async (req, res) => {
  try {
    const uid = req.user.uid;
    const postId = req.params.id;
    const content = (req.body?.content || "").trim();
    if (!content) return res.status(400).json({ ok: false, error: "Comment cannot be empty" });
    if (content.length > MAX_COMMENT) return res.status(400).json({ ok: false, error: "Comment too long" });

    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ ok: false, error: "Post not found" });

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.forumComment.create({
        data: { postId, authorId: uid, content },
        include: { author: { select: { id: true, name: true, role: true } } },
      });
      await tx.forumPost.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      });
      return c;
    });

    res.json({ ok: true, comment: serializeComment(comment, {}) });
  } catch (e) {
    console.error("forum comment", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** POST /api/forum/posts/:id/like — toggle */
router.post("/posts/:id/like", authRequired, async (req, res) => {
  try {
    const uid = req.user.uid;
    const postId = req.params.id;

    const existing = await prisma.forumPostLike.findUnique({
      where: { userId_postId: { userId: uid, postId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.forumPostLike.delete({ where: { id: existing.id } }),
        prisma.forumPost.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      const post = await prisma.forumPost.findUnique({ where: { id: postId } });
      return res.json({ ok: true, liked: false, likesCount: post.likesCount });
    }

    await prisma.$transaction([
      prisma.forumPostLike.create({ data: { userId: uid, postId } }),
      prisma.forumPost.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    res.json({ ok: true, liked: true, likesCount: post.likesCount });
  } catch (e) {
    console.error("forum like post", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** POST /api/forum/comments/:commentId/like — toggle */
router.post("/comments/:commentId/like", authRequired, async (req, res) => {
  try {
    const uid = req.user.uid;
    const commentId = req.params.commentId;

    const existing = await prisma.forumCommentLike.findUnique({
      where: { userId_commentId: { userId: uid, commentId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.forumCommentLike.delete({ where: { id: existing.id } }),
        prisma.forumComment.update({
          where: { id: commentId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      const c = await prisma.forumComment.findUnique({ where: { id: commentId } });
      return res.json({ ok: true, liked: false, likesCount: c.likesCount });
    }

    await prisma.$transaction([
      prisma.forumCommentLike.create({ data: { userId: uid, commentId } }),
      prisma.forumComment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);
    const c = await prisma.forumComment.findUnique({ where: { id: commentId } });
    res.json({ ok: true, liked: true, likesCount: c.likesCount });
  } catch (e) {
    console.error("forum like comment", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** POST /api/forum/posts/:id/solution — post owner only */
router.post("/posts/:id/solution", authRequired, async (req, res) => {
  try {
    const uid = req.user.uid;
    const postId = req.params.id;
    const commentId = req.body?.commentId;
    if (!commentId || typeof commentId !== "string") {
      return res.status(400).json({ ok: false, error: "commentId required" });
    }

    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ ok: false, error: "Post not found" });
    if (post.authorId !== uid) {
      return res.status(403).json({ ok: false, error: "Only the post author can mark a solution" });
    }

    const comment = await prisma.forumComment.findFirst({
      where: { id: commentId, postId },
    });
    if (!comment) return res.status(404).json({ ok: false, error: "Comment not found on this post" });

    await prisma.$transaction([
      prisma.forumComment.updateMany({
        where: { postId },
        data: { isSolution: false },
      }),
      prisma.forumComment.update({
        where: { id: commentId },
        data: { isSolution: true },
      }),
      prisma.forumPost.update({
        where: { id: postId },
        data: { status: ForumPostStatus.SOLVED },
      }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error("forum solution", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

router.get("/categories", (_req, res) => {
  res.json({ ok: true, categories: CATEGORIES });
});

module.exports = router;
module.exports.FORUM_CATEGORIES = CATEGORIES;
