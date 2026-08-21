# Deployment Guide

## Overview
- **Frontend** → Vercel (free)
- **Backend** → Render (free)
- **Database** → Supabase (free PostgreSQL)

---

## Step 1: Set Up the Database (Supabase)

1. Go to https://supabase.com and click **Start for free**
2. Sign up with GitHub or email
3. Click **New Project**, fill in:
   - Name: `reservation-db`
   - Password: create a strong password (save it!)
   - Region: choose closest to Egypt (e.g., EU West)
4. Wait ~2 minutes for setup
5. Go to **SQL Editor** (left sidebar)
6. Paste the entire contents of `backend/src/db/schema.sql` and click **Run**
7. Go to **Settings → Database**
8. Copy the **Connection string** (URI format) — looks like:
   `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`
   Replace `[PASSWORD]` with your project password

---

## Step 2: Deploy the Backend (Render)

1. Go to https://render.com and sign up (use GitHub)
2. Click **New → Web Service**
3. Connect your GitHub repo (you'll need to push this code to GitHub first — see below)
4. Settings:
   - **Name**: reservation-backend
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Add Environment Variables (click **Add Environment Variable** for each):
   - `DATABASE_URL` → paste your Supabase connection string
   - `JWT_SECRET` → any long random string (e.g., `mysupersecretjwtkey2026reservations`)
   - `FRONTEND_URL` → leave blank for now (update after Vercel deploy)
   - `NODE_ENV` → `production`
6. Click **Create Web Service**
7. Wait for deploy (~3-5 min). Copy the URL it gives you (e.g., `https://reservation-backend.onrender.com`)

### Run the Seed (create all users & admins)

After deploy, go to Render dashboard → your service → **Shell** tab and run:
```
npm run seed
```
This creates all 20 users, 8 admins, and 6 locations.

---

## Step 3: Deploy the Frontend (Vercel)

1. Go to https://vercel.com and sign up (use GitHub)
2. Click **Add New → Project**
3. Import your GitHub repo
4. Settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variable:
   - `VITE_API_URL` → `https://your-render-url.onrender.com/api`
     (replace with your actual Render URL from Step 2)
6. Click **Deploy**
7. Copy the Vercel URL (e.g., `https://reservation-app.vercel.app`)

### Update Backend CORS

Go back to Render → your service → **Environment** → update:
- `FRONTEND_URL` → your Vercel URL (e.g., `https://reservation-app.vercel.app`)

Then click **Manual Deploy → Deploy latest commit**

---

## Step 4: Push Code to GitHub

You need a GitHub account. Then:

1. Go to https://github.com/new and create a repo called `reservation-app`
2. Install Git from https://git-scm.com/download/win
3. Open PowerShell in the `reservation-app` folder and run:

```powershell
git init
git add .
git commit -m "Initial reservation app"
git remote add origin https://github.com/YOUR_USERNAME/reservation-app.git
git push -u origin main
```

---

## Accounts Summary

### Staff Users (20 accounts) — Can make bookings
| Username | Password |
|----------|----------|
| user01 – user20 | User@1234 |

### Location Admins (6 accounts) — View their location only
| Username | Password | Location |
|----------|----------|----------|
| admin_portsaid | Admin@1234 | Port Said |
| admin_ismailia | Admin@1234 | Ismailia |
| admin_suez | Admin@1234 | Suez |
| admin_sinai | Admin@1234 | South Sinai |
| admin_luxor | Admin@1234 | Luxor |
| admin_aswan | Admin@1234 | Aswan |

### Super Admins (2 accounts) — View all locations
| Username | Password |
|----------|----------|
| superadmin1 | Super@1234 |
| superadmin2 | Super@1234 |

---

## Slot Schedule

Each location gets 20 time blocks per day:
- **Regular slots** (Blocks 1-15): 8:30 AM – 11:45 AM, capacity 4 per block = **60 total**
- **Urgent slots** (Blocks 16-20): 12:00 PM – 1:00 PM, capacity 2 per block = **10 total**

Slots auto-generate when the first user views that date.
