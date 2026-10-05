# Sanya Gold Jewelry — Electronic Receipt & Sales Management System

Production-oriented Next.js + PostgreSQL application based on the supplied Sanya Gold Jewelry specification.

## Stack
- Next.js 15 / React 19
- TypeScript
- Tailwind CSS v4
- PostgreSQL + Prisma
- JWT httpOnly session cookie + bcrypt password hashing
- QR verification via `qrcode`
- Server-side transaction creation with database-controlled receipt numbering

## Run locally
1. Install Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong `AUTH_SECRET`.
3. `npm install`
4. `npm run db:push`
5. `npm run db:seed`
6. `npm run dev`
7. Open `http://localhost:3000`

Demo login: `admin@sanyagold.local` / `Password123!`

## Production / Render
The repository includes `render.yaml` for a Render web service and PostgreSQL database. Render injects `DATABASE_URL`; set `AUTH_SECRET` and `NEXT_PUBLIC_APP_URL` in the service environment.

## Implemented foundation
Authentication, role model, business/customer/product/sale/receipt/payment/audit schema, seeded Nigerian demo data, dashboard, receipt creation, receipt history, receipt detail, QR verification, cancellation endpoint, responsive navigation, and receipt HTML print/PDF workflow are included. The schema is intentionally multi-business capable.

## Important deployment note
The receipt PDF endpoint currently produces a print-ready HTML document and invokes browser print. For server-generated binary PDFs, replace that route with a production PDF renderer such as Playwright/Chromium or a dedicated PDF service during deployment.
