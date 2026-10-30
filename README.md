# IndExa — Accessible Digital Examination Platform

IndExa is an accessible digital examination platform engineered for inclusive, secure, and intuitive student assessments. The platform is designed from the ground up according to universal design and accessibility principles (WCAG 2.1 AAA compliance goals), offering assistive capabilities, clear visual affordances, and robust evaluation integrity.

---

## Architecture Overview

```
IndExa/
├── frontend/                  # React + Vite application
│   ├── src/
│   │   ├── components/        # Accessible UI components (Navbar, Footer, ProtectedRoute)
│   │   ├── context/           # AuthContext (centralized auth state & session handling)
│   │   ├── pages/             # WelcomePage, LoginPage, RegisterPage, StudentDashboard, TeacherDashboard
│   │   ├── services/          # Axios API client (Bearer interceptors, auth & health endpoints)
│   │   ├── App.jsx            # Router shell, route guards, and provider tree
│   │   ├── index.css          # Tailwind CSS & accessible focus design tokens
│   │   └── main.jsx           # React DOM root
│   ├── vite.config.js         # Vite configuration with Tailwind CSS plugin
│   └── package.json
│
├── backend/                   # FastAPI backend application
│   ├── app/
│   │   ├── api/               # API route handlers (auth endpoints & dependency guards)
│   │   ├── core/              # Configuration (Pydantic Settings) & Security (Argon2 / PyJWT)
│   │   ├── database/          # MongoDB connection manager & index lifecycle
│   │   ├── models/            # Domain models (UserModel, UserRole)
│   │   ├── schemas/           # Pydantic request/response schemas (safe user serializers)
│   │   ├── services/          # Business logic services (auth_service, teacher seeder)
│   │   ├── ai/                # AI and speech processing (future phase)
│   │   └── main.py            # FastAPI entry point, CORS, lifespan & GET /health
│   ├── tests/                 # Automated pytest suite (15 isolation tests on MongoDB)
│   ├── venv/                  # Python virtual environment (ignored in git)
│   ├── pytest.ini             # Pytest configuration
│   └── requirements.txt       # Core backend dependencies
│
├── .env.example               # Template environment configuration (includes JWT and seeding settings)
├── .gitignore                 # Exclusion rules for secrets, venvs, and build files
└── README.md                  # Project documentation
```

---

## Technologies Used

- **Frontend:**
  - React 19
  - Vite 8
  - Tailwind CSS 4
  - React Router DOM 7
  - Axios
  - Lucide React (accessible icons)
- **Backend:**
  - Python 3.10+ (tested on Python 3.14.6)
  - FastAPI
  - Uvicorn (ASGI web server)
  - Pydantic v2 & Pydantic-Settings
  - Motor & PyMongo (Asynchronous MongoDB driver)
  - `pwdlib` with Argon2id (`argon2-cffi`) for secure password hashing
  - `PyJWT` for signed JSON Web Tokens
  - `email-validator` for RFC-compliant email validation
  - `pytest`, `pytest-asyncio`, `httpx` for automated testing
- **Database:**
  - MongoDB (mandatory document database, `users` collection with unique index on normalized email)

---

## Required Software

1. **Node.js** (v18.0.0 or later, v20+ recommended) & **npm**
2. **Python** (v3.10 or later)
3. **MongoDB** (Local instance or MongoDB Atlas cluster running on port 27017)

---

## Installation & Setup

### 1. Clone & Inspect Structure
Ensure you are in the project root:
```bash
cd IndExa
```

### 2. Environment Configuration
Copy `.env.example` to `.env` in the root and/or backend folder:
```bash
cp .env.example .env
```

Key environment variables:
- `MONGODB_URI`: MongoDB connection string (e.g., `mongodb://localhost:27017`)
- `MONGODB_DATABASE`: Target database name (default: `indexa_db`)
- `JWT_SECRET_KEY`: High-entropy secret key for HMAC SHA-256 JWT signing (min 32 characters)
- `JWT_ALGORITHM`: Signing algorithm (default: `HS256`)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Expiration time for tokens (default: `60`)
- `ALLOW_SEED_TEACHER`: Safety flag controlling faculty account seeding (`true` / `false`)
- `TEACHER_SEED_NAME`: Name for initial teacher account
- `TEACHER_SEED_EMAIL`: Email for initial teacher account
- `TEACHER_SEED_PASSWORD`: Initial teacher password (min 8 characters)
- `CORS_ORIGINS`: Allowed origins (default: `http://localhost:5173,http://127.0.0.1:5173`)
- `VITE_API_BASE_URL`: Backend base URL for the frontend (default: `http://localhost:8000`)

---

## Backend Setup & Execution

### 1. Activate Virtual Environment
From the `backend` folder:
- **Windows (PowerShell):**
  ```powershell
  cd backend
  .\venv\Scripts\Activate.ps1
  ```
- **macOS / Linux:**
  ```bash
  cd backend
  source venv/bin/activate
  ```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Controlled Teacher Seeding (Optional)
To safely provision a development/initial teacher account from environment variables:
```powershell
$env:ALLOW_SEED_TEACHER="true"
$env:TEACHER_SEED_EMAIL="teacher@indexa.edu"
$env:TEACHER_SEED_PASSWORD="TeacherSecret123!"
python -m app.services.seed_teacher
```
*Note: The script strictly refuses execution unless `ALLOW_SEED_TEACHER=true` is set.*

### 4. Start Backend Server
```bash
uvicorn app.main:app --reload --port 8000
```
The backend will run at `http://127.0.0.1:8000`. OpenAPI docs are accessible at `http://127.0.0.1:8000/docs`.

---

## Backend Automated Testing

Run the comprehensive pytest suite to execute all 15 automated security, auth, and health test cases against an isolated test database (`indexa_test_db`):
```bash
cd backend
pytest -v
```

All test cases are verified against a live MongoDB connection:
1. `test_successful_student_registration`: Registers student via `POST /auth/register` (status 201).
2. `test_duplicate_email_registration_rejection`: Case-insensitive duplicate check (status 409).
3. `test_invalid_email_and_missing_field_validation`: Invalid email and missing fields rejected (status 422).
4. `test_passwords_are_stored_as_hashes_rather_than_plaintext`: Verifies Argon2 hash storage in MongoDB.
5. `test_successful_login_with_valid_credentials`: Issues valid JWT with claims (status 200).
6. `test_login_failure_with_incorrect_password`: Safe error messages preventing email enumeration (status 401).
7. `test_auth_me_rejects_requests_without_token`: Enforces authentication on `/auth/me` (status 401).
8. `test_auth_me_rejects_invalid_or_expired_tokens`: Rejects malformed and expired JWTs (status 401).
9. `test_registered_user_cannot_assign_themselves_teacher_role`: Rejects elevated role attempts (status 422).
10. `test_user_cannot_change_role_through_profile_request`: Blocks role escalation in profile requests (status 400).
11. `test_inactive_users_cannot_access_protected_endpoints`: Deactivated accounts denied login and profile access (status 403).
12. `test_existing_health_functionality_still_works`: Health check endpoint preserved (status 200).
13. `test_mongodb_connection_failures_reported_honestly`: Degraded status truthfully reported when DB disconnects.
14. `test_controlled_teacher_seeding`: Tests safety refusal when disabled and successful provisioning when enabled.
15. `test_role_based_access_control_enforcement`: Tests server-side role enforcement (students cannot access teacher portals).

---

## Frontend Setup & Execution

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Frontend Dev Server
```bash
npm run dev
```
The frontend will start at `http://localhost:5173`.

### 3. Production Build & Linting
```bash
npm run lint
npm run build
```

---

## Authentication API Endpoints

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Registers a new student account (public registration is strictly `student` role). |
| `POST` | `/auth/login` | Public | Authenticates credentials and issues a signed JWT token. |
| `GET` | `/auth/me` | Authenticated | Returns current user profile (never returns passwords or hashes). |
| `PATCH` | `/auth/me` | Authenticated | Updates current user profile details (strictly prohibits role alterations). |
| `GET` | `/auth/student-portal` | Role: `student` | Role-guarded student endpoint demonstrating RBAC enforcement. |
| `GET` | `/auth/teacher-portal` | Role: `teacher` | Role-guarded faculty endpoint demonstrating RBAC enforcement. |
| `GET` | `/health` | Public | Preserved system and MongoDB health diagnostic endpoint. |

---

## Frontend Routes & Roles

- `/` — Welcome & Live Platform Diagnostics Page
- `/login` — Sign In with email, password, toggle visibility, and error banners
- `/register` — Student Registration with name, email, password, and confirmation
- `/student/dashboard` — Student Dashboard placeholder with security profile and roadmap notices (Requires `student` role)
- `/teacher/dashboard` — Faculty Dashboard placeholder with instructor profile and authoring notices (Requires `teacher` role)
- `/unauthorized` — Accessible 403 Access Restricted page with quick return navigation

---

## Security Architecture & Token Handling

- **Password Storage:** Uses modern Argon2id password hashing via `pwdlib`. Passwords and password hashes are never returned in API responses or logged.
- **Email Normalization:** All emails are normalized (trimmed and lowercased) before database insertion and lookup, backed by a unique MongoDB index.
- **Timing & Enumeration Resistance:** Failed login attempts return safe, uniform error messages without disclosing whether an email address exists.
- **Role Integrity:** Public registration strictly creates `student` accounts. Elevated roles requested via registration or profile updates are rejected.
- **Token Persistence Limitation:** The prototype uses Bearer tokens stored in browser `localStorage` to enable client-side navigation. Client-side storage is subject to XSS limitations and is **not equivalent to `HttpOnly`, `Secure` cookies**. Passwords are never persisted, tokens are never placed in URLs, and tokens expire based on server settings.

---

## Scope Restrictions for Phase 2
The following modules are strictly out of scope for Phase 2 and will be implemented in subsequent phases:
- Exam creation and paper authoring suites
- Question management and question banks
- Student exam-taking and test session workflows
- Voice input and speech-to-text (Vosk / Whisper)
- Text-to-speech assistive readers
- Mathematical expression processing
- Offline mode and service workers
- Automated AI evaluation
