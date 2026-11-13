# Technosavvys WMS - Hostinger Database & Backend Deployment Guide

This folder contains the complete, production-ready backend and MySQL database for **Hostinger** hosting.

---

## Step 1: Create MySQL Database in Hostinger hPanel

1. Log into your **Hostinger Account** -> Go to **hPanel** (or cPanel).
2. Go to **Databases** -> **MySQL Databases**.
3. Create a new database:
   - **Database Name**: e.g. `u123456789_technosavvys`
   - **Username**: e.g. `u123456789_admin`
   - **Password**: Choose a strong password and save it safely.
4. Click **Create**.

---

## Step 2: Import `schema.sql` via phpMyAdmin

1. In Hostinger hPanel -> Click **Enter phpMyAdmin** next to your newly created database.
2. Click the **Import** tab at the top.
3. Click **Choose File** -> Select `schema.sql` (found in this folder or in `/database/schema.sql`).
4. Click **Go** (or Import) at the bottom.
5. All 8 production tables (`workshops`, `workshop_sessions`, `students`, `attendance_records`, `certificates`, `admins`, `workshop_enrollments`, `audit_logs`) and default seed data are now created!

---

## Step 3: Configure Database Credentials

### Option A: Using the PHP Backend on Hostinger
1. Upload the files in `hostinger-backend/` to your Hostinger File Manager inside `public_html/api/` (or `public_html/`):
   - `config.php`
   - `index.php`
   - `.htaccess`
   - `test-db.php`
2. Open `config.php` in Hostinger File Editor and update:
   ```php
   define('DB_HOST', 'localhost'); // In Hostinger, DB_HOST is usually 'localhost'
   define('DB_PORT', '3306');
   define('DB_NAME', 'u123456789_technosavvys'); // Your Hostinger Database Name
   define('DB_USER', 'u123456789_admin');        // Your Hostinger Database User
   define('DB_PASS', 'YourStrongPasswordHere');  // Your Hostinger Database Password
   ```
3. Test your connection: Open `https://yourdomain.com/api/test-db.php` in your browser.
   You will see: `Database Connected Successfully!` with green checkmarks.

### Option B: Connecting Next.js directly to Hostinger MySQL
In Hostinger hPanel -> **Databases** -> **Remote MySQL**:
1. Add `%` (or your server's IP address) to allow remote access.
2. In your `.env.local` or Vercel Environment Variables, set:
   ```env
   MYSQL_HOST=srv1234.hstgr.io (Hostinger MySQL Host / IP)
   MYSQL_PORT=3306
   MYSQL_DATABASE=u123456789_technosavvys
   MYSQL_USER=u123456789_admin
   MYSQL_PASSWORD=YourStrongPasswordHere
   ```
Next.js will automatically detect these credentials and sync all workshops, attendance, and certificates directly to your Hostinger MySQL database!

---

## Database Schema Overview
- `admins`: Administrator credentials and salted hash.
- `workshops`: Master workshop registry, metadata, trainer, capacity.
- `workshop_sessions`: Workshop sessions, dates, times, and permanent session QR tokens.
- `students`: Enrolled and registered student profiles.
- `attendance_records`: Live and historical QR attendance entries, verification statuses, timestamps.
- `certificates`: Cryptographically verifiable certificates, grades, scores.
- `workshop_enrollments`: Relational mapping of students to workshops.
- `audit_logs`: Security and administrative audit trail.
