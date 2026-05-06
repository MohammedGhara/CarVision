// apps/mobile/lib/forumApi.js — Community forum REST (matches /api/forum)
import { api } from "./api";

export async function fetchForumPosts({ q = "", category = "all", sort = "newest", limit = 50 } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (category && category !== "all") qs.set("category", category);
  if (sort) qs.set("sort", sort);
  qs.set("limit", String(limit));
  const data = await api.get(`/api/forum/posts?${qs.toString()}`);
  return Array.isArray(data?.posts) ? data.posts : [];
}

export async function fetchForumPost(id) {
  const data = await api.get(`/api/forum/posts/${encodeURIComponent(id)}`);
  return { post: data.post, comments: data.comments || [] };
}

export async function createForumPost(body, options = {}) {
  const { imageUri } = options;
  if (imageUri) {
    const form = new FormData();
    form.append("title", body.title);
    form.append("description", body.description);
    form.append("category", body.category);
    if (body.carBrand) form.append("carBrand", body.carBrand);
    if (body.carModel) form.append("carModel", body.carModel);
    if (body.carYear != null && body.carYear !== "") form.append("carYear", String(body.carYear));
    if (body.engineType) form.append("engineType", body.engineType);
    if (body.dtcCode) form.append("dtcCode", body.dtcCode);
    const name = imageUri.split("/").pop() || "forum.jpg";
    const ext = (name.split(".").pop() || "").toLowerCase();
    const mime =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
    form.append("image", { uri: imageUri, name, type: mime });
    const data = await api.postFile("/api/forum/posts", form);
    return data.post;
  }
  const data = await api.post("/api/forum/posts", body);
  return data.post;
}

export async function addForumComment(postId, content) {
  const data = await api.post(`/api/forum/posts/${encodeURIComponent(postId)}/comments`, { content });
  return data.comment;
}

export async function toggleForumPostLike(postId) {
  return api.post(`/api/forum/posts/${encodeURIComponent(postId)}/like`, {});
}

export async function toggleForumCommentLike(commentId) {
  return api.post(`/api/forum/comments/${encodeURIComponent(commentId)}/like`, {});
}

export async function markForumSolution(postId, commentId) {
  return api.post(`/api/forum/posts/${encodeURIComponent(postId)}/solution`, { commentId });
}
