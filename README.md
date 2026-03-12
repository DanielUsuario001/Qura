# Qura Health — Quantum Clinical Scheduler

A web application that optimizes appointment and surgery scheduling for public hospitals in Peru using **Simulated Quantum Annealing** (QUBO formulation via `pyqubo` + `openjij`).

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Next.js (Vercel)                                    │
│  ├── /auth/login  /auth/signup                       │
│  ├── /dashboard/patient                              │
│  ├── /dashboard/admin   ──── POST /api/optimize ──┐  │
│  └── /dashboard/doctor                             │  │
└────────────────────────────────────────────────────┼──┘
                          Supabase (PostgreSQL + RLS) │
                                                      ▼
                          ┌──────────────────────────────┐
                          │  FastAPI (Render / Railway)  │
                          │  POST /solve                 │
                          │  pyqubo + openjij SQA        │
                          └──────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend & API Routes | Next.js 16 · App Router · TypeScript · TailwindCSS |
| Database & Auth | Supabase (PostgreSQL 15, RLS, Auth) |
| Optimization Engine | Python · FastAPI · pyqubo · openjij |
| Deploy (frontend) | Vercel |
| Deploy (optimizer) | Render or Railway |

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- A [Supabase](https://supabase.com) project

### 1. Clone & install dependencies

```bash
# Install Next.js dependencies
npm install

# Install Python dependencies
cd optimizer
pip install -r requirements.txt
cd ..
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase URL, anon key, and optimizer service URL.

### 3. Set up the database

In your Supabase project, go to **SQL Editor** and run the full contents of:

```
supabase/schema.sql
```

This creates all tables, enums, indexes, RLS policies, and triggers.

### 4. Configure Supabase Auth

In Supabase Dashboard → **Authentication** → **URL Configuration**:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

### 5. Run locally

**Terminal 1 — Next.js:**
```bash
npm run dev
```

**Terminal 2 — Python optimizer:**
```bash
cd optimizer
uvicorn app.main:app --reload --port 8000
```

Open [http://localhost:3000](http://localhost:3000).

## User Roles

| Role | Access | Capabilities |
|---|---|---|
| `patient` | `/dashboard/patient` | Submit appointment requests, view assigned schedule |
| `doctor` | `/dashboard/doctor` | View chronological schedule, mark appointments complete |
| `admin` | `/dashboard/admin` | Monitor pool, insert walk-ins, trigger quantum optimization |

## The Optimization Algorithm

The Python microservice formulates a **QUBO** (Quadratic Unconstrained Binary Optimization) problem:

$$H = -\sum_{i,j,t} U_i x_{i,j,t} + \lambda_1 \sum_{j,t}\left(\sum_i x_{i,j,t}-1\right)^2 + \lambda_2 \sum_i \left(\sum_{j,t} x_{i,j,t}-1\right)^2$$

Where:
- $x_{i,j,t} \in \{0,1\}$ — patient $i$ assigned to doctor $j$ at time slot $t$
- **Term 1** — Maximize scheduling of high-urgency patients
- **Term 2** — Constraint: doctor sees at most 1 patient per slot (penalty $\lambda_1$)
- **Term 3** — Constraint: patient scheduled exactly once (penalty $\lambda_2$)

Solved using `openjij.SQASampler` (Simulated Quantum Annealing).

## Deployment

### Next.js → Vercel

```bash
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPTIMIZER_SERVICE_URL`

### Python Optimizer → Render

1. Create a new **Web Service** in Render pointing to the `/optimizer` directory
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set `ALLOWED_ORIGINS` to your Vercel URL

Or deploy with Docker:
```bash
cd optimizer
docker build -t qura-optimizer .
docker run -p 8000:8000 qura-optimizer
```

## Project Structure

```
/Qura
├── src/
│   ├── app/
│   │   ├── auth/login/         # Login page
│   │   ├── auth/signup/        # Signup with role selection
│   │   ├── auth/callback/      # Supabase OAuth callback
│   │   ├── dashboard/patient/  # Patient dashboard
│   │   ├── dashboard/admin/    # Admin dashboard + quantum trigger
│   │   ├── dashboard/doctor/   # Doctor schedule view
│   │   └── api/optimize/       # Next.js API → Python microservice
│   ├── components/
│   │   ├── AuthCard.tsx        # Shared auth UI wrapper
│   │   └── DashboardLayout.tsx # Sidebar layout for dashboards
│   ├── lib/
│   │   ├── supabase.ts         # Browser + server Supabase clients
│   │   ├── types.ts            # TypeScript domain types
│   │   └── database.types.ts   # Supabase table types
│   └── middleware.ts           # Role-based route protection
├── optimizer/
│   ├── app/
│   │   ├── main.py             # FastAPI app
│   │   ├── qubo_solver.py      # QUBO formulation + OpenJij solver
│   │   └── models.py           # Pydantic request/response models
│   ├── requirements.txt
│   └── Dockerfile
├── supabase/
│   └── schema.sql              # Complete DB schema with RLS
└── .env.local.example
```
