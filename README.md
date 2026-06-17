# MIPL PPC Module

Production Planning & Control system for flexible packaging manufacturers.

## Default Login

| Field    | Value            |
|----------|------------------|
| Email    | admin@mipl.com   |
| Password | Admin@1234       |

## Tech Stack

- **Backend**: Node.js + Express + PostgreSQL (pg pool)
- **Frontend**: React 18 + Vite + TailwindCSS + Recharts
- **Auth**: JWT access tokens (15m) + refresh tokens (7d)
- **Excel**: ExcelJS for import and export

## Architecture

```
PPCModuleMIPL/
├── backend/
│   ├── migrations/001_schema.sql   # Full PostgreSQL schema + seed data
│   ├── src/
│   │   ├── app.js                  # Express entry point
│   │   ├── config/database.js      # pg Pool
│   │   ├── middleware/auth.js      # JWT authenticate + authorize
│   │   └── routes/                 # All API route handlers
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # React Router setup
│   │   ├── contexts/AuthContext    # Auth state + hooks
│   │   ├── services/               # Axios API calls
│   │   ├── components/             # Layout, Sidebar, UI primitives
│   │   └── pages/                  # All application pages
│   ├── package.json
│   └── vite.config.js
└── docker-compose.yml
```

## Roles

| Role               | Access                                   |
|--------------------|------------------------------------------|
| admin              | Full access to all features              |
| ppc_planner        | Orders, spec sheets, machine plans, PTD  |
| store_inventory    | Stock management                         |
| machine_operator   | Machine plans, PTD entry                 |
| sales              | Order booking, customers                 |
| management         | Read-only dashboards and reports         |

## Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

### 1. Database Setup

```sql
CREATE DATABASE mipl_ppc;
\c mipl_ppc
\i backend/migrations/001_schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL connection string
npm install
npm run dev
# Runs on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
# API calls proxy to :5000 via vite.config.js
```

## Docker Deployment

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432 (with auto schema migration)
- Backend API on port 5000
- Frontend (Nginx) on port 80

Access at: http://localhost

## Key Features

### Stock Management
- Paginated stock register with days cover calculation
- Excel bulk import (auto-detects header row with ITEMCODE column)
- Manual stock level editing

### Order Lifecycle
1. **Booking** - Create sales orders with priority and delivery dates
2. **Spec Sheets** - Maintain versioned product specifications (films, cylinders, process stages)
3. **Production Orders** - Auto-created from SO + spec sheet; calculates target KM using: `target_km = (qty_kg × 1,000,000) / total_gsm / primary_film_width_mm`
4. **RM Allocation** - Auto-computed BOM quantities with AVAILABLE/APO/SHORT status
5. **Machine Plans** - Schedule jobs with auto shift assignment and run-hours calculation
6. **PTD Entry** - Bulk daily production data entry with progress tracking
7. **Pending Order Tracker** - Real-time stage-wise progress view

### Dashboard KPIs
- Open orders, overdue orders, efficiency %, on-time delivery %
- Daily output trend, machine utilization, RM shortage alerts
- Stage WIP, top customers, new vs repeat breakdown

### Excel Exports
- Configurable column layouts per user per sheet
- Navy header row, alternating row colors, auto-column widths
- Sheets: Stock, Sales Orders, Production Orders, PTD Entries, Pending Orders

## API Endpoints

| Method | Path                                    | Description                    |
|--------|-----------------------------------------|--------------------------------|
| POST   | /api/auth/login                         | Login                          |
| GET    | /api/dashboard                          | Dashboard KPIs                 |
| GET    | /api/stock                              | Paginated stock list           |
| POST   | /api/stock/import                       | Excel stock import             |
| GET    | /api/sales-orders                       | Paginated sales orders         |
| POST   | /api/sales-orders                       | Create sales order             |
| POST   | /api/production-orders/from-so/:soId    | Create production order        |
| GET    | /api/production-orders/pending          | Pending order tracker          |
| POST   | /api/machine-plans/generate             | Generate machine plan          |
| POST   | /api/ptd/entries                        | Submit PTD entries             |
| POST   | /api/exports/excel                      | Download Excel report          |

## Environment Variables

| Variable                | Description                        |
|-------------------------|------------------------------------|
| PORT                    | Backend port (default 5000)        |
| DATABASE_URL            | PostgreSQL connection string       |
| JWT_SECRET              | Access token secret (min 32 chars) |
| JWT_REFRESH_SECRET      | Refresh token secret               |
| JWT_EXPIRES_IN          | Access token expiry (e.g. 15m)     |
| JWT_REFRESH_EXPIRES_IN  | Refresh token expiry (e.g. 7d)     |
| NODE_ENV                | development / production           |
