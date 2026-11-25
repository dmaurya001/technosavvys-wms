# Hostinger Deployment Guide (Frontend + Backend + MySQL)

This project is a unified **Next.js 15 Full-Stack App**:
- **Frontend:** `src/app/` (Teacher Console, Attendance QR, Student Portal, Certificates)
- **Backend API:** `src/app/api/*` (Node.js server routes + `src/middleware.ts`)
- **Database:** Hostinger MySQL (`database/schema.sql`)

> Note: Requires **Hostinger Node.js Web App** (Business/Cloud) or **Hostinger VPS** (Shared PHP-only hosting cannot run Next.js API routes).

---

## 1. Hostinger MySQL Database Setup
1. Open **Hostinger hPanel** -> **Databases** -> **MySQL Databases**.
2. Create a database, username, and strong password.
3. Click **Enter phpMyAdmin** -> **Import** -> choose `database/schema.sql` -> **Import/Go**.

---

## 2. Generate Admin Password Hash & Secrets
Run locally in project root (`e:\Attencence`):
```bash
node scripts/provision-admin.mjs
```
Generate 3 unique 32+ char secrets for:
- `SESSION_SECRET`
- `STUDENT_SESSION_SECRET`
- `QR_TOKEN_SECRET`

---

## 3. Deploy on Hostinger (Node.js Web App)
### Option A: GitHub Auto-Deploy (Recommended)
1. **hPanel** -> **Websites** -> **Add Website** -> **Node.js Web App** (Node 20+).
2. Connect GitHub repo `dmaurya001/technosavvys-wms` (branch: `main`).
3. Build command: `npm run build`
4. Start command: `npm run start`

### Option B: Manual ZIP Upload
Zip all project files **EXCEPT**:
- `node_modules/`
- `.next/`
- `.git/`
- `.env.local`
Upload & extract in Hostinger, then run `npm install && npm run build && npm run start`.

---

## 4. Environment Variables (Set in Hostinger Panel)
Copy keys from `.env.example`:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=u123456789_technosavvys
MYSQL_USER=u123456789_admin
MYSQL_PASSWORD=your_mysql_password

SESSION_SECRET=your_32plus_char_secret_1
STUDENT_SESSION_SECRET=your_32plus_char_secret_2
QR_TOKEN_SECRET=your_32plus_char_secret_3

ADMIN_EMAIL=your_admin_email
ADMIN_USERNAME=your_admin_username
ADMIN_NAME=your_admin_name
ADMIN_PASSWORD_HASH=your_generated_hash
ADMIN_PASSWORD_SALT=your_generated_salt

NEXT_PUBLIC_SITE_URL=https://yourdomain.com
COOKIE_SECURE=true

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_email_password
SMTP_FROM="Technosavvys WMS <noreply@yourdomain.com>"
```

---

## 5. Verify Live Deployment
1. Open `https://yourdomain.com/api/health` -> should return `"ok": true` and `"mysql": "connected"`.
2. Open `https://yourdomain.com/teacher/login` -> sign in with `ADMIN_USERNAME` / password.
3. Test QR check-in + attendance approval + page refresh.
