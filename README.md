# COMIS — Cocoa, Coffee & Cola Management Information System

A mobile-first web app for recording produce purchases (cocoa, coffee, cola nut)
with moisture-deduction pricing, plus seller and loan management.

## Stack
- **Backend:** FastAPI + SQLAlchemy + Alembic
- **Frontend:** React + Vite + Tailwind CSS (PWA, offline-capable)
- **Database:** PostgreSQL

## Local Development

```bash
# 1. Start Postgres + backend + frontend together
docker compose up --build

# Backend only (without Docker):
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload

# Frontend only (without Docker):
cd frontend
npm install
npm run dev
```

- Backend docs: http://localhost:8000/docs
- Frontend: http://localhost:5173

## Project Structure
See `docs/folder-structure.md` for the full annotated tree.

## Pricing Logic (Cocoa & Coffee)
```
moisture_deduction = water_percent - standard_percent (default 7%)
net_weight_kg      = weight_kg - moisture_deduction
total_price         = net_weight_kg * price_per_kg
```
Cola nut uses direct `weight_kg * price_per_kg` pricing (no deduction).

## Deployment
See `docs/deployment.md`.
