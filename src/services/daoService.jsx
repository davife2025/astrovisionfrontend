// src/services/daoService.js
// Frontend DAO service — talks to YOUR Express backend only.
// No Supabase credentials in the browser.

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/dao';

const handle = async (res) => {
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Request failed');
  return json;
};

// ── Posts ─────────────────────────────────────────────────────────────────────

export const getPosts = async () => {
  const json = await handle(await fetch(`${API}/posts`));
  return json.posts;
};

export const createPost = async ({ text, image, userId, author }) => {
  // Use FormData so the image file travels as multipart — not base64
  const form = new FormData();
  form.append('text',   text   || '');
  form.append('userId', userId || '');
  form.append('author', author || '');
  if (image) form.append('image', image); // File object

  const json = await handle(await fetch(`${API}/posts`, { method: 'POST', body: form }));
  return json.post;
};

export const togglePostLike = async (postId, userId) => {
  const json = await handle(await fetch(`${API}/posts/${postId}/like`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId }),
  }));
  return json.post;
};

// ── Comments ──────────────────────────────────────────────────────────────────

export const getComments = async (postId) => {
  const json = await handle(await fetch(`${API}/posts/${postId}/comments`));
  return json.comments;
};

export const createComment = async ({ postId, userId, author, text, parentId = null }) => {
  const json = await handle(await fetch(`${API}/posts/${postId}/comments`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId, author, text, parentId }),
  }));
  return json.comment;
};

export const toggleCommentLike = async (commentId, userId) => {
  const json = await handle(await fetch(`${API}/comments/${commentId}/like`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId }),
  }));
  return json.comment;
};

// ── Real-time polling (replaces Supabase channel subscription) ────────────────
// Supabase real-time requires a direct WebSocket from the browser — not possible
// via a backend proxy. This polls every 8 seconds instead, which is fine for a
// community feed. Upgrade to Socket.io on the backend if you need true push.

export const subscribeToPostsChannel = (onNewData) => {
  const interval = setInterval(onNewData, 8000);
  // Return an object with .unsubscribe() to match the old Supabase channel API
  return { unsubscribe: () => clearInterval(interval) };
};