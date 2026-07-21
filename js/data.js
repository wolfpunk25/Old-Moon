import { MANIFEST_PATH } from './config.js';
import { getPublicFile } from './github.js';

// Read-only load for the timeline/detail pages — no token required.
export async function loadPosts() {
  const text = await getPublicFile(MANIFEST_PATH);
  if (!text) return [];
  try {
    const posts = JSON.parse(text);
    return posts.sort((a, b) => new Date(b.captureDate) - new Date(a.captureDate));
  } catch {
    return [];
  }
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
