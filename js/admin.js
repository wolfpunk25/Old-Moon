import { MANIFEST_PATH, IMAGES_PATH } from './config.js';
import {
  isLoggedIn,
  setToken,
  clearToken,
  verifyToken,
  getFile,
  putFile,
  getSha,
  putBinaryFile,
  deleteFile,
} from './github.js';

const loginView = document.getElementById('login-view');
const adminView = document.getElementById('admin-view');
const loginStatus = document.getElementById('login-status');
const formStatus = document.getElementById('form-status');
const exifHint = document.getElementById('exif-hint');

const form = document.getElementById('post-form');
const imageInput = document.getElementById('image-input');
const captionInput = document.getElementById('caption-input');
const tagsInput = document.getElementById('tags-input');
const dateInput = document.getElementById('date-input');
const latInput = document.getElementById('lat-input');
const lngInput = document.getElementById('lng-input');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const formTitle = document.getElementById('form-title');
const adminList = document.getElementById('admin-list');

let editingId = null;
let pendingImageBlob = null; // compressed JPEG blob for the currently selected file, if any

init();

function init() {
  if (isLoggedIn()) {
    showAdmin();
  } else {
    loginView.hidden = false;
  }
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const token = document.getElementById('token-input').value.trim();
  if (!token) return;
  setStatus(loginStatus, 'Checking token…', '');
  setToken(token);
  try {
    await verifyToken();
    setStatus(loginStatus, '', '');
    showAdmin();
  } catch (err) {
    clearToken();
    setStatus(loginStatus, err.message, 'error');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  clearToken();
  location.reload();
});

cancelEditBtn.addEventListener('click', () => resetForm());

async function showAdmin() {
  loginView.hidden = true;
  adminView.hidden = false;
  await refreshList();
}

// ---- date helpers: keep capture time as a plain "wall clock" string, no timezone shifting ----

function toLocalInputString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inputStringToISO(str) {
  const m = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:00`;
}

// ---- image selection: EXIF extraction + compression preview ----

imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;
  exifHint.textContent = 'Reading photo…';
  submitBtn.disabled = true;

  try {
    pendingImageBlob = await compressImage(file, 2000, 0.85);
  } catch (err) {
    exifHint.textContent = `Could not read that photo: ${err.message}`;
    submitBtn.disabled = false;
    return;
  }

  try {
    const tags = await exifr.parse(file, { gps: true });
    const found = [];
    if (tags) {
      const captured = tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate;
      if (captured instanceof Date && !isNaN(captured)) {
        dateInput.value = toLocalInputString(captured);
        found.push('date');
      }
      if (typeof tags.latitude === 'number' && typeof tags.longitude === 'number') {
        latInput.value = tags.latitude.toFixed(6);
        lngInput.value = tags.longitude.toFixed(6);
        found.push('location');
      }
    }
    if (!dateInput.value) dateInput.value = toLocalInputString(new Date());
    exifHint.textContent = found.length
      ? `Found ${found.join(' and ')} in the photo. You can edit them below.`
      : 'No date or location found in this photo — enter them manually if you like.';
  } catch {
    if (!dateInput.value) dateInput.value = toLocalInputString(new Date());
    exifHint.textContent = 'Could not read metadata from this photo.';
  } finally {
    submitBtn.disabled = false;
  }
});

function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unsupported image format'));
    };
    img.src = url;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function makeId(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${rand}`;
}

// ---- manifest helpers ----

async function loadManifest() {
  const file = await getFile(MANIFEST_PATH);
  if (!file) return { posts: [], sha: null };
  try {
    return { posts: JSON.parse(file.content), sha: file.sha };
  } catch {
    return { posts: [], sha: file.sha };
  }
}

async function saveManifest(posts, sha, message) {
  const result = await putFile(MANIFEST_PATH, JSON.stringify(posts, null, 2), sha, message);
  return result.content.sha;
}

// ---- form submit: create or update a post ----

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  setStatus(formStatus, 'Saving…', '');

  try {
    const captureISO = inputStringToISO(dateInput.value) || new Date().toISOString().slice(0, 19);
    const lat = latInput.value.trim();
    const lng = lngInput.value.trim();
    const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    const tags = tagsInput.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const caption = captionInput.value.trim();

    const { posts, sha: manifestSha } = await loadManifest();

    if (editingId) {
      const post = posts.find((p) => p.id === editingId);
      if (!post) throw new Error('Post no longer exists');

      if (pendingImageBlob) {
        const base64 = await blobToBase64(pendingImageBlob);
        const imageSha = await getSha(post.image);
        await putBinaryFile(post.image, base64, imageSha, `Update photo for ${editingId}`);
      }

      post.caption = caption;
      post.tags = tags;
      post.captureDate = captureISO;
      post.location = location;

      await saveManifest(posts, manifestSha, `Update post ${editingId}`);
    } else {
      if (!pendingImageBlob) throw new Error('Choose a photo first');

      const captureDate = new Date(captureISO);
      const id = makeId(isNaN(captureDate) ? new Date() : captureDate);
      const imagePath = `${IMAGES_PATH}/${id}.jpg`;
      const base64 = await blobToBase64(pendingImageBlob);
      await putBinaryFile(imagePath, base64, null, `Add photo for ${id}`);

      posts.push({ id, image: imagePath, caption, tags, captureDate: captureISO, location });
      await saveManifest(posts, manifestSha, `Add post ${id}`);
    }

    setStatus(formStatus, 'Saved.', 'ok');
    resetForm();
    await refreshList();
  } catch (err) {
    setStatus(formStatus, err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

function resetForm() {
  editingId = null;
  pendingImageBlob = null;
  form.reset();
  exifHint.textContent = '';
  formTitle.textContent = 'New post';
  submitBtn.textContent = 'Save post';
  cancelEditBtn.hidden = true;
  setStatus(formStatus, '', '');
}

// ---- post list: edit / delete ----

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function refreshList() {
  adminList.innerHTML = '<div class="hint">Loading…</div>';
  let posts;
  try {
    ({ posts } = await loadManifest());
  } catch (err) {
    adminList.innerHTML = `<div class="hint">Could not load posts: ${escapeHTML(err.message)}. Try logging out and back in with a fresh token.</div>`;
    return;
  }
  posts.sort((a, b) => new Date(b.captureDate) - new Date(a.captureDate));

  if (posts.length === 0) {
    adminList.innerHTML = '<div class="hint">No posts yet.</div>';
    return;
  }

  adminList.innerHTML = posts
    .map(
      (p) => `
      <div class="admin-post-row" data-id="${escapeHTML(p.id)}">
        <img src="${p.image}" alt="">
        <div class="info">
          <div class="caption">${escapeHTML(p.caption || '(no caption)')}</div>
          <div class="date">${escapeHTML(p.captureDate || '')}</div>
        </div>
        <div class="row-actions">
          <button class="edit-btn">Edit</button>
          <button class="danger delete-btn">Delete</button>
        </div>
      </div>`
    )
    .join('');

  adminList.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.admin-post-row').dataset.id;
      startEdit(posts.find((p) => p.id === id));
    });
  });

  adminList.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.admin-post-row').dataset.id;
      handleDelete(posts.find((p) => p.id === id));
    });
  });
}

function startEdit(post) {
  if (!post) return;
  editingId = post.id;
  pendingImageBlob = null;
  imageInput.value = '';
  captionInput.value = post.caption || '';
  tagsInput.value = (post.tags || []).join(', ');
  dateInput.value = post.captureDate ? toLocalInputString(new Date(post.captureDate)) : '';
  latInput.value = post.location ? post.location.lat : '';
  lngInput.value = post.location ? post.location.lng : '';
  exifHint.textContent = 'Editing existing post. Choose a new photo only if you want to replace it.';
  formTitle.textContent = 'Edit post';
  submitBtn.textContent = 'Save changes';
  cancelEditBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleDelete(post) {
  if (!post) return;
  if (!confirm('Delete this post? This cannot be undone.')) return;

  setStatus(formStatus, 'Deleting…', '');
  try {
    const { posts, sha: manifestSha } = await loadManifest();
    const next = posts.filter((p) => p.id !== post.id);
    await saveManifest(next, manifestSha, `Delete post ${post.id}`);

    const imageSha = await getSha(post.image);
    if (imageSha) await deleteFile(post.image, imageSha, `Delete photo for ${post.id}`);

    if (editingId === post.id) resetForm();
    setStatus(formStatus, 'Deleted.', 'ok');
    await refreshList();
  } catch (err) {
    setStatus(formStatus, err.message, 'error');
  }
}

function setStatus(elm, text, cls) {
  elm.textContent = text;
  elm.className = `status ${cls}`;
}
