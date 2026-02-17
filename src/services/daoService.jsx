// src/services/daoService.jsx
// Frontend DAO service — talks to the Express backend on Render.
// No Supabase credentials in the browser.

// ── Base URL ──────────────────────────────────────────────────────────────────
// REACT_APP_API_URL should be set to your Render root ONLY, e.g.:
//   https://astrovisionbackend.onrender.com
// The /api/dao prefix is appended here so you never mis-type it per-call.
const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const API  = `${BASE}/api/dao`;

// ── Response handler ──────────────────────────────────────────────────────────
// Guards against HTML error pages (404/500) being parsed as JSON,
// which caused: SyntaxError: Unexpected token '<', "<!DOCTYPE "...
const handle = async (res) => {
  const contentType = res.headers.get('content-type') || '';

  // If the server returned HTML (e.g. Render's 404 page), give a clear error.
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Server returned ${res.status} ${res.statusText}. ` +
      `Check REACT_APP_API_URL is set to your Render root URL with no trailing slash.`
    );
  }

  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Request failed');
  return json;
};

// ── Posts ─────────────────────────────────────────────────────────────────────

export const getPosts = async () => {
  const json = await handle(await fetch(`${API}/posts`));
  return json.posts;                          // array of post objects
};

export const createPost = async ({ text, image, userId, author }) => {
  // FormData so the image file travels as multipart — not base64
  const form = new FormData();
  form.append('text',   text   || '');
  form.append('userId', userId || '');
  form.append('author', author || '');
  if (image) form.append('image', image);     // File object from <input type="file">

  const json = await handle(
    await fetch(`${API}/posts`, { method: 'POST', body: form })
  );
  return json.post;                           // newly created post object
};

export const togglePostLike = async (postId, userId) => {
  const json = await handle(
    await fetch(`${API}/posts/${postId}/like`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId }),
    })
  );
  return json.post;                           // updated post object
};

// ── Comments ──────────────────────────────────────────────────────────────────

export const getComments = async (postId) => {
  const json = await handle(await fetch(`${API}/posts/${postId}/comments`));
  return json.comments;                       // nested comment array
};

export const createComment = async ({ postId, userId, author, text, parentId = null }) => {
  const json = await handle(
    await fetch(`${API}/posts/${postId}/comments`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, author, text, parentId }),
    })
  );
  return json.comment;                        // newly created comment object
};

export const toggleCommentLike = async (commentId, userId) => {
  const json = await handle(
    await fetch(`${API}/comments/${commentId}/like`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId }),
    })
  );
  return json.comment;                        // updated comment object
};

// ── Polling (replaces Supabase real-time subscription) ────────────────────────
export const subscribeToPostsChannel = (onNewData) => {
  const interval = setInterval(onNewData, 8000);
  return { unsubscribe: () => clearInterval(interval) };
};