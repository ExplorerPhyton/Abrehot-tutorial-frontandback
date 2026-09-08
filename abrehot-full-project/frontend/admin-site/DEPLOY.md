# Deploying the Admin Panel to admin.abrehottutoring.com.et

The admin panel is a **standalone mini-site** in this folder (`frontend/admin-site/`).
It is designed to be the document root of its own subdomain so it never ships
with the public site (nothing admin-related is reachable from
www.abrehottutoring.com.et anymore).

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The whole admin app (gate + tabs for tutors, bookings, contact, book ads) |
| `css/abrehot-theme.css`, `js/theme.js` | Copies of the shared theme assets, so this folder is fully self-contained |
| `robots.txt` | Tells search engines to stay away |
| `index.html` meta | `noindex, nofollow` — belt and suspenders with robots.txt |

The API endpoint is chosen automatically: `localhost` builds call
`http://localhost:5000/api`, anything else calls the Railway API
(`abrehot-tutorial-frontandback-production.up.railway.app/api`).

## Plesk setup (one time)

1. **Plesk → Websites & Domains → Add Subdomain**
   - Subdomain name: `admin` (gives you `admin.abrehottutoring.com.et`)
   - Document root: the default Plesk suggests (e.g. `/admin.abrehottutoring.com.et`)
2. **Upload the deploy zip**
   - Use `admin-deploy.zip` from the project root (contains this folder's
     files at the zip root) — upload it via **File Manager** into the
     subdomain's document root and extract there. You should end up with
     `index.html` directly under the document root.
3. **Enable HTTPS** — Hosting Settings → SSL/TLS certificate → issue a free
   **Let's Encrypt** cert for `admin.abrehottutoring.com.et`.
   This is required: the panel calls the API over https, and the backend only
   accepts https origins from the site's domain.
4. Open `https://admin.abrehottutoring.com.et/` and log in with the
   `ADMIN_SECRET` from the backend's environment variables.

## Backend (already handled in this repo)

`backend/server.js` CORS automatically allows any **https** origin on
`abrehottutoring.com.et` and its first-party subdomains — so the new admin
subdomain works on Railway with **no environment-variable change**. If you
ever move the panel to a different domain, add that origin to `CLIENT_ORIGIN`
in the Railway variables instead.

The API itself is protected by the `x-admin-secret` header check
(`backend/middleware/adminAuth.js`), which is unchanged.

## Re-deploying after changes

Edit files in this folder, then rebuild the zip from the project root:

```
cd frontend/admin-site
python -c "import shutil; shutil.make_archive('../../admin-deploy', 'zip', '.')"
```

…or just re-zip the *contents* (not the enclosing folder) by hand.

## Old links

The old `admin.html` on the main site is now a redirect page: production
visitors are sent to `https://admin.abrehottutoring.com.et/`, while local dev
(`localhost` / `file://`) falls back to `admin-site/index.html` so nothing
breaks while coding.
