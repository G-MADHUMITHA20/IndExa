# IndExa — Accessible Digital Examination Platform

IndExa is an accessible digital examination platform engineered for inclusive, secure, and intuitive student assessments. The platform is designed from the ground up according to universal design and accessibility principles (WCAG 2.1 AAA compliance goals), offering assistive capabilities, clear visual affordances, and robust evaluation integrity.

---

## Architecture Overview

```
IndExa/
├── frontend/                  # React + Vite application
│   ├── src/
│   │   ├── components/        # Accessible UI components (Navbar, Footer, ProtectedRoute, TeacherSidebar, TeacherLayout, StatusBadge)
│   │   ├── context/           # AuthContext (centralized auth state & session handling)
│   │   ├── pages/             # WelcomePage, LoginPage, RegisterPage, StudentDashboard, ExamTakePage,
│   │   │                      # TeacherDashboard, ExamListPage, CreateExamPage, EditExamPage,
│   │   │                      # ExamDetailPage, QuestionManagementPage, TeacherProfilePage, UnauthorizedPage
│   │   ├── services/          # Axios API client (Bearer interceptors, auth, health, exams & student endpoints)
│   │   ├── App.jsx            # Router shell, route guards, and provider tree
│   │   ├── index.css          # Tailwind CSS & accessible focus design tokens
│   │   └── main.jsx           # React DOM root
│   ├── vite.config.js         # Vite configuration with Tailwind CSS plugin
│   └── package.json
│
├── backend/                   # FastAPI backend application
│   ├── app/
│   │   ├── api/               # API route handlers (auth, exams, student endpoints, role dependency guards)
│   │   ├── core/              # Configuration (Pydantic Settings) & Security (Argon2 / PyJWT)
│   │   ├── database/          # MongoDB connection manager & index lifecycle
│   │   ├── models/            # Domain models (UserModel, UserRole, ExamModel, QuestionModel, AttemptModel, AnswerRecord)
│   │   ├── schemas/           # Pydantic schemas (auth, exam, attempt serializers)
│   │   ├── services/          # Business logic (auth_service, exam_service, student_service, teacher seeder)
│   │   ├── ai/                # AI and speech processing (future phase)
│   │   └── main.py            # FastAPI entry point, CORS, lifespan & GET /health
│   ├── tests/                 # Automated pytest suite (46 isolation tests on MongoDB)
│   │   ├── conftest.py        # Database fixture management and HTTPX client setup
│   │   ├── test_auth.py       # Authentication & RBAC test suite (15 tests)
│   │   ├── test_exams.py      # Teacher Exam & Question management test suite (15 tests)
│   │   └── test_student.py    # Student Exam Taking & Engine test suite (16 tests)
│   ├── venv/                  # Python virtual environment (ignored in git)
│   ├── pytest.ini             # Pytest configuration
│   └── requirements.txt       # Core backend dependencies
│
├── .env.example               # Template environment configuration
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
  - MongoDB (mandatory document database): collections `users`, `exams`, and `questions` with unique and compound indexes.

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
- `MONGODB_URI`: MongoDB connection string (default: `mongodb://localhost:27017`)
- `MONGODB_DATABASE`: Target database name (default: `indexa_db`)
- `JWT_SECRET_KEY`: High-entropy secret key for HMAC SHA-256 JWT signing (min 32 characters)
- `JWT_ALGORITHM`: Signing algorithm (default: `HS256`)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Expiration time for tokens (default: `60`)
- `ALLOW_SEED_TEACHER`: Safety flag controlling faculty account seeding (`true` / `false`)
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

### 3. Provision a Teacher Account (Optional)
To safely seed a faculty account with credentials from environment variables:
```powershell
$env:ALLOW_SEED_TEACHER="true"
$env:TEACHER_SEED_EMAIL="teacher@indexa.edu"
$env:TEACHER_SEED_PASSWORD="TeacherSecret123!"
python -m app.services.seed_teacher
```

### 4. Start Backend Server
```bash
uvicorn app.main:app --reload --port 8000
```
The backend runs at `http://127.0.0.1:8000`. Interactive OpenAPI documentation is at `http://127.0.0.1:8000/docs`.

---

## Backend Automated Testing

Run the full pytest suite executing all 30 automated security, authentication, and exam management test cases against an isolated test database (`indexa_test_db`):
```bash
cd backend
pytest -v
```

### Test Coverage Summary:
- **`tests/test_auth.py` (15 tests):**
  1. Successful student registration (`POST /auth/register`)
  2. Duplicate email registration rejection (case-insensitive)
  3. Invalid email and missing-field validation
  4. Passwords stored as Argon2 hashes rather than plaintext
  5. Successful login returning signed JWT access token
  6. Login failure preventing email enumeration
  7. `/auth/me` rejects unauthenticated requests
  8. `/auth/me` rejects invalid or expired tokens
  9. Public registration rejects self-assigned teacher role
  10. Profile requests cannot escalate user role
  11. Deactivated users cannot log in or access protected endpoints
  12. Preserved `/health` endpoint verification
  13. Database connection failures reported honestly
  14. Controlled teacher seeding refusal and provisioning
  15. Role-based access control server-side enforcement
- **`tests/test_exams.py` (15 tests):**
  1. Teacher can create an exam (`POST /exams`, defaults to Draft)
  2. Student cannot create an exam (HTTP 403 Forbidden)
  3. Unauthenticated requests to teacher APIs return HTTP 401
  4. Teacher can retrieve own exam list and individual detail
  5. Teacher cannot access another teacher's exam (HTTP 403)
  6. Invalid exam data is rejected (missing fields, negative duration, invalid dates)
  7. Teacher can add, edit, and delete questions
  8. MCQ validation rules (min 2 options, valid correct answer)
  9. Exam marks mismatch prevents publishing
  10. An exam without questions cannot be published
  11. Valid exams can be published
  12. Invalid status transitions rejected (e.g. draft directly to closed)
  13. Closed exams cannot be reopened or modified
  14. Draft deletion works correctly (published/closed cannot be deleted)
  15. Question reordering updates display order sequence
- **`tests/test_student.py` (16 tests):**
  1. Student can view published exams
  2. Student cannot view draft exams
  3. Student cannot start an exam before its start time
  4. Student cannot start an expired exam
  5. Student can start an eligible exam
  6. Student can resume an existing active attempt
  7. Student cannot access another student's attempt
  8. Answers are saved to MongoDB
  9. Autosaved answers remain unconfirmed
  10. Answers persist after refresh
  11. Timer remains consistent after refresh
  12. Expired attempts cannot continue
  13. Students cannot modify answers after submission
  14. Duplicate submissions are prevented
  15. Teacher APIs remain protected from student access
  16. MCQ correct answers and private guidance hidden from students

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
The frontend starts at `http://localhost:5173`.

### 3. Production Build & Linting
```bash
npm run lint
npm run build
```

---

## API Endpoints & Permissions

### Authentication Endpoints
| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Registers a student account. Elevated roles are strictly rejected. |
| `POST` | `/auth/login` | Public | Authenticates credentials and returns a signed JWT access token. |
| `GET` | `/auth/me` | Authenticated | Returns current user profile without passwords or hashes. |
| `PATCH` | `/auth/me` | Authenticated | Updates user profile; strictly prohibits self-modification of roles. |
| `GET` | `/health` | Public | Preserved system and MongoDB health diagnostic endpoint. |

### Exam Management Endpoints (Teacher Only)
| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `POST` | `/exams` | Role: `teacher` | Creates a new exam in Draft status associated with the authenticated teacher. |
| `GET` | `/exams` | Role: `teacher` | Lists all exams belonging to the authenticated teacher with status and search filters. |
| `GET` | `/exams/{id}` | Role: `teacher` | Retrieves full exam detail including all configured questions. |
| `PUT` | `/exams/{id}` | Role: `teacher` | Updates exam metadata and schedule. Closed exams cannot be edited. |
| `DELETE` | `/exams/{id}` | Role: `teacher` | Deletes an eligible draft exam and its questions. |
| `POST` | `/exams/{id}/questions` | Role: `teacher` | Adds a question (MCQ, Short Answer, Long Answer, Mathematical). |
| `PUT` | `/exams/{id}/questions/{qid}` | Role: `teacher` | Updates question text, type, marks, or options in a draft exam. |
| `DELETE` | `/exams/{id}/questions/{qid}` | Role: `teacher` | Deletes a question from a draft exam. |
| `PUT` | `/exams/{id}/questions/reorder` | Role: `teacher` | Reorders questions within a draft exam according to provided ID list. |
| `POST` | `/exams/{id}/publish` | Role: `teacher` | Publishes a draft exam. Enforces >=1 question and exact marks equality. |
| `POST` | `/exams/{id}/close` | Role: `teacher` | Closes an active published exam. Closed exams cannot be reopened. |

### Student Examination Endpoints (Student Only)
| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `GET` | `/student/exams` | Role: `student` | Lists published exams available to the student with attempt and schedule status. |
| `GET` | `/student/exams/{exam_id}` | Role: `student` | Retrieves public details of an eligible exam without private answers or guidance. |
| `POST` | `/student/exams/{exam_id}/start` | Role: `student` | Starts a new attempt or resumes an ongoing attempt. Validates deadline. |
| `GET` | `/student/attempts` | Role: `student` | Lists all attempts belonging to the authenticated student. |
| `GET` | `/student/attempts/{attempt_id}` | Role: `student` | Retrieves the student's own attempt with saved draft responses and remaining time. |
| `GET` | `/student/attempts/{attempt_id}/questions` | Role: `student` | Retrieves question prompts for an active attempt (correct answers omitted). |
| `PUT` | `/student/attempts/{attempt_id}/answers/{question_id}` | Role: `student` | Saves or autosaves an unconfirmed answer draft in MongoDB. |
| `POST` | `/student/attempts/{attempt_id}/submit` | Role: `student` | Submits and locks the examination attempt, preventing duplicate submissions. |

---

## Exam Status Workflow

```
[Draft]  ──(Publish: requires >= 1 Q, marks match)──>  [Published]  ──(Close)──>  [Closed]
   │                                                        │                       │
(Editable,                                             (Immutable Qs,          (Read-only,
Deletable)                                            Accepts Students)        Immutable)
```

- **Draft:** Newly created exams default to Draft. Teachers can edit details, author questions, reorder questions, and delete the draft.
- **Published:** Requires at least one question and exact mark equality (`sum(question.marks) == exam.total_marks`). Questions are locked from modification to preserve assessment integrity.
- **Closed:** Concluded assessment state. Cannot be modified, deleted, or reopened.

---

## Question Types Supported

1. **Multiple-Choice Questions (MCQ):** Dynamic options list (minimum 2 non-empty options) with single option selection and clear Option A/B/C readback.
2. **Short-Answer Questions:** Text prompt with accessible textarea input and character count.
3. **Long-Answer Questions:** Essay/descriptive prompt with accessible multi-line textarea, character counter, and word counter.
4. **Mathematical Expressions:** Text-based math equation and expression notation input.

---

## Accessibility & Assistive Features (Prompt 5)

- **Web Speech Synthesis API:**
  - Spoken examination instructions (duration, marks, navigation rules, autosave explanation, submission workflow).
  - Question readback with option letters (Option A, Option B) for MCQs.
  - Answer readback to review drafted or selected answers before submission.
  - Speech lifecycle controls: Read Question, Repeat Question, Read My Answer, Pause, Resume, and Stop.
  - Automatic speech cancellation on navigation or unmount to avoid overlapping audio.
- **Keyboard Navigation (`Alt` Shortcuts):**
  - `Alt + R`: Read current question aloud.
  - `Alt + A`: Read current drafted answer aloud.
  - `Alt + E`: Focus answer input / radio option.
  - `Alt + Left Arrow`: Navigate to previous question (protected during text editing).
  - `Alt + Right Arrow`: Navigate to next question (protected during text editing).
  - `Alt + S`: Open examination submission confirmation dialog.
  - `Alt + V`: Reserved for voice input (Prompt 6).
  - `Alt + Enter`: Reserved for explicit answer confirmation (Prompt 7).
- **Accessibility Settings:**
  - Font scaling: Small, Medium, Large, Extra Large.
  - High-Contrast Theme: Pure black/white/yellow contrast with 3px focus rings.
  - Speech speed (0.5x–2.0x) and volume (0%–100%) sliders with audio preview test.
  - Browser voice selector.
  - Automatic question reading toggle.
  - Persistent MongoDB storage per student account (`/student/preferences`).

