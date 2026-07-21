# Old Moon

A simple photo blog for logging walks, hosted entirely as static files on
GitHub Pages — no server, no database.

## How it works

- `posts/index.json` is the whole database: one JSON array of post objects
  (image path, caption, tags, capture date, optional GPS location).
- `images/` holds the compressed photos.
- The timeline (`index.html`) and post detail page (`post.html`) just fetch
  `posts/index.json` from GitHub and render it — no login needed to read.
- The admin page (`admin.html`) is where "logging in" happens: you paste in a
  GitHub personal access token scoped to this repo only, and the page uses
  GitHub's Contents API directly from the browser to commit new/edited/deleted
  posts and photos. Every change you make is a git commit.
- Photo metadata (capture date + GPS) is read client-side with
  [exifr](https://github.com/MikeKovarik/exifr) when you pick a photo, and
  you can override either field before saving. Photos are re-encoded to JPEG
  and shrunk to a max of 2000px on the longest side in the browser before
  upload, to keep the repo small and pages fast.
- Maps use [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles — free,
  no API key.

## One-time setup

### 1. Create a GitHub personal access token

Go to
[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
and create a **fine-grained** token:

- **Repository access**: "Only select repositories" → `Old-Moon`
- **Permissions** → **Repository permissions** → **Contents**: `Read and write`
- Set an expiration you're comfortable with (you can always generate a new one)

Copy the token (starts with `github_pat_`). You'll paste it into the admin
page's login screen — it's stored only in that browser's local storage, never
sent anywhere except directly to `api.github.com`.

Treat it like a password: anyone with it can write to this repo. Because it's
scoped to just this one repo, that's the entire blast radius if it ever leaks.

### 2. Push this folder to GitHub

```bash
git init
git add .
git commit -m "Initial Old Moon site"
git branch -M main
git remote add origin https://github.com/wolfpunk25/Old-Moon.git
git push -u origin main
```

### 3. Enable GitHub Pages

In the repo on GitHub: **Settings → Pages → Build and deployment → Source**,
choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
Your site will be live at `https://wolfpunk25.github.io/Old-Moon/` within a
minute or two.

### 4. Log in from your phone

Visit `https://wolfpunk25.github.io/Old-Moon/admin.html`, paste your token,
and you're in. Add it to your home screen for quick access while out walking.

## Notes / limitations

- Photos taken in HEIC format need to be decoded by the browser to compress
  them for upload — this works in Safari on iOS, but not reliably in Chrome.
  If you're uploading from an iPhone, use Safari for the admin page, or set
  your camera to "Most Compatible" (JPEG) in Settings → Camera → Formats.
- This is a single-user tool by design: there's no multi-account support, and
  the token is trusted completely. Don't share the admin URL/token.
- Each add/edit/delete is a real git commit to `main`, so your full post
  history is just your git history.
