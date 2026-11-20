# PaintErp Backend

Minimal Express + MongoDB backend with an MVC-style folder structure, JWT admin login, and a role-based account model ready for future panels.

## Stack

- Node.js + Express
- MongoDB with Mongoose
- bcryptjs (password hashing) and jsonwebtoken (JWT bearer tokens)
- dotenv for environment configuration

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure `.env` (see `.env.example` for every variable):

   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://127.0.0.1:27017/painterp

   JWT_SECRET=<long-random-string>
   JWT_EXPIRES_IN=1d

   SEED_ADMIN_NAME=Super Admin
   SEED_ADMIN_EMAIL=admin@painterp.local
   SEED_ADMIN_PASSWORD=<strong-password>
   ```

   Generate a JWT secret with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Seed the admin account (idempotent — re-running updates the password from `.env`):

   ```bash
   npm run seed:admin
   ```

4. Run the server:

   ```bash
   npm run dev   # development (auto-reload)
   npm start     # production
   ```

## Auth flow

1. `POST /api/auth/login` with `{ "email": "...", "password": "..." }`.
2. Response contains `{ token, account }`.
3. Send the token on protected routes: `Authorization: Bearer <token>`.

Passwords are stored as bcrypt hashes. The `password` field is excluded from queries by default and removed from JSON responses. Roles are defined in `config/roles.js`; add new panel roles there.

## API

| Method | Endpoint            | Access | Description                  |
| ------ | ------------------- | ------ | ---------------------------- |
| GET    | `/api/health`       | public | Health check                 |
| POST   | `/api/auth/login`   | public | Log in with email + password |
| GET    | `/api/auth/me`      | token  | Current account              |
| GET    | `/api/admin/dashboard` | admin | Admin panel placeholder   |

## Project structure

```text
painterp-se/
├── app.js                        # Express app setup
├── server.js                     # Entry point, DB connection, server startup
├── config/
│   ├── config.js                 # Environment variables (+ required-var check)
│   ├── db.js                     # MongoDB connection
│   └── roles.js                  # Role constants
├── controllers/
│   └── auth.controller.js        # Login / current account
├── middlewares/
│   └── auth.middleware.js        # JWT verification + role authorization
├── models/
│   └── account.model.js          # Role-based account model
├── routes/
│   ├── index.js                  # Route aggregator + health check
│   ├── auth.routes.js
│   └── admin.routes.js
├── scripts/
│   └── seed-admin.js             # Seeds/updates admin from .env
├── .env
├── .env.example
├── .gitignore
└── package.json
```
