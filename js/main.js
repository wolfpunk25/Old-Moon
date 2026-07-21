import { loadPosts, formatDate } from './data.js';

const el = document.getElementById('timeline');

function cardHTML(post) {
  return `
    <a class="post-card" href="post.html?id=${encodeURIComponent(post.id)}">
      <img src="${post.image}" alt="" loading="lazy">
      <div class="body">
        <div class="date">${formatDate(post.captureDate)}</div>
        <div class="caption">${escapeHTML(post.caption || '')}</div>
      </div>
    </a>`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function render() {
  const posts = await loadPosts();
  if (posts.length === 0) {
    el.innerHTML = `<div class="empty-state">No walks logged yet.<br>Head to Admin to add your first post.</div>`;
    return;
  }
  el.innerHTML = posts.map(cardHTML).join('');
}

render();
