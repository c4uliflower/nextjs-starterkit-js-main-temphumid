# Frontend JS (Next.js 16 + JavaScript)

Canonical setup and run instructions live at:
- `../README.md`

## Quick Commands

```bash
npm install
npm run dev
```

## Environment

Create `.env` from `.env.example`, then set:

```env
NEXT_PUBLIC_BACKEND_API=http://localhost:8080
NEXT_PUBLIC_MAT_GALLERY=https://your-sso-host/
```

If backend is running with `php artisan serve`, use:

```env
NEXT_PUBLIC_BACKEND_API=http://127.0.0.1:8000
```
