import { loadPosts, formatDate, formatTime } from './data.js';

const el = document.getElementById('post');

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function render() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const posts = await loadPosts();
  const post = posts.find((p) => p.id === id);

  if (!post) {
    el.innerHTML = `<div class="empty-state">Post not found.</div>`;
    return;
  }

  const tagsHTML = (post.tags || [])
    .map((t) => `<a class="tag" href="index.html?tag=${encodeURIComponent(t)}">${escapeHTML(t)}</a>`)
    .join('');

  el.innerHTML = `
    <img class="hero" src="${post.image}" alt="">
    <div class="post-meta">${formatDate(post.captureDate)} &middot; ${formatTime(post.captureDate)}</div>
    <div class="post-caption">${escapeHTML(post.caption || '')}</div>
    ${tagsHTML ? `<div class="tags">${tagsHTML}</div>` : ''}
    ${post.location ? `<div class="map" id="map"></div>` : ''}
  `;

  if (post.location) {
    const map = L.map('map', { zoomControl: false, attributionControl: true }).setView(
      [post.location.lat, post.location.lng],
      14
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    L.marker([post.location.lat, post.location.lng]).addTo(map);
  }
}

render();
