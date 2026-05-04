# Kodbank – Banking Simulation App

A small full-stack banking simulation with **registration/login**, **JWT authentication** (token stored in DB and sent via **cookie**), **check balance**, and **transfer money**. Database runs on **Aiven** (PostgreSQL).

## Features

- **Frontend**: React (Vite) – Register, Login, Dashboard (Check balance / Transfer money)
- **Backend**: Node.js + Express – REST API with JWT auth
- **Database**: MySQL on Aiven with two tables (matching your schema):
  - **BankUser**: `Cid`, `Cname`, `Cpwd`, `balance`, `email`
  - **BankUserJwt**: `tokenid`, `tokenvalue`, `Cid`, `exp`
- **Auth flow**: On login, a JWT is generated, stored in `BankUserJwt`, and set as an HTTP-only cookie. All protected requests send the cookie; backend validates the token and fetches the user.

## Quick start

### 1. Aiven database

1. In [Aiven Console](https://console.aiven.io/), use your **MySQL** service (e.g. `mysql-7af825f`).
2. In the service **Overview**, copy the **Service URI** and replace the password placeholder with your actual password (click "Reveal" to copy).

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

- `DATABASE_URL` = your Aiven MySQL Service URI (e.g. `mysql://avnadmin:YOUR_PASSWORD@mysql-7af825f-amina-9b5c.i.aivencloud.com:19298/defaultdb?ssl-mode=REQUIRED`)
- `JWT_SECRET` = a long random string (change in production)
- Optionally: `PORT`, `JWT_EXPIRY_DAYS`, `FRONTEND_ORIGIN`

Create the **BankUser** and **BankUserJwt** tables and start the API:

```bash
npm install
npm run init-db
npm run dev
```

API runs at **http://localhost:4000**.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**. Vite proxies `/api` to the backend so the cookie is sent correctly.

## Flow

1. **Register** → user stored in **BankUser** (Cid, Cname, Cpwd, balance, email).
2. **Login** → JWT created, row added to **BankUserJwt** (tokenid, tokenvalue, Cid, exp), cookie `kodbank_token` set.
3. **Dashboard** → two options: **Check balance** and **Transfer money**.
4. **Check balance** → request goes with cookie; backend validates JWT, returns balance.
5. **Transfer** → same cookie; backend validates JWT, debits/credits and returns new balance.

## Project layout

```
KodNest Bank App/
├── backend/
│   ├── db/pool.js           # PostgreSQL pool (Aiven)
│   ├── middleware/auth.js   # JWT validation from cookie
│   ├── routes/auth.js       # register, login, logout, me
│   ├── routes/bank.js       # balance, transfer
│   ├── scripts/init-db.js   # Creates bank_users + jwt_tokens
│   ├── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api.js           # fetch with credentials
│   │   ├── App.jsx          # Routes + auth guards
│   │   ├── pages/           # Login, Register, Dashboard, Balance, Transfer
│   │   └── main.jsx, index.css
│   ├── index.html
│   ├── vite.config.js       # Proxy /api to backend
│   └── package.json
└── README.md
```

## Database (Aiven MySQL) – matches your schema image

- **BankUser**: `Cid` (AUTO_INCREMENT), `Cname`, `Cpwd` (hashed), `balance`, `email`.
- **BankUserJwt**: `tokenid` (AUTO_INCREMENT), `tokenvalue`, `Cid` (FK → BankUser), `exp`.  
Backend validates each request by checking the cookie JWT against **BankUserJwt** and `exp`. Use the **Service URI** from your Aiven MySQL service Overview (with password revealed) in `DATABASE_URL`.
