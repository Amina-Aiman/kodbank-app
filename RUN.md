# How to run KodNest Bank App

## Important: restart to get the latest fixes

If you changed code or .env, **restart both backend and frontend** so the app uses the new version.

---

## 1. Start the backend

Open a terminal (e.g. in VS Code: Terminal → New Terminal) and run:

```powershell
cd "c:\Users\amina\OneDrive\Desktop\KodNest Bank App\backend"
node server.js
```

You should see:

- `Kodbank API running on http://localhost:4000`
- `AI chat: using Hugging Face router API ... Token: configured` (or "NOT set" if you still need to add the key)

Leave this terminal open. To stop the backend, press **Ctrl+C**.

---

## 2. Start the frontend

Open a **second** terminal and run:

```powershell
cd "c:\Users\amina\OneDrive\Desktop\KodNest Bank App\frontend"
npm run dev
```

You should see something like:

- `Local: http://localhost:5173/` or `http://localhost:5174/`

Leave this terminal open. To stop the frontend, press **Ctrl+C**.

---

## 3. Open the app in the browser

- Go to **http://localhost:5173** or **http://localhost:5174** (use the URL shown in the frontend terminal).
- You should see the **login** page first (unless you are already logged in; then you’ll be redirected to the dashboard).
- To see the login page again after logging in: click **Logout** in the sidebar.

---

## 4. If Chat with AI shows an error

1. Go to [Hugging Face → Settings → Access Tokens](https://huggingface.co/settings/tokens).
2. Create a new token and enable **"Make calls to Inference Providers"**.
3. Open `backend\.env` and set:
   ```env
   HUGGINGFACE_API_KEY=hf_YourFullTokenHere
   ```
   (no quotes, no spaces, no extra characters)
4. **Restart the backend** (Ctrl+C in the backend terminal, then run `node server.js` again from the backend folder).
5. Try Chat with AI again.

---

## 5. If the dashboard opens instead of the login page

You are already logged in (the app remembers you with a cookie). To see the login page:

- Click **Logout** in the left sidebar, or  
- Open the app in a private/incognito window.
