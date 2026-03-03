# Next.js Starter Kit Full

Monorepo containing:
- `backend`: Laravel 12 API (roles, menus, rules, user access)
- `frontend-js`: Next.js 16 (JavaScript)

## Project Structure

```text
nextjs-starter-kit-full/
|- backend/
|- frontend-js/
```

## Prerequisites

- PHP `8.2+`
- Composer `2+`
- Node.js `20+`
- npm `10+`
- SQL Server (or matching DB setup in `backend/.env`)
- Optional: RoadRunner CLI (`rr`) for backend run mode on port `8080`

## Quick Start

1. Setup backend
2. Setup frontend (`frontend-js`)
3. Start backend using either:
- `rr serve` (RoadRunner, port `8080`)
- `php artisan serve` (Laravel dev server, port `8000`)
4. Set frontend `NEXT_PUBLIC_BACKEND_API` to match backend mode
5. Run frontend with `npm run dev`

## 1) Backend Setup

```bash
cd backend
```

Create env file:

- PowerShell
```powershell
Copy-Item .env.example .env
```

- Bash
```bash
cp .env.example .env
```

Update `backend/.env` before migrating:
- `DB_*` main DB connection
- `DB_*_MATEMPLOYEES_READER` and `DB_*_MATGALLERY_READER` if required in your environment
- `MAT_AUTH_*` endpoints/timeouts/TLS settings

Install and initialize:

```bash
composer install
php artisan key:generate
php artisan migrate
npm install
```

Optional seeders:

```bash
php artisan db:seed --class=SystemMenuSeeder
php artisan db:seed --class=SystemRoleDefaultSeeder
```

## 2) Frontend Setup

JavaScript frontend (`frontend-js`) uses:
- `NEXT_PUBLIC_BACKEND_API`
- `NEXT_PUBLIC_MAT_GALLERY`

```bash
cd frontend-js
npm install
```

Create env:

- PowerShell
```powershell
Copy-Item .env.example .env
```

- Bash
```bash
cp .env.example .env
```

## 3) Run Backend (Pick One Mode)

### Mode A: RoadRunner (`rr serve`) on `http://localhost:8080`

```bash
cd backend
rr serve -c .rr.yaml
```

Notes:
- Ensure `backend/.rr.yaml` has development debug enabled:
  - `http.pool.debug: true`
- This repo already has `debug: true` by default in `.rr.yaml`

Use this frontend env value:

```env
NEXT_PUBLIC_BACKEND_API=http://localhost:8080
```

### Mode B: Laravel server (`php artisan serve`) on `http://127.0.0.1:8000`

```bash
cd backend
php artisan serve
```

Use this frontend env value:

```env
NEXT_PUBLIC_BACKEND_API=http://127.0.0.1:8000
```

## 4) Run Frontend

In a separate terminal:

```bash
cd frontend-js
npm run dev
```

Default URL:
- `http://localhost:3000`

## Authentication Notes

- Frontends store token in local storage key `access_token`
- Callback route: `/auth/verify?token=...`
- On API `401`, frontend redirects to:
  - `NEXT_PUBLIC_MAT_GALLERY`
  - fallback: `NEXT_PUBLIC_MAT_GALLERY_URL`

## Common Commands

### Backend (`backend`)

- `composer setup`
- `composer test`
- `composer format`
- `php artisan migrate`
- `php artisan db:seed`
- `rr serve -c .rr.yaml`
- `php artisan serve`

### Frontend JS (`frontend-js`)

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run format`
- `npm run format:check`

## Troubleshooting

- Frontend cannot connect to backend:
  - Verify `NEXT_PUBLIC_BACKEND_API` matches backend mode and port (`8080` for `rr`, `8000` for artisan)
  - Confirm backend process is running

- Redirect loops to SSO/login:
  - Token is missing/expired or backend returns `401`
  - Verify `NEXT_PUBLIC_MAT_GALLERY` value

- Backend DB errors:
  - Recheck `backend/.env` SQL Server credentials and host reachability
