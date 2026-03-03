# Backend (Laravel 12 API)

Canonical setup and run instructions live at:
- `../README.md`

## Quick Commands

```bash
composer install
php artisan key:generate
php artisan migrate
npm install
```

Run backend (choose one):

```bash
rr serve -c .rr.yaml
```

or

```bash
php artisan serve
```

## Notes

- For RoadRunner mode, ensure `http.pool.debug: true` in `.rr.yaml` for local development.
- Frontend must target the correct API URL:
  - `http://localhost:8080` for `rr serve`
  - `http://127.0.0.1:8000` for `php artisan serve`
