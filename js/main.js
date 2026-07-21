import { loadPosts, formatDate } from './data.js';

const el = document.getElementById('timeline');
const filterBar = document.getElementById('filter-bar');

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
  const tag = new URLSearchParams(location.search).get('tag');
  let posts = await loadPosts();

  if (tag) {
    posts = posts.filter((p) => (p.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase()));
    filterBar.innerHTML = `<div class="filter-bar">Tagged <strong>${escapeHTML(tag)}</strong> &middot; <a href="index.html">Clear</a></div>`;
  } else {
    filterBar.innerHTML = '';
  }

  if (posts.length === 0) {
    el.innerHTML = tag
      ? `<div class="empty-state">No posts tagged "${escapeHTML(tag)}".</div>`
      : `<div class="empty-state">No walks logged yet.<br>Head to Admin to add your first post.</div>`;
    return;
  }
  el.innerHTML = posts.map(cardHTML).join('');
}

render();
