import { REPO_OWNER, REPO_NAME, REPO_BRANCH, TOKEN_STORAGE_KEY } from './config.js';

const API_ROOT = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function setToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

function authHeaders() {
  const token = getToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };
}

// Confirms the token can read/write this specific repo.
export async function verifyToken() {
  const res = await fetch(API_ROOT, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GitHub rejected the token (${res.status})`);
  const repo = await res.json();
  if (!repo.permissions || !repo.permissions.push) {
    throw new Error('Token can read this repo but not write to it.');
  }
  return true;
}

// Fetches a file's content (decoded) and sha, or null if it doesn't exist.
export async function getFile(path) {
  const res = await fetch(`${API_ROOT}/contents/${path}?ref=${REPO_BRANCH}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch ${path} (${res.status})`);
  const json = await res.json();
  const content = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
  return { content, sha: json.sha };
}

// Looks up just the sha of a file (works for binary files too, since we
// never decode the content). Returns null if the file doesn't exist yet.
export async function getSha(path) {
  const res = await fetch(`${API_ROOT}/contents/${path}?ref=${REPO_BRANCH}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to look up ${path} (${res.status})`);
  const json = await res.json();
  return json.sha;
}

// Fetches the manifest relative to the page it's called from, via the Pages
// CDN — no auth needed, and it keeps working regardless of repo visibility
// (unlike raw.githubusercontent.com, which 403s once a repo goes private).
export async function getPublicFile(path) {
  const res = await fetch(`${path}?t=${Date.now()}`);
  if (!res.ok) return null;
  return res.text();
}

export async function putFile(path, content, sha, message) {
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: REPO_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API_ROOT}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to write ${path} (${res.status})`);
  }
  return res.json();
}

// content must be a base64 string (no data: prefix) for binary uploads.
export async function putBinaryFile(path, base64Content, sha, message) {
  const body = {
    message,
    content: base64Content,
    branch: REPO_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API_ROOT}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to write ${path} (${res.status})`);
  }
  return res.json();
}

export async function deleteFile(path, sha, message) {
  const res = await fetch(`${API_ROOT}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: REPO_BRANCH }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to delete ${path} (${res.status})`);
  }
  return res.json();
}
