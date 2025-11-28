# E-Delivery

Simple end-to-end delivery management demo featuring:
- Node.js + Express + Prisma + SQLite backend
- Vanilla HTML/CSS/JS frontend served by Express
- Admin auth, driver magic links, delivery creation, and driver confirmation with photos + signatures

## Getting started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` (values shown are safe defaults for local dev):
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="CHANGE_ME_TO_SOMETHING_SECURE_AND_RANDOM"
   ADMIN_EMAIL="admin@example.com"
   ADMIN_PASSWORD="password123"
   NODE_ENV="development"
   # Optional: set APP_BASE_URL (e.g., http://localhost:3000) for clearer seed logs
   # Optional: set SEED_DEMO=false to skip demo driver/delivery creation
   ```
3. Generate Prisma client and start the server:
   ```bash
   npx prisma generate
   npm run dev
   ```

## Demo data
On first boot (unless `SEED_DEMO=false`), the app seeds a demo driver and delivery to showcase the driver flow. The console logs the magic link you can open in a browser to authenticate as that driver.

## Core URLs
- Landing: http://localhost:3000/
- Admin login: http://localhost:3000/login.html
- Admin dashboard: http://localhost:3000/admin
- Driver magic link: http://localhost:3000/magic-login/<token>
- Driver deliveries page: http://localhost:3000/delivery/<deliveryId>

## File uploads
Uploaded invoice files, delivery photos, and signature images are stored under `uploads/` (automatically created at startup). Ensure the process has write permissions to that directory.
