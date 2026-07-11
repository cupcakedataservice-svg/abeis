<!-- # ABEIS — Automated Behavioral & Engagement Intelligence System

A full-stack research platform that registers participants, captures explicit informed consent, records webcam and screen video, and collects rich behavioral telemetry (mouse, keyboard, session signals) across three assessment types — MCQ, Coding, and Typing — to build per-user behavioral baselines for longitudinal comparison. A fully authenticated Admin Dashboard lets researchers search, inspect, export, and permanently delete participant data.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Repository Structure](#repository-structure)
3. [Technology Stack](#technology-stack)
4. [Environment Variables](#environment-variables)
5. [Quick Start](#quick-start)
6. [Backend — File Reference](#backend--file-reference)
   - [Entry Point](#entry-point)
   - [Configuration](#configuration)
   - [Models](#models)
   - [Controllers](#controllers)
   - [Routes](#routes)
   - [Middleware](#middleware)
   - [Services](#services)
7. [Frontend — File Reference](#frontend--file-reference)
   - [Entry Point & Root](#entry-point--root)
   - [Context Providers](#context-providers)
   - [API Client](#api-client)
   - [Pages](#pages)
   - [Hooks](#hooks)
   - [Components](#components)
8. [Data Flow — End-to-End Walkthroughs](#data-flow--end-to-end-walkthroughs)
   - [Participant Registration](#1-participant-registration)
   - [Consent & Permission Grant](#2-consent--permission-grant)
   - [Assessment Session](#3-assessment-session)
   - [Behavioral Data Submission](#4-behavioral-data-submission)
   - [Admin Login & Dashboard](#5-admin-login--dashboard)
   - [Participant Deletion](#6-participant-deletion)
9. [API Reference](#api-reference)
10. [MongoDB Collections](#mongodb-collections)
11. [Security Model](#security-model)
12. [Deployment](#deployment)
13. [Known Limitations & Future Hardening](#known-limitations--future-hardening)

---

## Architecture Overview

```
Browser (React + Vite)
        │
        │  HTTP / multipart
        ▼
Express API (Node.js)
        │                        │
        │  Mongoose ODM           │  ImageKit SDK
        ▼                        ▼
  MongoDB Atlas            ImageKit Cloud
  (structured data)        (video recordings)
```

The frontend is a single-page React application. Every state-changing action hits a REST endpoint on the Express backend. Recordings (webcam, screen) are the only binary data; they are streamed directly from the browser's `MediaRecorder` to the backend, which forwards them to ImageKit. Only the resulting metadata (URL, file ID, size) is stored in MongoDB.

The Admin Dashboard is entirely separate from the participant flow. It is protected by a JWT issued by the backend on successful admin login. No admin credential ever reaches the browser's JavaScript bundle.

---

## Repository Structure

```
abeis/
├── backend/
│   ├── server.js                     # Express app entry point
│   ├── package.json
│   ├── .env.example
│   ├── config/
│   │   ├── db.js                     # MongoDB connection
│   │   └── imagekit.js               # ImageKit upload/delete abstraction
│   ├── models/
│   │   ├── User.js
│   │   ├── Consent.js
│   │   ├── Assessment.js
│   │   ├── BehavioralFeature.js
│   │   ├── AssessmentResponse.js
│   │   ├── Media.js
│   │   └── Baseline.js
│   ├── controllers/
│   │   ├── userController.js
│   │   ├── consentController.js
│   │   ├── assessmentController.js
│   │   ├── responseController.js
│   │   ├── mediaController.js
│   │   ├── baselineController.js
│   │   └── adminController.js
│   ├── routes/
│   │   ├── userRoutes.js
│   │   ├── consentRoutes.js
│   │   ├── assessmentRoutes.js
│   │   ├── responseRoutes.js
│   │   ├── mediaRoutes.js
│   │   ├── baselineRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── adminAuth.js              # JWT verification middleware
│   │   └── errorMiddleware.js        # 404 + error handler
│   └── services/
│       └── baselineService.js        # Running-average baseline engine
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    ├── .env.example
    └── src/
        ├── main.jsx                  # React entry point
        ├── App.jsx                   # Route definitions + AdminProvider
        ├── index.css                 # Tailwind + global CSS vars
        ├── api/
        │   └── client.js             # Axios instance + JWT interceptor
        ├── context/
        │   ├── SessionContext.jsx    # Participant session state
        │   └── AdminContext.jsx      # Admin auth state (JWT)
        ├── components/
        │   └── RequireAdmin.jsx      # Route guard for admin pages
        ├── hooks/
        │   ├── useMouseTracking.js
        │   ├── useKeyboardTracking.js
        │   ├── useSessionTracking.js
        │   └── useMediaRecording.js
        └── pages/
            ├── RegisterPage.jsx      # Landing + participant registration
            ├── ConsentPage.jsx       # Informed consent + permission grant
            ├── HubPage.jsx           # Assessment selection hub
            ├── McqAssessmentPage.jsx
            ├── CodingAssessmentPage.jsx
            ├── TypingAssessmentPage.jsx
            ├── CompletePage.jsx
            ├── AdminLoginPage.jsx
            ├── AdminDashboardPage.jsx
            └── AdminUserDetailPage.jsx
```

---

## Technology Stack

| Layer                 | Technology                     |
| --------------------- | ------------------------------ |
| Frontend framework    | React 18 + Vite                |
| Styling               | Tailwind CSS                   |
| Routing               | React Router v6                |
| HTTP client           | Axios                          |
| Backend framework     | Express 4                      |
| Database              | MongoDB (via Mongoose 8)       |
| Media storage         | ImageKit                       |
| Auth tokens           | JSON Web Tokens (jsonwebtoken) |
| File upload (backend) | Multer (memory storage)        |
| CSV export            | json2csv                       |
| ID generation         | uuid v4                        |
| Logging               | Morgan                         |
| Security headers      | Helmet                         |
| Rate limiting         | express-rate-limit             |

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/abeis

# ImageKit credentials
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# Allowed CORS origin (set to your frontend URL in production)
FRONTEND_URL=http://localhost:5173

# Privacy policy version stamped on every consent record
PRIVACY_POLICY_VERSION=1.0.0

# Admin credentials — never hardcode these in source
ADMIN_ID=ADMIN001
ADMIN_PASSWORD=ADMIN@001

# JWT signing secret — use a long random string in production
JWT_SECRET=change-this-to-a-long-random-secret
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env        # fill in your credentials
npm install
npm run dev                  # nodemon — restarts on file changes
# API listening at http://localhost:5000
```

### Frontend

```bash
cd frontend
cp .env.example .env         # adjust VITE_API_BASE_URL if needed
npm install
npm run dev
# App at http://localhost:5173
```

Visit `http://localhost:5173` to start as a participant, or click **Admin Login** on the landing page and use the credentials set in your `.env` to access the Admin Dashboard.

---

## Backend — File Reference

### Entry Point

#### `backend/server.js`

The root of the Express application. Responsibilities:

- Loads `.env` via `dotenv`.
- Calls `connectDB()` to establish the MongoDB connection before the server starts.
- Applies global middleware in order: `helmet` (security headers), `cors` (restricted to `FRONTEND_URL`), `express.json` (10 MB limit for large feature vector payloads), `morgan` (request logging), and a `rateLimit` of 1 000 requests per 15-minute window on all `/api` routes.
- Mounts every route group under its path prefix (`/api/users`, `/api/consent`, etc.).
- Registers the `notFound` and `errorHandler` middleware last so they catch anything not matched by a route.
- Starts the HTTP server on `process.env.PORT` (default 5000).

**Connections:** imports every route file; imports `connectDB` and `errorMiddleware`.

---

### Configuration

#### `backend/config/db.js`

Exports a single async function `connectDB()`. Calls `mongoose.connect()` with the `MONGODB_URI` env var and logs the connected host. Exits the process on failure so a misconfigured environment fails fast rather than serving 500s.

**Used by:** `server.js`.

#### `backend/config/imagekit.js`

Initialises the ImageKit SDK with the three ImageKit env vars and exports two wrapper functions:

- `uploadToStorage(fileBuffer, fileName, folder)` — uploads a `Buffer` to a given ImageKit folder and returns the full ImageKit response (including `fileId`, `url`, `name`, `size`).
- `deleteFromStorage(fileId)` — deletes a single file by its ImageKit file ID.

The abstraction keeps all ImageKit SDK calls in one place; replacing ImageKit with S3 or Azure Blob means reimplementing only these two functions without touching any controller.

**Used by:** `mediaController.js`, `adminController.js`.

---

### Models

All models use Mongoose schemas. Every document that belongs to a participant references the participant by their `userId` string (a UUID v4), not by MongoDB's `_id`. This makes cross-collection queries straightforward and keeps the deletion logic consistent.

#### `backend/models/User.js`

Stores the participant's identity.

| Field                     | Type             | Notes                                |
| ------------------------- | ---------------- | ------------------------------------ |
| `userId`                  | String (UUID v4) | Auto-generated, unique, indexed      |
| `name`                    | String           | Required, trimmed                    |
| `email`                   | String           | Required, unique, lowercase, indexed |
| `createdAt` / `updatedAt` | Date             | Auto-managed by Mongoose timestamps  |

Registering with an existing email returns the existing record (idempotent register), enabling returning participants to build on their baseline without creating duplicate profiles.

#### `backend/models/Consent.js`

One document per consent event (a participant may consent multiple times across assessment types).

Key fields: `consentId` (UUID), `userId`, `sessionId`, `consentAccepted` (boolean), `acknowledgedStatements` (one boolean per the 8 required statements), `cameraPermissionStatus`, `screenRecordingPermissionStatus`, `browserInfo`, `privacyPolicyVersion`, `ipAddress`.

The consent record is the gate that `startAssessment` checks before creating an `Assessment` document. Both `cameraPermissionStatus` and `screenRecordingPermissionStatus` must equal `"granted"` or consent creation is rejected with a 403.

#### `backend/models/Assessment.js`

One document per assessment session.

Key fields: `assessmentId` (UUID), `userId`, `sessionId` (UUID shared with the consent for that session), `assessmentType` (`"mcq" | "coding" | "typing"`), `consentId`, `status` (`"in_progress" | "completed" | "abandoned"`), `startedAt`, `endedAt`, `duration` (seconds), `meta` (arbitrary config snapshot — which questions were served, etc.).

#### `backend/models/BehavioralFeature.js`

One document per completed assessment. Stores the aggregated feature vector and optionally the raw event log.

`featureVector` is a `Mixed` (schemaless) object. Its expected shape contains sub-objects:

```
mouse:    { totalMovement, avgSpeed, maxSpeed, acceleration, clickFrequency,
            doubleClicks, rightClicks, dragEvents, scrollEvents, scrollDistance,
            cursorSmoothness }

keyboard: { avgKeyPressDuration, avgInterKeyLatency, typingRhythmVariance,
            keyFrequency, errorRate, backspaceCount, deleteCount, shiftUsageCount,
            ctrlComboCount, copyAttempts, pasteAttempts }

session:  { idleTimeMs, idlePeriodsCount, focusChanges, tabSwitches,
            fullscreenExits, avgNetworkLatencyMs, browser, device,
            screenResolution, sessionDurationMs }

camera:   { cameraEnabled, lookingAwayCount, faceDetectionStatus }
screen:   { screenRecordingEnabled, recordingDurationMs }

typing:   { wpm, accuracy, errorCorrections }       ← typing assessments only
coding:   { copyPasteAttempts, backspaces, corrections }  ← coding assessments only
```

`rawEvents` optionally stores the full arrays of `mouseEvents`, `keyboardEvents`, and `sessionEvents` for deep re-analysis. These are capped client-side to keep payload sizes manageable.

#### `backend/models/AssessmentResponse.js`

One document per assessment — stores the actual answers given.

- `mcqResponses[]` — per-question: `questionId`, `selectedOption`, `correctOption`, `isCorrect`, `responseTimeMs`.
- `codingResponses[]` — per question (independent + transcription): `submittedCode`, `language`, `backspaceCount`, `correctionCount`, `copyPasteAttempts`, `matchesProvidedSolution`.
- `typingResponses[]` — per task (plain + symbol-heavy): `sourceText`, `typedText`, `wpm`, `accuracy`, `responseTimeMs`.

#### `backend/models/Media.js`

One document per assessment. Stores the metadata for both recordings after they have been uploaded to ImageKit.

Each of `cameraRecording` and `screenRecording` is an embedded sub-document containing: `imagekitFileId`, `imageUrl`, `fileName`, `size` (bytes), `duration` (seconds). The `imagekitFileId` is what `deleteFromStorage()` uses during deletion.

#### `backend/models/Baseline.js`

One document per participant (unique on `userId`). Maintains a running average of nine behavioural metrics split by assessment type — `mcqBaseline`, `codingBaseline`, `typingBaseline` — each a sub-document with:

`sampleCount`, `avgResponseTimeMs`, `avgTypingSpeedWpm`, `avgMouseSpeed`, `avgClickFrequency`, `avgKeyLatencyMs`, `avgScrollDistance`, `avgIdleDurationMs`, `avgBackspaceCount`, `avgFocusChanges`, `lastUpdatedAt`, `lastFeatureVector` (full snapshot of the most recent assessment's vector).

---

### Controllers

Controllers are thin async handlers (using `express-async-handler` to avoid boilerplate try/catch). They read from the request, call models or services, and write the response.

#### `backend/controllers/userController.js`

| Function       | Route                      | Description                                                                                                                                                      |
| -------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerUser` | `POST /api/users/register` | Creates a new participant or returns an existing one (matched by email). Sets `isReturningUser` in the response so the frontend can show a personalised message. |
| `getUserById`  | `GET /api/users/:userId`   | Returns one participant by their UUID.                                                                                                                           |
| `listUsers`    | `GET /api/users`           | Returns all participants; supports a `search` query parameter that matches against `name`, `email`, or `userId` using case-insensitive regex.                    |

#### `backend/controllers/consentController.js`

| Function        | Route                         | Description                                                                                                                                                                                                                 |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recordConsent` | `POST /api/consent`           | Validates that all 8 `acknowledgedStatements` are `true` and that both permissions are `"granted"`, then creates a `Consent` document. Stamps the `privacyPolicyVersion` from the env var and the participant's IP address. |
| `getConsent`    | `GET /api/consent/:consentId` | Returns one consent record by ID.                                                                                                                                                                                           |

#### `backend/controllers/assessmentController.js`

| Function                | Route                                          | Description                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `startAssessment`       | `POST /api/assessments/start`                  | Looks up the `consentId`, verifies `consentAccepted === true`, generates a `sessionId`, and creates an `Assessment` with `status: "in_progress"`.                                                                                                |
| `completeAssessment`    | `POST /api/assessments/:assessmentId/complete` | Marks the assessment completed, saves a `BehavioralFeature` document, runs `compareAgainstBaseline` to compute deviation, then updates the baseline via `updateBaselineAfterAssessment`. Returns `{ assessment, behavioralFeature, deviation }`. |
| `getAssessmentsForUser` | `GET /api/assessments/user/:userId`            | Lists all assessments for a user sorted newest-first.                                                                                                                                                                                            |
| `getAssessmentById`     | `GET /api/assessments/:assessmentId`           | Returns an assessment with its joined `BehavioralFeature` and `AssessmentResponse`.                                                                                                                                                              |

#### `backend/controllers/responseController.js`

| Function        | Route                              | Description                                                                                                                            |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `saveResponses` | `POST /api/responses`              | Upserts the `AssessmentResponse` document for a given `assessmentId`. Called by each assessment page just before `completeAssessment`. |
| `getResponses`  | `GET /api/responses/:assessmentId` | Returns the response document.                                                                                                         |

#### `backend/controllers/mediaController.js`

| Function                | Route                          | Description                                                                                                                                                                                     |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uploadRecording`       | `POST /api/media/upload`       | Receives a `multipart/form-data` upload (via Multer), calls `uploadToStorage()` to push the buffer to ImageKit, then upserts a `Media` document for the assessment with the resulting metadata. |
| `getMediaForAssessment` | `GET /api/media/:assessmentId` | Returns the media metadata document for an assessment.                                                                                                                                          |

#### `backend/controllers/baselineController.js`

| Function             | Route                        | Description                                                                                         |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `getBaselineForUser` | `GET /api/baselines/:userId` | Returns the participant's `Baseline` document, or 404 if they haven't completed any assessment yet. |

#### `backend/controllers/adminController.js`

The largest controller. All functions except `adminLogin` require the `adminAuth` middleware.

| Function              | Route                                   | Description                                                                                                                                                                                                     |
| --------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adminLogin`          | `POST /api/admin/login`                 | Compares `adminId` and `password` against `ADMIN_ID` / `ADMIN_PASSWORD` env vars. On success, signs an 8-hour JWT with `JWT_SECRET` and returns it. Logs the event with IP and timestamp.                       |
| `adminLogout`         | `POST /api/admin/logout`                | Logs the logout event. Token invalidation happens client-side (sessionStorage is cleared).                                                                                                                      |
| `adminProfile`        | `GET /api/admin/profile`                | Returns `{ adminId }` from the JWT payload. Used by the dashboard to display the signed-in admin.                                                                                                               |
| `getOverview`         | `GET /api/admin/overview`               | Returns aggregate counts: total users, total assessments, completed assessments, and a breakdown by assessment type.                                                                                            |
| `getUsersWithSummary` | `GET /api/admin/users`                  | Returns all participants with computed summary fields. Supports query parameters: `search` (name / email / userId), `assessmentType`, `calibration` (yes/no), `finalAssessment` (yes/no), `dateFrom`, `dateTo`. |
| `getUserDetails`      | `GET /api/admin/users/:userId/details`  | Full drill-down for one participant: user profile, all assessments, all behavioral feature documents, all responses, media metadata, baseline, and consent history.                                             |
| `exportDataset`       | `GET /api/admin/export`                 | Builds a flat table of all assessments joined with user info, behavioral features, and media URLs. Responds as a downloadable CSV (`format=csv`) or JSON file.                                                  |
| `deleteUser`          | `DELETE /api/admin/users/:userId`       | Runs the 15-step deletion sequence (see [Participant Deletion](#6-participant-deletion)) for one user and logs the action.                                                                                      |
| `deleteSelectedUsers` | `POST /api/admin/users/delete-selected` | Accepts `{ userIds: string[] }` and runs the deletion sequence for each user in series.                                                                                                                         |
| `clearAllData`        | `POST /api/admin/clear-all`             | Requires `{ confirmation: "DELETE ALL DATA" }` in the body. Deletes all ImageKit files then drops all MongoDB documents from every collection. Logs the action with counts.                                     |

The private helper `deleteUserById(userId)` is shared by all three deletion endpoints. It:

1. Finds all `Media` records for the user.
2. Extracts `imagekitFileId` values from `cameraRecording` and `screenRecording`.
3. Calls `deleteFromStorage()` for each file ID (errors are swallowed to avoid failing the entire deletion if a file was already removed).
4. Runs `deleteMany` in parallel across: `Media`, `BehavioralFeature`, `AssessmentResponse`, `Consent`, `Baseline`, `Assessment`.
5. Deletes the `User` document last.
6. Returns per-collection deleted counts.

---

### Routes

Each route file creates an Express `Router`, wires handler functions to HTTP method + path pairs, and exports the router. `server.js` mounts them at their prefix.

| File                  | Prefix             | Key routes                                                                                                                                                                                                                                                      |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userRoutes.js`       | `/api/users`       | `POST /register`, `GET /`, `GET /:userId`                                                                                                                                                                                                                       |
| `consentRoutes.js`    | `/api/consent`     | `POST /`, `GET /:consentId`                                                                                                                                                                                                                                     |
| `assessmentRoutes.js` | `/api/assessments` | `POST /start`, `POST /:id/complete`, `GET /user/:userId`, `GET /:id`                                                                                                                                                                                            |
| `responseRoutes.js`   | `/api/responses`   | `POST /`, `GET /:assessmentId`                                                                                                                                                                                                                                  |
| `mediaRoutes.js`      | `/api/media`       | `POST /upload` (Multer memory storage, 200 MB limit), `GET /:assessmentId`                                                                                                                                                                                      |
| `baselineRoutes.js`   | `/api/baselines`   | `GET /:userId`                                                                                                                                                                                                                                                  |
| `adminRoutes.js`      | `/api/admin`       | Public: `POST /login`. Protected (adminAuth applied to everything after): `POST /logout`, `GET /profile`, `GET /overview`, `GET /users`, `GET /users/:userId/details`, `GET /export`, `DELETE /users/:userId`, `POST /users/delete-selected`, `POST /clear-all` |

`adminRoutes.js` applies `adminAuth` middleware via `router.use(adminAuth)` after the `/login` route, ensuring every subsequent route definition in the file is automatically protected.

---

### Middleware

#### `backend/middleware/adminAuth.js`

Exports:

- `adminAuth(req, res, next)` — reads the `Authorization: Bearer <token>` header, calls `jwt.verify()` with `JWT_SECRET`, and attaches the decoded payload (`{ adminId }`) to `req.admin`. Returns 401 if the header is missing, the token is malformed, or the token is expired.
- `JWT_SECRET` — the signing secret (re-exported so `adminController.js` can sign tokens with the same value without duplicating the env-var read).

#### `backend/middleware/errorMiddleware.js`

- `notFound(req, res, next)` — sets status 404 and forwards an error with the unmatched URL. Mounted after all routes.
- `errorHandler(err, req, res, next)` — global error handler. Reads `res.statusCode` (set by controllers before throwing) and serialises `{ message, stack }` to JSON. Stack trace is omitted in production.

---

### Services

#### `backend/services/baselineService.js`

Pure business-logic module; has no HTTP awareness and is called directly by `assessmentController.js`.

**`updateBaselineAfterAssessment({ userId, assessmentType, featureVector })`**

Reads the existing `Baseline` document (or creates one), increments `sampleCount`, and recalculates nine running averages using the formula `(prevAvg × prevCount + newValue) / (prevCount + 1)`. The private `pick(vector, paths)` helper extracts a metric from the feature vector by trying multiple dot-notation paths (different assessment types nest metrics slightly differently). Saves and returns the updated baseline.

**`compareAgainstBaseline({ userId, assessmentType, featureVector })`**

If a baseline with at least one sample exists, computes the percentage deviation of each metric from its baseline average: `((current − baseline) / baseline) × 100`. Returns `{ hasBaseline: true, deviations: { metricName: { baseline, current, percentChange } } }` or `{ hasBaseline: false, deviations: null }` for first-time participants.

Both functions are called inside `completeAssessment`: comparison happens first (before the new session pollutes the baseline), then `update` is called.

---

## Frontend — File Reference

### Entry Point & Root

#### `frontend/index.html`

Standard Vite HTML shell. Contains `<div id="root">` where React mounts.

#### `frontend/src/main.jsx`

Bootstraps the React application:

```
<React.StrictMode>
  <BrowserRouter>          ← React Router context
    <SessionProvider>      ← participant session state
      <App />
    </SessionProvider>
  </BrowserRouter>
</React.StrictMode>
```

Imports `index.css` (Tailwind directives + CSS custom properties for the design system).

#### `frontend/src/App.jsx`

Defines all client-side routes and wraps everything in `<AdminProvider>`:

```
<AdminProvider>
  <Routes>
    /                     → RegisterPage        (public)
    /consent/:type        → ConsentPage         (public)
    /hub                  → HubPage             (public, checks session)
    /assessment/mcq       → McqAssessmentPage   (public, checks session)
    /assessment/coding    → CodingAssessmentPage
    /assessment/typing    → TypingAssessmentPage
    /complete             → CompletePage

    /admin/login          → AdminLoginPage      (public)
    /admin                → AdminDashboardPage  (RequireAdmin guard)
    /admin/users/:userId  → AdminUserDetailPage (RequireAdmin guard)

    *                     → Navigate to /
  </Routes>
</AdminProvider>
```

`RequireAdmin` wraps the two protected admin routes. Participant routes do not use `RequireAdmin`; they perform their own soft redirects (e.g., `if (!user) navigate("/")`).

---

### Context Providers

#### `frontend/src/context/SessionContext.jsx`

Manages participant identity across the assessment flow. Persists the user object in `localStorage` so a page refresh doesn't log the participant out mid-assessment.

Exports `SessionProvider` and the `useSession()` hook.

State: `user` (the registered participant object), `consent` (the active consent document for the current assessment type).

Methods:

- `loginUser(userObj)` — stores the user in state and localStorage.
- `logout()` — clears state and localStorage.
- `setConsent(consentObj)` — used by `ConsentPage` to pass the created consent ID to the assessment page.

**Used by:** `RegisterPage`, `ConsentPage`, `HubPage`, all three assessment pages.

#### `frontend/src/context/AdminContext.jsx`

Manages administrator authentication state. Stores the JWT in `sessionStorage` (cleared when the browser tab closes, limiting exposure if the tab is left open).

Exports `AdminProvider` and the `useAdmin()` hook.

State: `token` (JWT string), `adminId` (admin identifier from the login response), `isAdminAuthenticated` (boolean).

Methods:

- `loginAdmin(token, adminId)` — writes to sessionStorage and state.
- `logoutAdmin()` — clears sessionStorage and state.

**Used by:** `App.jsx`, `RequireAdmin`, `AdminLoginPage`, `AdminDashboardPage`.

---

### API Client

#### `frontend/src/api/client.js`

Creates and exports a single Axios instance configured with `VITE_API_BASE_URL` as its `baseURL`.

An Axios request interceptor runs before every outgoing call:

```js
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("abeis_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

This means all pages — including assessment pages — automatically include the admin JWT if one is present. Admin-only endpoints reject requests that lack a valid token at the middleware level regardless; the interceptor just ensures the header is always there when it exists.

**Imported by:** every page and the `useMediaRecording` hook.

---

### Pages

#### `frontend/src/pages/RegisterPage.jsx`

**Route:** `/`

The platform landing page. Renders two primary call-to-action buttons:

- **Start Assessment** — scrolls to the registration form.
- **Admin Login** — navigates to `/admin/login`.

The registration form collects `name` and `email`, posts to `POST /api/users/register`, and on success calls `loginUser()` and navigates to `/hub`.

#### `frontend/src/pages/ConsentPage.jsx`

**Route:** `/consent/:assessmentType`

Two-phase page:

1. **Permission phase** — renders a "Check Permissions" button that calls `media.requestPermissions()` (from `useMediaRecording`). Both camera and screen permissions must be `"granted"` to proceed.
2. **Consent phase** — renders the 8 consent statements as checkboxes. All must be checked and both permissions must be granted before the "Begin Assessment" button is enabled.

On submit, posts to `POST /api/consent` with the permission statuses, browser info, and acknowledged statements. Stores the returned consent object in `SessionContext` via `setConsent()`, then navigates to the assessment page for the chosen type.

**Uses:** `useSession`, `useMediaRecording`.

#### `frontend/src/pages/HubPage.jsx`

**Route:** `/hub`

Shows the logged-in participant's name and three assessment cards (MCQ, Coding, Typing). Clicking a card navigates to `/consent/:assessmentType`. If no user is in session, immediately redirects to `/`.

#### `frontend/src/pages/McqAssessmentPage.jsx`

**Route:** `/assessment/mcq`

Starts an assessment session (`POST /api/assessments/start`) on mount, then presents 5 multiple-choice questions one at a time. Tracks per-question response time. Attaches mouse, keyboard, and session tracking hooks for the full duration. On "Submit":

1. Posts answers to `POST /api/responses`.
2. Calls `assessment.completeAssessment()` with the aggregated feature vector from all three tracking hooks.
3. Navigates to `/complete`.

Does not use `useMediaRecording` directly — recordings are started on the consent page and uploaded from there (upload is triggered on stop by the hook itself, called from the assessment page's `useEffect` cleanup).

#### `frontend/src/pages/CodingAssessmentPage.jsx`

**Route:** `/assessment/coding`

Two-question structure: (1) an independent coding problem (write from scratch), and (2) a transcription task (copy a provided solution exactly). Measures `backspaceCount`, `copyPasteAttempts`, and `corrections` per question. Otherwise the same start/track/submit pattern as MCQ.

#### `frontend/src/pages/TypingAssessmentPage.jsx`

**Route:** `/assessment/typing`

Two tasks: (1) type a plain prose paragraph, (2) type a paragraph dense with numbers and symbols. Computes `wpm` and `accuracy` in real time. Records per-task `sourceText`, `typedText`, and timing.

#### `frontend/src/pages/CompletePage.jsx`

**Route:** `/complete`

Simple confirmation screen shown after a successful assessment submission.

#### `frontend/src/pages/AdminLoginPage.jsx`

**Route:** `/admin/login`

Renders a login form with Admin ID and Password fields. Posts to `POST /api/admin/login`. On success, calls `loginAdmin(token, adminId)` from `AdminContext` and navigates to `/admin`. Displays `"Invalid Admin ID or Password."` on a 401. Includes a "← Back to Landing Page" link.

#### `frontend/src/pages/AdminDashboardPage.jsx`

**Route:** `/admin` (protected by `RequireAdmin`)

The main research control panel. Key features:

- **Header** — displays the signed-in `adminId`, Export CSV / Export JSON buttons, a Clear Dataset button, and a Logout button.
- **Overview cards** — registered users, total assessments, completed assessments, breakdown by type (fetched from `GET /api/admin/overview`).
- **Advanced filter bar** — search text, assessment type dropdown, calibration filter, final assessment filter, date-from and date-to date pickers. Submitting the form re-fetches `GET /api/admin/users` with the active query parameters.
- **User table** — columns: checkbox, User ID, Name, Email, Registration Date, Total Assessments, Calibration (Yes/No badge), Final Assessment (Yes/No badge), Last Assessment Date, Actions (View / Delete). Supports select-all.
- **Bulk delete** — once one or more checkboxes are selected, a "Delete Selected" banner appears. Clicking it opens a confirmation modal.
- **Delete single** — clicking "Delete" in a row opens a confirmation modal listing all data types that will be removed.
- **Clear Dataset** — opens a modal requiring the administrator to type `DELETE ALL DATA` before proceeding.
- **Export** — uses `fetch` with the `Authorization` header (since `window.open` cannot set headers) to download the file as a blob and trigger a browser save dialog.

Logout calls `POST /api/admin/logout`, then `logoutAdmin()`, then navigates to `/admin/login`.

#### `frontend/src/pages/AdminUserDetailPage.jsx`

**Route:** `/admin/users/:userId` (protected by `RequireAdmin`)

Fetches `GET /api/admin/users/:userId/details` on mount and renders sections for: Baselines, Assessment History, Behavioral Features, Assessment Responses, Media Recordings, and Consent History. Includes a **Delete User** button in the header that opens the same 15-item confirmation dialog as the dashboard's single-delete flow. On confirmed deletion, navigates back to `/admin`.

---

### Hooks

#### `frontend/src/hooks/useMouseTracking.js`

Exports `useMouseTracking()`. Call `attach()` once in a `useEffect` to add DOM event listeners; call `getSummary()` at submission time to receive an aggregated `mouse` feature sub-object.

Tracks: `totalMovement`, `avgSpeed`, `maxSpeed`, `acceleration`, `clickFrequency`, `doubleClicks` (< 350 ms gap), `rightClicks`, `dragEvents`, `scrollEvents`, `scrollDistance`, `cursorSmoothness`. Raw positions are capped at 5 000 entries to bound memory usage.

#### `frontend/src/hooks/useKeyboardTracking.js`

Exports `useKeyboardTracking()`. Same `attach()` / `getSummary()` pattern.

Tracks: `avgKeyPressDuration`, `avgInterKeyLatency`, `typingRhythmVariance`, `keyFrequency` (per-key count map), `errorRate`, `backspaceCount`, `deleteCount`, `shiftUsageCount`, `ctrlComboCount`, `copyAttempts`, `pasteAttempts`.

#### `frontend/src/hooks/useSessionTracking.js`

Exports `useSessionTracking()`. Hooks into `visibilitychange`, `focus`, `blur`, `fullscreenchange`, and a periodic idle-check interval.

Tracks: `idleTimeMs`, `idlePeriodsCount`, `focusChanges`, `tabSwitches`, `fullscreenExits`, `sessionDurationMs`. Also captures static device/browser metadata (`browser`, `device`, `screenResolution`) and runs a network latency probe by timing a `HEAD` request to the API root.

#### `frontend/src/hooks/useMediaRecording.js`

Exports `useMediaRecording()`. Manages both `getUserMedia` (camera) and `getDisplayMedia` (screen).

Key methods:

- `requestPermissions()` — requests both streams and returns `{ camGranted, screenGranted }`. Used by `ConsentPage`.
- `startRecording()` — creates two `MediaRecorder` instances and starts them.
- `stopAndUpload({ assessmentId, userId, sessionId, assessmentType })` — stops both recorders, waits for the final `ondataavailable` events, assembles the blobs, and posts each to `POST /api/media/upload` as `multipart/form-data`. Returns media metadata.

Exposes `cameraPermission`, `screenPermission` state for the consent UI, and `previewStream` so `ConsentPage` can render a live camera preview.

---

### Components

#### `frontend/src/components/RequireAdmin.jsx`

A simple route-guard component. Reads `isAdminAuthenticated` from `AdminContext`. If false, redirects to `/admin/login` (preserving the attempted location in router state so a future enhancement could redirect back after login). If true, renders `{children}`.

**Used by:** `App.jsx`, wrapping `/admin` and `/admin/users/:userId` routes.

---

## Data Flow — End-to-End Walkthroughs

### 1. Participant Registration

```
RegisterPage
  └─ POST /api/users/register  { name, email }
       └─ userController.registerUser
            └─ User.findOne({ email }) → existing? return user
                                       → new?      User.create → 201
  └─ SessionContext.loginUser(user)   ← stored in localStorage
  └─ navigate("/hub")
```

### 2. Consent & Permission Grant

```
HubPage → navigate("/consent/mcq")

ConsentPage
  └─ useMediaRecording.requestPermissions()
       └─ getUserMedia({ video }) → cameraPermission = "granted"
       └─ getDisplayMedia({ video }) → screenPermission = "granted"
  └─ POST /api/consent  { userId, sessionId, acknowledgedStatements, permissions, browserInfo }
       └─ consentController.recordConsent
            └─ validates all 8 statements = true
            └─ validates both permissions = "granted"
            └─ Consent.create(...)  → consentId
  └─ SessionContext.setConsent(consentDoc)
  └─ navigate("/assessment/mcq")
```

### 3. Assessment Session

```
McqAssessmentPage (mounts)
  └─ POST /api/assessments/start  { userId, assessmentType, consentId }
       └─ assessmentController.startAssessment
            └─ Consent.findOne → valid?
            └─ Assessment.create({ status: "in_progress" })  → assessmentId

  [hooks attach to DOM]
  useMouseTracking.attach()
  useKeyboardTracking.attach()
  useSessionTracking.attach()
  useMediaRecording.startRecording()

  [participant answers questions]

McqAssessmentPage (submit)
  └─ POST /api/responses  { assessmentId, mcqResponses }
       └─ AssessmentResponse.findOneAndUpdate (upsert)

  └─ useMouseTracking.getSummary()   ┐
  └─ useKeyboardTracking.getSummary() ├─ merged into featureVector
  └─ useSessionTracking.getSummary() ┘

  └─ useMediaRecording.stopAndUpload(...)
       └─ POST /api/media/upload (camera blob)
            └─ imagekit.uploadToStorage → Media.findOneAndUpdate (upsert)
       └─ POST /api/media/upload (screen blob)
            └─ imagekit.uploadToStorage → Media.findOneAndUpdate (upsert)

  └─ POST /api/assessments/:id/complete  { featureVector }
       └─ assessmentController.completeAssessment
            └─ Assessment.save({ status: "completed", endedAt, duration })
            └─ BehavioralFeature.create({ featureVector })
            └─ baselineService.compareAgainstBaseline(...)  → deviation
            └─ baselineService.updateBaselineAfterAssessment(...)
            └─ return { assessment, behavioralFeature, deviation }

  └─ navigate("/complete")
```

### 4. Behavioral Data Submission

The feature vector flows from three hooks → assessment page → `POST /api/assessments/:id/complete` → `BehavioralFeature.create` → `baselineService`. The vector never touches `AssessmentResponse` (which stores answers, not signals) or `Media` (which stores recording URLs, not behavioral data). All three documents reference the same `assessmentId` and `userId`, making them joinable on demand.

### 5. Admin Login & Dashboard

```
AdminLoginPage
  └─ POST /api/admin/login  { adminId, password }
       └─ adminController.adminLogin
            └─ compare against ADMIN_ID / ADMIN_PASSWORD env vars
            └─ jwt.sign({ adminId }, JWT_SECRET, { expiresIn: "8h" })
            └─ return { token, adminId }
  └─ AdminContext.loginAdmin(token, adminId)  → sessionStorage
  └─ navigate("/admin")

AdminDashboardPage (mounts)
  └─ api.get("/admin/overview")          ← Authorization: Bearer <token>
  └─ api.get("/admin/users")
       └─ adminAuth middleware verifies JWT on every request
       └─ adminController.getOverview / getUsersWithSummary
```

The Axios interceptor in `client.js` reads the token from sessionStorage and injects `Authorization: Bearer <token>` automatically on every request. The `adminAuth` middleware on the backend verifies the token on every protected route without any further configuration needed in individual controllers.

### 6. Participant Deletion

```
AdminDashboardPage → click Delete → confirm dialog → DELETE /api/admin/users/:userId

adminController.deleteUser
  └─ User.findOne(userId) → 404 if not found
  └─ deleteUserById(userId):
       1. Media.find({ userId }) → all media records
       2. extract imagekitFileId from cameraRecording + screenRecording
       3. imagekit.deleteFile(fileId) × N  (errors swallowed)
       4. Media.deleteMany({ userId })
       5. BehavioralFeature.deleteMany({ userId })
       6. AssessmentResponse.deleteMany({ userId })
       7. Consent.deleteMany({ userId })
       8. Baseline.deleteMany({ userId })
       9. Assessment.deleteMany({ userId })
      10. User.deleteOne({ userId })
  └─ console.log audit entry (adminId, userId, counts, IP, timestamp)
  └─ 200 { message, deleted, counts }
```

---

## API Reference

### Participant APIs (public)

| Method | Path                            | Body / Query                                                                                                          | Response                                       |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| POST   | `/api/users/register`           | `{ name, email }`                                                                                                     | `{ user, isReturningUser }`                    |
| GET    | `/api/users/:userId`            | —                                                                                                                     | `User`                                         |
| POST   | `/api/consent`                  | `{ userId, sessionId, acknowledgedStatements, cameraPermissionStatus, screenRecordingPermissionStatus, browserInfo }` | `Consent`                                      |
| GET    | `/api/consent/:consentId`       | —                                                                                                                     | `Consent`                                      |
| POST   | `/api/assessments/start`        | `{ userId, assessmentType, consentId, meta? }`                                                                        | `Assessment`                                   |
| POST   | `/api/assessments/:id/complete` | `{ featureVector, rawEvents? }`                                                                                       | `{ assessment, behavioralFeature, deviation }` |
| GET    | `/api/assessments/user/:userId` | —                                                                                                                     | `Assessment[]`                                 |
| GET    | `/api/assessments/:id`          | —                                                                                                                     | `{ assessment, feature, response }`            |
| POST   | `/api/responses`                | `{ assessmentId, userId, sessionId, assessmentType, mcqResponses?, codingResponses?, typingResponses? }`              | `AssessmentResponse`                           |
| GET    | `/api/responses/:assessmentId`  | —                                                                                                                     | `AssessmentResponse`                           |
| POST   | `/api/media/upload`             | `multipart/form-data: file, assessmentId, userId, sessionId, assessmentType, recordingType, duration`                 | `{ media, recordingMeta }`                     |
| GET    | `/api/media/:assessmentId`      | —                                                                                                                     | `Media`                                        |
| GET    | `/api/baselines/:userId`        | —                                                                                                                     | `Baseline`                                     |

### Admin APIs (all except `/login` require `Authorization: Bearer <token>`)

| Method | Path                               | Body / Query                                                                             | Response                                                                |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| POST   | `/api/admin/login`                 | `{ adminId, password }`                                                                  | `{ token, adminId }`                                                    |
| POST   | `/api/admin/logout`                | —                                                                                        | `{ message }`                                                           |
| GET    | `/api/admin/profile`               | —                                                                                        | `{ adminId }`                                                           |
| GET    | `/api/admin/overview`              | —                                                                                        | `{ userCount, assessmentCount, completedCount, byType }`                |
| GET    | `/api/admin/users`                 | `?search=&assessmentType=&calibration=yes\|no&finalAssessment=yes\|no&dateFrom=&dateTo=` | `UserSummary[]`                                                         |
| GET    | `/api/admin/users/:userId/details` | —                                                                                        | `{ user, assessments, features, responses, media, baseline, consents }` |
| GET    | `/api/admin/export`                | `?format=csv\|json&assessmentType=`                                                      | File download                                                           |
| DELETE | `/api/admin/users/:userId`         | —                                                                                        | `{ message, deleted, counts }`                                          |
| POST   | `/api/admin/users/delete-selected` | `{ userIds: string[] }`                                                                  | `{ message, deleted, counts }`                                          |
| POST   | `/api/admin/clear-all`             | `{ confirmation: "DELETE ALL DATA" }`                                                    | `{ message, counts }`                                                   |

---

## MongoDB Collections

| Collection            | Model file              | Primary index                                           | Notes                                                  |
| --------------------- | ----------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `users`               | `User.js`               | `userId`, `email`                                       | One document per participant                           |
| `consents`            | `Consent.js`            | `consentId`, `userId`, `sessionId`                      | One per consent event; multiple per participant        |
| `assessments`         | `Assessment.js`         | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment session                             |
| `behavioralfeatures`  | `BehavioralFeature.js`  | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per completed assessment                           |
| `assessmentresponses` | `AssessmentResponse.js` | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment (upserted)                          |
| `media`               | `Media.js`              | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment (upserted); holds ImageKit metadata |
| `baselines`           | `Baseline.js`           | `userId` (unique)                                       | One per participant; updated after every assessment    |

All collections use `userId` as the common foreign key, making cross-collection joins and deletion straightforward without relational constraints.

---

## Security Model

### Admin authentication

- Credentials (`ADMIN_ID`, `ADMIN_PASSWORD`) are stored exclusively in server-side environment variables. They are never sent to the client or referenced in any frontend file.
- The backend validates credentials on every login request and signs a short-lived JWT (8 hours) with `JWT_SECRET`.
- The JWT is stored in browser `sessionStorage` — it is cleared automatically when the tab closes and is not accessible to other origins.
- Every protected admin route verifies the JWT in `adminAuth` middleware before any controller logic runs. A missing or invalid token returns `401 Unauthorized`.

### Audit log

Every destructive admin action logs a structured entry to the server console:

```
[ADMIN_DELETE] adminId=ADMIN001 deletedUser=<uuid> counts={...} ip=::1 ts=2025-01-01T00:00:00.000Z
```

Log entries include: event type, admin ID, affected user IDs, per-collection record counts, IP address, and ISO timestamp.

### Rate limiting

All `/api` routes are rate-limited to 1 000 requests per 15-minute window per IP (configurable in `server.js`).

### CORS

The `cors` middleware is configured with `credentials: true` and an explicit `origin` set to `FRONTEND_URL`. In production this should be set to the exact frontend domain, not `*`.

### Future hardening

The authentication system is designed to be upgraded to multi-admin support by replacing the env-var comparison in `adminController.adminLogin` with a lookup against an `admins` MongoDB collection (bcrypt-hashed passwords, RBAC roles) without requiring changes to the JWT issuance logic, middleware, or protected routes.

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build          # outputs to dist/
# Push to GitHub, connect repo in Vercel
# Set environment variable: VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

### Backend → Render

Create a Web Service pointing to the `backend/` directory with start command `node server.js`. Set these environment variables in the Render dashboard:

```
MONGODB_URI          = mongodb+srv://...
IMAGEKIT_PUBLIC_KEY  = ...
IMAGEKIT_PRIVATE_KEY = ...
IMAGEKIT_URL_ENDPOINT = https://ik.imagekit.io/...
FRONTEND_URL         = https://your-app.vercel.app
NODE_ENV             = production
ADMIN_ID             = (choose a strong ID)
ADMIN_PASSWORD       = (choose a strong password)
JWT_SECRET           = (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
PRIVACY_POLICY_VERSION = 1.0.0
```

### Storage abstraction

Media uploads and deletions go through `backend/config/imagekit.js` (`uploadToStorage` / `deleteFromStorage`). To swap ImageKit for AWS S3 or Azure Blob Storage in production, reimplement only those two functions — no controller code needs to change.

---

## Known Limitations & Future Hardening

- **Question bank** — MCQ questions, coding prompts, and typing passages are hardcoded sample content in the assessment page files. Wire these to a CMS or a `questions` MongoDB collection to make them configurable without a code deploy.
- **Camera-based signals** — `camera.lookingAwayCount` and `faceDetectionStatus` fields exist in the `BehavioralFeature` schema but are not populated. Real-time face-detection (TensorFlow.js / MediaPipe) can be added inside `useMediaRecording` as a future enhancement.
- **Raw event storage** — `BehavioralFeature.rawEvents` can grow large for long sessions. Consider adding a TTL index, moving raw events to cold storage after a configurable retention period, or streaming events to the backend incrementally instead of batching on submit.
- **Participant auth** — participants are identified only by email lookup (no password, token, or magic link). Before exposing this platform to any real-world population, add a session token or email-verified magic link so participants cannot impersonate each other.
- **Single admin** — the current system supports exactly one administrator via env vars. Upgrade to a MongoDB-backed `admins` collection with bcrypt and RBAC when multiple researchers need independent access.
- **Admin JWT revocation** — JWTs are stateless; a logged-out token remains valid until expiry (8 hours). For stricter security, maintain a server-side deny-list or switch to shorter-lived tokens with refresh.
- **Media size limits** — Multer is configured to accept up to 200 MB per upload. Tune this limit or implement chunked uploads for longer recording sessions. -->

<!-- # ABEIS — Automated Behavioral & Engagement Intelligence System

A full-stack research platform that registers participants, captures explicit informed consent, records webcam and screen video, and collects rich behavioral telemetry (mouse, keyboard, session signals) across three assessment types — MCQ, Coding, and Typing — to build per-user behavioral baselines for longitudinal comparison. A background feature-extraction pipeline turns the raw webcam/screen recordings into AI-derived behavioral signals (face, gaze, head pose, mouse/scroll dynamics). A fully authenticated Admin Dashboard lets researchers search, inspect, export, and permanently delete participant data, and export a single unified JSON/CSV dataset combining all of the above for baseline generation and ML training.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Repository Structure](#repository-structure)
3. [Technology Stack](#technology-stack)
4. [Environment Variables](#environment-variables)
5. [Quick Start](#quick-start)
6. [Backend — File Reference](#backend--file-reference)
   - [Entry Point](#entry-point)
   - [Configuration](#configuration)
   - [Models](#models)
   - [Controllers](#controllers)
   - [Routes](#routes)
   - [Middleware](#middleware)
   - [Services](#services)
7. [Frontend — File Reference](#frontend--file-reference)
   - [Entry Point & Root](#entry-point--root)
   - [Context Providers](#context-providers)
   - [API Client](#api-client)
   - [Pages](#pages)
   - [Hooks](#hooks)
   - [Components](#components)
8. [Data Flow — End-to-End Walkthroughs](#data-flow--end-to-end-walkthroughs)
   - [Participant Registration](#1-participant-registration)
   - [Consent & Permission Grant](#2-consent--permission-grant)
   - [Assessment Session](#3-assessment-session)
   - [Behavioral Data Submission](#4-behavioral-data-submission)
   - [Admin Login & Dashboard](#5-admin-login--dashboard)
   - [Participant Deletion](#6-participant-deletion)
9. [API Reference](#api-reference)
10. [MongoDB Collections](#mongodb-collections)
11. [Behavioral Feature Extraction Pipeline (Webcam & Screen AI Features)](#behavioral-feature-extraction-pipeline-webcam--screen-ai-features)
    - [Pipeline Consistency Guarantee](#pipeline-consistency-guarantee)
    - [Webcam Features](#webcam-features)
    - [Screen Features](#screen-features)
    - [Historical Recordings: Incremental Upgrade](#historical-recordings-incremental-upgrade)
    - [Automatic Extraction for Future Assessments](#automatic-extraction-for-future-assessments)
    - [Schema & Forward Compatibility](#schema--forward-compatibility)
    - [Performance Notes](#performance-notes)
    - [Testing Performed](#testing-performed)
12. [Export Pipeline (Unified JSON / CSV Dataset)](#export-pipeline-unified-json--csv-dataset)
13. [Baseline Generation Workflow](#baseline-generation-workflow)
14. [Security Model](#security-model)
15. [Deployment](#deployment)
16. [Known Limitations & Future Hardening](#known-limitations--future-hardening)

---

## Architecture Overview

```
Browser (React + Vite)
        │
        │  HTTP / multipart
        ▼
Express API (Node.js)
        │                        │                     │
        │  Mongoose ODM           │  ImageKit SDK        │  Job Queue
        ▼                        ▼                     ▼
  MongoDB Atlas            ImageKit Cloud       Python Worker
  (structured data)        (video recordings)   (MediaPipe / OpenCV
                                                  feature extraction)
```

The frontend is a single-page React application. Every state-changing action hits a REST endpoint on the Express backend. Recordings (webcam, screen) are the only binary data; they are streamed directly from the browser's `MediaRecorder` to the backend, which forwards them to ImageKit. Only the resulting metadata (URL, file ID, size) is stored in MongoDB.

Once an assessment completes, its webcam and screen recordings are also enqueued for asynchronous AI feature extraction: a Node-side job queue downloads both recordings and hands them to a Python worker (MediaPipe for webcam, OpenCV optical flow for screen), which returns a numerical feature vector that is written to its own collection, independent of and additive to the client-captured `BehavioralFeature` document.

The Admin Dashboard is entirely separate from the participant flow. It is protected by a JWT issued by the backend on successful admin login. No admin credential ever reaches the browser's JavaScript bundle.

---

## Repository Structure

```
abeis/
├── backend/
│   ├── server.js                     # Express app entry point
│   ├── package.json
│   ├── .env.example
│   ├── config/
│   │   ├── db.js                     # MongoDB connection
│   │   ├── imagekit.js               # ImageKit upload/delete abstraction
│   │   └── featureSchema.js          # Canonical AI feature field lists + normalize/isMissingFields helpers
│   ├── models/
│   │   ├── User.js
│   │   ├── Consent.js
│   │   ├── Assessment.js
│   │   ├── BehavioralFeature.js
│   │   ├── AssessmentResponse.js
│   │   ├── Media.js
│   │   ├── Baseline.js
│   │   └── ExtractedBehaviorFeature.js   # AI-derived webcam/screen feature vectors
│   ├── controllers/
│   │   ├── userController.js
│   │   ├── consentController.js
│   │   ├── assessmentController.js
│   │   ├── responseController.js
│   │   ├── mediaController.js
│   │   ├── baselineController.js
│   │   └── adminController.js
│   ├── routes/
│   │   ├── userRoutes.js
│   │   ├── consentRoutes.js
│   │   ├── assessmentRoutes.js
│   │   ├── responseRoutes.js
│   │   ├── mediaRoutes.js
│   │   ├── baselineRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── adminAuth.js              # JWT verification middleware
│   │   └── errorMiddleware.js        # 404 + error handler
│   ├── services/
│   │   ├── baselineService.js        # Running-average baseline engine
│   │   ├── featureExtractionService.js  # Stage logging, enqueueExtraction/enqueueAndWait/enqueueIncrementalUpgrade, merge logic
│   │   └── exportService.js          # Builds the unified export dataset
│   └── scripts/
│       └── backfillExtraction.js     # Historical full/incremental/skip decision + progress reporting
│
├── python-worker/
│   ├── requirements.txt              # mediapipe version pin is load-bearing — documented here
│   ├── webcam_features.py            # MediaPipe Face Mesh + Face Detection analyzer
│   ├── screen_features.py            # OpenCV optical-flow analyzer
│   └── utils/
│       └── ear.py                    # BlinkTracker (eye-aspect-ratio based blink detection)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    ├── .env.example
    └── src/
        ├── main.jsx                  # React entry point
        ├── App.jsx                   # Route definitions + AdminProvider
        ├── index.css                 # Tailwind + global CSS vars
        ├── api/
        │   └── client.js             # Axios instance + JWT interceptor
        ├── context/
        │   ├── SessionContext.jsx    # Participant session state
        │   └── AdminContext.jsx      # Admin auth state (JWT)
        ├── components/
        │   └── RequireAdmin.jsx      # Route guard for admin pages
        ├── hooks/
        │   ├── useMouseTracking.js
        │   ├── useKeyboardTracking.js
        │   ├── useSessionTracking.js
        │   └── useMediaRecording.js
        └── pages/
            ├── RegisterPage.jsx      # Landing + participant registration
            ├── ConsentPage.jsx       # Informed consent + permission grant
            ├── HubPage.jsx           # Assessment selection hub
            ├── McqAssessmentPage.jsx
            ├── CodingAssessmentPage.jsx
            ├── TypingAssessmentPage.jsx
            ├── CompletePage.jsx
            ├── AdminLoginPage.jsx
            ├── AdminDashboardPage.jsx
            └── AdminUserDetailPage.jsx
```

---

## Technology Stack

| Layer                 | Technology                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| Frontend framework    | React 18 + Vite                                                                |
| Styling               | Tailwind CSS                                                                   |
| Routing               | React Router v6                                                                |
| HTTP client           | Axios                                                                          |
| Backend framework     | Express 4                                                                      |
| Database              | MongoDB (via Mongoose 8)                                                       |
| Media storage         | ImageKit                                                                       |
| Auth tokens           | JSON Web Tokens (jsonwebtoken)                                                 |
| File upload (backend) | Multer (memory storage)                                                        |
| CSV export            | json2csv                                                                       |
| ID generation         | uuid v4                                                                        |
| Logging               | Morgan (HTTP) + stage-level pipeline logging                                   |
| Security headers      | Helmet                                                                         |
| Rate limiting         | express-rate-limit                                                             |
| AI feature extraction | Python worker — MediaPipe (Face Mesh + Face Detection) & OpenCV (optical flow) |
| Extraction job queue  | Node-side job queue (`featureExtractionService.js`)                            |

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/abeis

# ImageKit credentials
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# Allowed CORS origin (set to your frontend URL in production)
FRONTEND_URL=http://localhost:5173

# Privacy policy version stamped on every consent record
PRIVACY_POLICY_VERSION=1.0.0

# Admin credentials — never hardcode these in source
ADMIN_ID=ADMIN001
ADMIN_PASSWORD=ADMIN@001

# JWT signing secret — use a long random string in production
JWT_SECRET=change-this-to-a-long-random-secret

# Feature-extraction job queue concurrency
FEATURE_EXTRACTION_CONCURRENCY=2
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Python worker (`python-worker/requirements.txt`)

```
mediapipe==0.10.14   # PINNED — see "Testing Performed" below; do not upgrade without re-validating
opencv-python
numpy
```

---

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env        # fill in your credentials
npm install
npm run dev                  # nodemon — restarts on file changes
# API listening at http://localhost:5000
```

### Frontend

```bash
cd frontend
cp .env.example .env         # adjust VITE_API_BASE_URL if needed
npm install
npm run dev
# App at http://localhost:5173
```

### Python worker

```bash
cd python-worker
pip install -r requirements.txt   # respect the mediapipe pin
```

### Backfilling historical recordings (optional, one-time / as-needed)

```bash
cd backend
npm run backfill
```

Visit `http://localhost:5173` to start as a participant, or click **Admin Login** on the landing page and use the credentials set in your `.env` to access the Admin Dashboard.

---

## Backend — File Reference

### Entry Point

#### `backend/server.js`

The root of the Express application. Responsibilities:

- Loads `.env` via `dotenv`.
- Calls `connectDB()` to establish the MongoDB connection before the server starts.
- Applies global middleware in order: `helmet` (security headers), `cors` (restricted to `FRONTEND_URL`), `express.json` (10 MB limit for large feature vector payloads), `morgan` (request logging), and a `rateLimit` of 1 000 requests per 15-minute window on all `/api` routes.
- Mounts every route group under its path prefix (`/api/users`, `/api/consent`, etc.).
- Registers the `notFound` and `errorHandler` middleware last so they catch anything not matched by a route.
- Starts the HTTP server on `process.env.PORT` (default 5000).

**Connections:** imports every route file; imports `connectDB` and `errorMiddleware`.

---

### Configuration

#### `backend/config/db.js`

Exports a single async function `connectDB()`. Calls `mongoose.connect()` with the `MONGODB_URI` env var and logs the connected host. Exits the process on failure so a misconfigured environment fails fast rather than serving 500s.

**Used by:** `server.js`.

#### `backend/config/imagekit.js`

Initialises the ImageKit SDK with the three ImageKit env vars and exports two wrapper functions:

- `uploadToStorage(fileBuffer, fileName, folder)` — uploads a `Buffer` to a given ImageKit folder and returns the full ImageKit response (including `fileId`, `url`, `name`, `size`).
- `deleteFromStorage(fileId)` — deletes a single file by its ImageKit file ID.

The abstraction keeps all ImageKit SDK calls in one place; replacing ImageKit with S3 or Azure Blob means reimplementing only these two functions without touching any controller.

**Used by:** `mediaController.js`, `adminController.js`, `featureExtractionService.js` (to download recordings for analysis).

#### `backend/config/featureSchema.js`

The single source of truth for what a "complete" AI-derived `webcamFeatures` / `screenFeatures` object contains. Exports:

- The canonical field lists for `webcamFeatures` and `screenFeatures` (v1 + v2 fields).
- `CURRENT_MODEL_VERSION` (currently `"v2.0"`).
- `normalizeFeatureObject()` — fills any field missing from a stored document with `null`, guaranteeing every canonical key is always present in reads (important because `.lean()` queries do not apply Mongoose schema defaults — see [Schema & Forward Compatibility](#schema--forward-compatibility)).
- `isMissingFields()` — used by the backfill script to decide whether an already-processed document needs an incremental upgrade.

**Used by:** `scripts/backfillExtraction.js`, `services/exportService.js`, and implicitly documents the shape backing `models/ExtractedBehaviorFeature.js`.

---

### Models

All models use Mongoose schemas. Every document that belongs to a participant references the participant by their `userId` string (a UUID v4), not by MongoDB's `_id`. This makes cross-collection queries straightforward and keeps the deletion logic consistent.

#### `backend/models/User.js`

Stores the participant's identity.

| Field                     | Type             | Notes                                |
| ------------------------- | ---------------- | ------------------------------------ |
| `userId`                  | String (UUID v4) | Auto-generated, unique, indexed      |
| `name`                    | String           | Required, trimmed                    |
| `email`                   | String           | Required, unique, lowercase, indexed |
| `createdAt` / `updatedAt` | Date             | Auto-managed by Mongoose timestamps  |

Registering with an existing email returns the existing record (idempotent register), enabling returning participants to build on their baseline without creating duplicate profiles.

#### `backend/models/Consent.js`

One document per consent event (a participant may consent multiple times across assessment types).

Key fields: `consentId` (UUID), `userId`, `sessionId`, `consentAccepted` (boolean), `acknowledgedStatements` (one boolean per the 8 required statements), `cameraPermissionStatus`, `screenRecordingPermissionStatus`, `browserInfo`, `privacyPolicyVersion`, `ipAddress`.

The consent record is the gate that `startAssessment` checks before creating an `Assessment` document. Both `cameraPermissionStatus` and `screenRecordingPermissionStatus` must equal `"granted"` or consent creation is rejected with a 403.

#### `backend/models/Assessment.js`

One document per assessment session.

Key fields: `assessmentId` (UUID), `userId`, `sessionId` (UUID shared with the consent for that session), `assessmentType` (`"mcq" | "coding" | "typing"`), `consentId`, `status` (`"in_progress" | "completed" | "abandoned"`), `startedAt`, `endedAt`, `duration` (seconds), `meta` (arbitrary config snapshot — which questions were served, etc.).

#### `backend/models/BehavioralFeature.js`

One document per completed assessment. Stores the aggregated **client-captured** feature vector and optionally the raw event log.

`featureVector` is a `Mixed` (schemaless) object. Its expected shape contains sub-objects:

```
mouse:    { totalMovement, avgSpeed, maxSpeed, acceleration, clickFrequency,
            doubleClicks, rightClicks, dragEvents, scrollEvents, scrollDistance,
            cursorSmoothness }

keyboard: { avgKeyPressDuration, avgInterKeyLatency, typingRhythmVariance,
            keyFrequency, errorRate, backspaceCount, deleteCount, shiftUsageCount,
            ctrlComboCount, copyAttempts, pasteAttempts }

session:  { idleTimeMs, idlePeriodsCount, focusChanges, tabSwitches,
            fullscreenExits, avgNetworkLatencyMs, browser, device,
            screenResolution, sessionDurationMs }

camera:   { cameraEnabled, lookingAwayCount, faceDetectionStatus }
screen:   { screenRecordingEnabled, recordingDurationMs }

typing:   { wpm, accuracy, errorCorrections }       ← typing assessments only
coding:   { copyPasteAttempts, backspaces, corrections }  ← coding assessments only
```

`rawEvents` optionally stores the full arrays of `mouseEvents`, `keyboardEvents`, and `sessionEvents` for deep re-analysis. These are capped client-side to keep payload sizes manageable.

> **Note:** this document's `camera`/`screen` sub-objects are self-reported client flags (was the camera enabled, was the recording started), not AI-derived measurements. The actual AI-derived webcam/screen signals — face detection quality, gaze, head pose, optical-flow mouse dynamics — live in the separate `ExtractedBehaviorFeature` document described below, produced by the Python feature-extraction pipeline rather than the browser.

#### `backend/models/AssessmentResponse.js`

One document per assessment — stores the actual answers given.

- `mcqResponses[]` — per-question: `questionId`, `selectedOption`, `correctOption`, `isCorrect`, `responseTimeMs`.
- `codingResponses[]` — per question (independent + transcription): `submittedCode`, `language`, `backspaceCount`, `correctionCount`, `copyPasteAttempts`, `matchesProvidedSolution`.
- `typingResponses[]` — per task (plain + symbol-heavy): `sourceText`, `typedText`, `wpm`, `accuracy`, `responseTimeMs`.

#### `backend/models/Media.js`

One document per assessment. Stores the metadata for both recordings after they have been uploaded to ImageKit.

Each of `cameraRecording` and `screenRecording` is an embedded sub-document containing: `imagekitFileId`, `imageUrl`, `fileName`, `size` (bytes), `duration` (seconds). The `imagekitFileId` is what `deleteFromStorage()` uses during deletion, and what `featureExtractionService` uses to download the recording for AI analysis.

#### `backend/models/Baseline.js`

One document per participant (unique on `userId`). Maintains a running average of nine behavioural metrics split by assessment type — `mcqBaseline`, `codingBaseline`, `typingBaseline` — each a sub-document with:

`sampleCount`, `avgResponseTimeMs`, `avgTypingSpeedWpm`, `avgMouseSpeed`, `avgClickFrequency`, `avgKeyLatencyMs`, `avgScrollDistance`, `avgIdleDurationMs`, `avgBackspaceCount`, `avgFocusChanges`, `lastUpdatedAt`, `lastFeatureVector` (full snapshot of the most recent assessment's vector).

#### `backend/models/ExtractedBehaviorFeature.js`

One document per assessment, linked by `assessmentId` / `userId` / `sessionId` / `assessmentType`, holding the **AI-derived** feature vectors computed by the Python worker from the webcam and screen recordings. Populated asynchronously after `completeAssessment` enqueues extraction (see [Behavioral Feature Extraction Pipeline](#behavioral-feature-extraction-pipeline-webcam--screen-ai-features)).

Top-level shape:

```
status:   "pending" | "completed" | "failed"
lastError: string | null           # populated only when status === "failed"
webcamFeatures: { ...see below }
screenFeatures: { ...see below }
metadata: { modelVersion: "v1.0" | "v2.0", processedAt, ... }
```

Both `webcamFeaturesSchema` and `screenFeaturesSchema` are `strict: false` (a field present in a document but not yet known to the currently-deployed schema version passes through untouched — forward compatible with a future v3), and every individual field defaults to `null` rather than being required, since not every recording will contain a usable signal for every metric (e.g. no face in frame at all).

**Used by:** `featureExtractionService.js` (writes), `exportService.js` (reads, via `.lean()` + `normalizeFeatureObject()`), `adminController.getUserDetails` (drill-down view).

---

### Controllers

Controllers are thin async handlers (using `express-async-handler` to avoid boilerplate try/catch). They read from the request, call models or services, and write the response.

#### `backend/controllers/userController.js`

| Function       | Route                      | Description                                                                                                                                                      |
| -------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerUser` | `POST /api/users/register` | Creates a new participant or returns an existing one (matched by email). Sets `isReturningUser` in the response so the frontend can show a personalised message. |
| `getUserById`  | `GET /api/users/:userId`   | Returns one participant by their UUID.                                                                                                                           |
| `listUsers`    | `GET /api/users`           | Returns all participants; supports a `search` query parameter that matches against `name`, `email`, or `userId` using case-insensitive regex.                    |

#### `backend/controllers/consentController.js`

| Function        | Route                         | Description                                                                                                                                                                                                                 |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recordConsent` | `POST /api/consent`           | Validates that all 8 `acknowledgedStatements` are `true` and that both permissions are `"granted"`, then creates a `Consent` document. Stamps the `privacyPolicyVersion` from the env var and the participant's IP address. |
| `getConsent`    | `GET /api/consent/:consentId` | Returns one consent record by ID.                                                                                                                                                                                           |

#### `backend/controllers/assessmentController.js`

| Function                | Route                                          | Description                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startAssessment`       | `POST /api/assessments/start`                  | Looks up the `consentId`, verifies `consentAccepted === true`, generates a `sessionId`, and creates an `Assessment` with `status: "in_progress"`.                                                                                                                                                                                                                         |
| `completeAssessment`    | `POST /api/assessments/:assessmentId/complete` | Marks the assessment completed, saves a `BehavioralFeature` document, runs `compareAgainstBaseline` to compute deviation, updates the baseline via `updateBaselineAfterAssessment`, and calls `featureExtractionService.enqueueExtraction()` to schedule AI feature extraction from the webcam/screen recordings. Returns `{ assessment, behavioralFeature, deviation }`. |
| `getAssessmentsForUser` | `GET /api/assessments/user/:userId`            | Lists all assessments for a user sorted newest-first.                                                                                                                                                                                                                                                                                                                     |
| `getAssessmentById`     | `GET /api/assessments/:assessmentId`           | Returns an assessment with its joined `BehavioralFeature` and `AssessmentResponse`.                                                                                                                                                                                                                                                                                       |

#### `backend/controllers/responseController.js`

| Function        | Route                              | Description                                                                                                                            |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `saveResponses` | `POST /api/responses`              | Upserts the `AssessmentResponse` document for a given `assessmentId`. Called by each assessment page just before `completeAssessment`. |
| `getResponses`  | `GET /api/responses/:assessmentId` | Returns the response document.                                                                                                         |

#### `backend/controllers/mediaController.js`

| Function                | Route                          | Description                                                                                                                                                                                     |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uploadRecording`       | `POST /api/media/upload`       | Receives a `multipart/form-data` upload (via Multer), calls `uploadToStorage()` to push the buffer to ImageKit, then upserts a `Media` document for the assessment with the resulting metadata. |
| `getMediaForAssessment` | `GET /api/media/:assessmentId` | Returns the media metadata document for an assessment.                                                                                                                                          |

#### `backend/controllers/baselineController.js`

| Function             | Route                        | Description                                                                                         |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `getBaselineForUser` | `GET /api/baselines/:userId` | Returns the participant's `Baseline` document, or 404 if they haven't completed any assessment yet. |

#### `backend/controllers/adminController.js`

The largest controller. All functions except `adminLogin` require the `adminAuth` middleware.

| Function              | Route                                   | Description                                                                                                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adminLogin`          | `POST /api/admin/login`                 | Compares `adminId` and `password` against `ADMIN_ID` / `ADMIN_PASSWORD` env vars. On success, signs an 8-hour JWT with `JWT_SECRET` and returns it. Logs the event with IP and timestamp.                                                                                                                                                 |
| `adminLogout`         | `POST /api/admin/logout`                | Logs the logout event. Token invalidation happens client-side (sessionStorage is cleared).                                                                                                                                                                                                                                                |
| `adminProfile`        | `GET /api/admin/profile`                | Returns `{ adminId }` from the JWT payload. Used by the dashboard to display the signed-in admin.                                                                                                                                                                                                                                         |
| `getOverview`         | `GET /api/admin/overview`               | Returns aggregate counts: total users, total assessments, completed assessments, and a breakdown by assessment type.                                                                                                                                                                                                                      |
| `getUsersWithSummary` | `GET /api/admin/users`                  | Returns all participants with computed summary fields. Supports query parameters: `search` (name / email / userId), `assessmentType`, `calibration` (yes/no), `finalAssessment` (yes/no), `dateFrom`, `dateTo`.                                                                                                                           |
| `getUserDetails`      | `GET /api/admin/users/:userId/details`  | Full drill-down for one participant: user profile, all assessments, all client-captured behavioral feature documents, all AI-extracted behavior feature documents, all responses, media metadata, baseline, and consent history.                                                                                                          |
| `exportDataset`       | `GET /api/admin/export`                 | Builds one unified row per assessment — joining user, assessment, media, client-captured behavioral features, AI-extracted webcam/screen features, and responses — via `exportService.js`. Responds as a downloadable CSV (`format=csv`) or JSON (`format=json`) file. See [Export Pipeline](#export-pipeline-unified-json--csv-dataset). |
| `deleteUser`          | `DELETE /api/admin/users/:userId`       | Runs the deletion sequence (see [Participant Deletion](#6-participant-deletion)) for one user and logs the action.                                                                                                                                                                                                                        |
| `deleteSelectedUsers` | `POST /api/admin/users/delete-selected` | Accepts `{ userIds: string[] }` and runs the deletion sequence for each user in series.                                                                                                                                                                                                                                                   |
| `clearAllData`        | `POST /api/admin/clear-all`             | Requires `{ confirmation: "DELETE ALL DATA" }` in the body. Deletes all ImageKit files then drops all MongoDB documents from every collection (including `extractedbehaviorfeatures`). Logs the action with counts.                                                                                                                       |

The private helper `deleteUserById(userId)` is shared by all three deletion endpoints. It:

1. Finds all `Media` records for the user.
2. Extracts `imagekitFileId` values from `cameraRecording` and `screenRecording`.
3. Calls `deleteFromStorage()` for each file ID (errors are swallowed to avoid failing the entire deletion if a file was already removed).
4. Runs `deleteMany` in parallel across: `Media`, `BehavioralFeature`, `ExtractedBehaviorFeature`, `AssessmentResponse`, `Consent`, `Baseline`, `Assessment`.
5. Deletes the `User` document last.
6. Returns per-collection deleted counts.

---

### Routes

Each route file creates an Express `Router`, wires handler functions to HTTP method + path pairs, and exports the router. `server.js` mounts them at their prefix.

| File                  | Prefix             | Key routes                                                                                                                                                                                                                                                      |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userRoutes.js`       | `/api/users`       | `POST /register`, `GET /`, `GET /:userId`                                                                                                                                                                                                                       |
| `consentRoutes.js`    | `/api/consent`     | `POST /`, `GET /:consentId`                                                                                                                                                                                                                                     |
| `assessmentRoutes.js` | `/api/assessments` | `POST /start`, `POST /:id/complete`, `GET /user/:userId`, `GET /:id`                                                                                                                                                                                            |
| `responseRoutes.js`   | `/api/responses`   | `POST /`, `GET /:assessmentId`                                                                                                                                                                                                                                  |
| `mediaRoutes.js`      | `/api/media`       | `POST /upload` (Multer memory storage, 200 MB limit), `GET /:assessmentId`                                                                                                                                                                                      |
| `baselineRoutes.js`   | `/api/baselines`   | `GET /:userId`                                                                                                                                                                                                                                                  |
| `adminRoutes.js`      | `/api/admin`       | Public: `POST /login`. Protected (adminAuth applied to everything after): `POST /logout`, `GET /profile`, `GET /overview`, `GET /users`, `GET /users/:userId/details`, `GET /export`, `DELETE /users/:userId`, `POST /users/delete-selected`, `POST /clear-all` |

`adminRoutes.js` applies `adminAuth` middleware via `router.use(adminAuth)` after the `/login` route, ensuring every subsequent route definition in the file is automatically protected.

---

### Middleware

#### `backend/middleware/adminAuth.js`

Exports:

- `adminAuth(req, res, next)` — reads the `Authorization: Bearer <token>` header, calls `jwt.verify()` with `JWT_SECRET`, and attaches the decoded payload (`{ adminId }`) to `req.admin`. Returns 401 if the header is missing, the token is malformed, or the token is expired.
- `JWT_SECRET` — the signing secret (re-exported so `adminController.js` can sign tokens with the same value without duplicating the env-var read).

#### `backend/middleware/errorMiddleware.js`

- `notFound(req, res, next)` — sets status 404 and forwards an error with the unmatched URL. Mounted after all routes.
- `errorHandler(err, req, res, next)` — global error handler. Reads `res.statusCode` (set by controllers before throwing) and serialises `{ message, stack }` to JSON. Stack trace is omitted in production.

---

### Services

#### `backend/services/baselineService.js`

Pure business-logic module; has no HTTP awareness and is called directly by `assessmentController.js`.

**`updateBaselineAfterAssessment({ userId, assessmentType, featureVector })`**

Reads the existing `Baseline` document (or creates one), increments `sampleCount`, and recalculates nine running averages using the formula `(prevAvg × prevCount + newValue) / (prevCount + 1)`. The private `pick(vector, paths)` helper extracts a metric from the feature vector by trying multiple dot-notation paths (different assessment types nest metrics slightly differently). Saves and returns the updated baseline.

**`compareAgainstBaseline({ userId, assessmentType, featureVector })`**

If a baseline with at least one sample exists, computes the percentage deviation of each metric from its baseline average: `((current − baseline) / baseline) × 100`. Returns `{ hasBaseline: true, deviations: { metricName: { baseline, current, percentChange } } }` or `{ hasBaseline: false, deviations: null }` for first-time participants.

Both functions are called inside `completeAssessment`: comparison happens first (before the new session pollutes the baseline), then `update` is called.

#### `backend/services/featureExtractionService.js`

Owns all AI feature-extraction logic. See [Behavioral Feature Extraction Pipeline](#behavioral-feature-extraction-pipeline-webcam--screen-ai-features) for full detail. Exports:

- `enqueueExtraction({ assessmentId })` — called by `completeAssessment` for live traffic.
- `enqueueAndWait({ assessmentId })` — called by the backfill script for assessments with no `ExtractedBehaviorFeature` document yet.
- `enqueueIncrementalUpgrade({ assessmentId })` — called by the backfill script for already-processed-but-outdated documents; re-runs the analyzer but preserves existing non-null field values.

All three resolve to the same private `_processAssessment()` function running on the same job queue — there is exactly one implementation of the extraction logic, shared by live and historical paths.

#### `backend/services/exportService.js`

Builds the unified per-assessment export row consumed by `GET /api/admin/export`. See [Export Pipeline](#export-pipeline-unified-json--csv-dataset).

---

## Frontend — File Reference

### Entry Point & Root

#### `frontend/index.html`

Standard Vite HTML shell. Contains `<div id="root">` where React mounts.

#### `frontend/src/main.jsx`

Bootstraps the React application:

```
<React.StrictMode>
  <BrowserRouter>          ← React Router context
    <SessionProvider>      ← participant session state
      <App />
    </SessionProvider>
  </BrowserRouter>
</React.StrictMode>
```

Imports `index.css` (Tailwind directives + CSS custom properties for the design system).

#### `frontend/src/App.jsx`

Defines all client-side routes and wraps everything in `<AdminProvider>`:

```
<AdminProvider>
  <Routes>
    /                     → RegisterPage        (public)
    /consent/:type        → ConsentPage         (public)
    /hub                  → HubPage             (public, checks session)
    /assessment/mcq       → McqAssessmentPage   (public, checks session)
    /assessment/coding    → CodingAssessmentPage
    /assessment/typing    → TypingAssessmentPage
    /complete             → CompletePage

    /admin/login          → AdminLoginPage      (public)
    /admin                → AdminDashboardPage  (RequireAdmin guard)
    /admin/users/:userId  → AdminUserDetailPage (RequireAdmin guard)

    *                     → Navigate to /
  </Routes>
</AdminProvider>
```

`RequireAdmin` wraps the two protected admin routes. Participant routes do not use `RequireAdmin`; they perform their own soft redirects (e.g., `if (!user) navigate("/")`).

---

### Context Providers

#### `frontend/src/context/SessionContext.jsx`

Manages participant identity across the assessment flow. Persists the user object in `localStorage` so a page refresh doesn't log the participant out mid-assessment.

Exports `SessionProvider` and the `useSession()` hook.

State: `user` (the registered participant object), `consent` (the active consent document for the current assessment type).

Methods:

- `loginUser(userObj)` — stores the user in state and localStorage.
- `logout()` — clears state and localStorage.
- `setConsent(consentObj)` — used by `ConsentPage` to pass the created consent ID to the assessment page.

**Used by:** `RegisterPage`, `ConsentPage`, `HubPage`, all three assessment pages.

#### `frontend/src/context/AdminContext.jsx`

Manages administrator authentication state. Stores the JWT in `sessionStorage` (cleared when the browser tab closes, limiting exposure if the tab is left open).

Exports `AdminProvider` and the `useAdmin()` hook.

State: `token` (JWT string), `adminId` (admin identifier from the login response), `isAdminAuthenticated` (boolean).

Methods:

- `loginAdmin(token, adminId)` — writes to sessionStorage and state.
- `logoutAdmin()` — clears sessionStorage and state.

**Used by:** `App.jsx`, `RequireAdmin`, `AdminLoginPage`, `AdminDashboardPage`.

---

### API Client

#### `frontend/src/api/client.js`

Creates and exports a single Axios instance configured with `VITE_API_BASE_URL` as its `baseURL`.

An Axios request interceptor runs before every outgoing call:

```js
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("abeis_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

This means all pages — including assessment pages — automatically include the admin JWT if one is present. Admin-only endpoints reject requests that lack a valid token at the middleware level regardless; the interceptor just ensures the header is always there when it exists.

**Imported by:** every page and the `useMediaRecording` hook.

---

### Pages

#### `frontend/src/pages/RegisterPage.jsx`

**Route:** `/`

The platform landing page. Renders two primary call-to-action buttons:

- **Start Assessment** — scrolls to the registration form.
- **Admin Login** — navigates to `/admin/login`.

The registration form collects `name` and `email`, posts to `POST /api/users/register`, and on success calls `loginUser()` and navigates to `/hub`.

#### `frontend/src/pages/ConsentPage.jsx`

**Route:** `/consent/:assessmentType`

Two-phase page:

1. **Permission phase** — renders a "Check Permissions" button that calls `media.requestPermissions()` (from `useMediaRecording`). Both camera and screen permissions must be `"granted"` to proceed.
2. **Consent phase** — renders the 8 consent statements as checkboxes. All must be checked and both permissions must be granted before the "Begin Assessment" button is enabled.

On submit, posts to `POST /api/consent` with the permission statuses, browser info, and acknowledged statements. Stores the returned consent object in `SessionContext` via `setConsent()`, then navigates to the assessment page for the chosen type.

**Uses:** `useSession`, `useMediaRecording`.

#### `frontend/src/pages/HubPage.jsx`

**Route:** `/hub`

Shows the logged-in participant's name and three assessment cards (MCQ, Coding, Typing). Clicking a card navigates to `/consent/:assessmentType`. If no user is in session, immediately redirects to `/`.

#### `frontend/src/pages/McqAssessmentPage.jsx`

**Route:** `/assessment/mcq`

Starts an assessment session (`POST /api/assessments/start`) on mount, then presents 5 multiple-choice questions one at a time. Tracks per-question response time. Attaches mouse, keyboard, and session tracking hooks for the full duration. On "Submit":

1. Posts answers to `POST /api/responses`.
2. Calls `assessment.completeAssessment()` with the aggregated feature vector from all three tracking hooks.
3. Navigates to `/complete`.

Does not use `useMediaRecording` directly — recordings are started on the consent page and uploaded from there (upload is triggered on stop by the hook itself, called from the assessment page's `useEffect` cleanup).

#### `frontend/src/pages/CodingAssessmentPage.jsx`

**Route:** `/assessment/coding`

Two-question structure: (1) an independent coding problem (write from scratch), and (2) a transcription task (copy a provided solution exactly). Measures `backspaceCount`, `copyPasteAttempts`, and `corrections` per question. Otherwise the same start/track/submit pattern as MCQ.

#### `frontend/src/pages/TypingAssessmentPage.jsx`

**Route:** `/assessment/typing`

Two tasks: (1) type a plain prose paragraph, (2) type a paragraph dense with numbers and symbols. Computes `wpm` and `accuracy` in real time. Records per-task `sourceText`, `typedText`, and timing.

#### `frontend/src/pages/CompletePage.jsx`

**Route:** `/complete`

Simple confirmation screen shown after a successful assessment submission.

#### `frontend/src/pages/AdminLoginPage.jsx`

**Route:** `/admin/login`

Renders a login form with Admin ID and Password fields. Posts to `POST /api/admin/login`. On success, calls `loginAdmin(token, adminId)` from `AdminContext` and navigates to `/admin`. Displays `"Invalid Admin ID or Password."` on a 401. Includes a "← Back to Landing Page" link.

#### `frontend/src/pages/AdminDashboardPage.jsx`

**Route:** `/admin` (protected by `RequireAdmin`)

The main research control panel. Key features:

- **Header** — displays the signed-in `adminId`, Export CSV / Export JSON buttons, a Clear Dataset button, and a Logout button.
- **Overview cards** — registered users, total assessments, completed assessments, breakdown by type (fetched from `GET /api/admin/overview`).
- **Advanced filter bar** — search text, assessment type dropdown, calibration filter, final assessment filter, date-from and date-to date pickers. Submitting the form re-fetches `GET /api/admin/users` with the active query parameters.
- **User table** — columns: checkbox, User ID, Name, Email, Registration Date, Total Assessments, Calibration (Yes/No badge), Final Assessment (Yes/No badge), Last Assessment Date, Actions (View / Delete). Supports select-all.
- **Bulk delete** — once one or more checkboxes are selected, a "Delete Selected" banner appears. Clicking it opens a confirmation modal.
- **Delete single** — clicking "Delete" in a row opens a confirmation modal listing all data types that will be removed.
- **Clear Dataset** — opens a modal requiring the administrator to type `DELETE ALL DATA` before proceeding.
- **Export** — uses `fetch` with the `Authorization` header (since `window.open` cannot set headers) to download the file as a blob and trigger a browser save dialog.

Logout calls `POST /api/admin/logout`, then `logoutAdmin()`, then navigates to `/admin/login`.

#### `frontend/src/pages/AdminUserDetailPage.jsx`

**Route:** `/admin/users/:userId` (protected by `RequireAdmin`)

Fetches `GET /api/admin/users/:userId/details` on mount and renders sections for: Baselines, Assessment History, Behavioral Features (client-captured), AI-Extracted Webcam/Screen Features, Assessment Responses, Media Recordings, and Consent History. Includes a **Delete User** button in the header that opens the same confirmation dialog as the dashboard's single-delete flow. On confirmed deletion, navigates back to `/admin`.

---

### Hooks

#### `frontend/src/hooks/useMouseTracking.js`

Exports `useMouseTracking()`. Call `attach()` once in a `useEffect` to add DOM event listeners; call `getSummary()` at submission time to receive an aggregated `mouse` feature sub-object.

Tracks: `totalMovement`, `avgSpeed`, `maxSpeed`, `acceleration`, `clickFrequency`, `doubleClicks` (< 350 ms gap), `rightClicks`, `dragEvents`, `scrollEvents`, `scrollDistance`, `cursorSmoothness`. Raw positions are capped at 5 000 entries to bound memory usage.

#### `frontend/src/hooks/useKeyboardTracking.js`

Exports `useKeyboardTracking()`. Same `attach()` / `getSummary()` pattern.

Tracks: `avgKeyPressDuration`, `avgInterKeyLatency`, `typingRhythmVariance`, `keyFrequency` (per-key count map), `errorRate`, `backspaceCount`, `deleteCount`, `shiftUsageCount`, `ctrlComboCount`, `copyAttempts`, `pasteAttempts`.

#### `frontend/src/hooks/useSessionTracking.js`

Exports `useSessionTracking()`. Hooks into `visibilitychange`, `focus`, `blur`, `fullscreenchange`, and a periodic idle-check interval.

Tracks: `idleTimeMs`, `idlePeriodsCount`, `focusChanges`, `tabSwitches`, `fullscreenExits`, `sessionDurationMs`. Also captures static device/browser metadata (`browser`, `device`, `screenResolution`) and runs a network latency probe by timing a `HEAD` request to the API root.

#### `frontend/src/hooks/useMediaRecording.js`

Exports `useMediaRecording()`. Manages both `getUserMedia` (camera) and `getDisplayMedia` (screen).

Key methods:

- `requestPermissions()` — requests both streams and returns `{ camGranted, screenGranted }`. Used by `ConsentPage`.
- `startRecording()` — creates two `MediaRecorder` instances and starts them.
- `stopAndUpload({ assessmentId, userId, sessionId, assessmentType })` — stops both recorders, waits for the final `ondataavailable` events, assembles the blobs, and posts each to `POST /api/media/upload` as `multipart/form-data`. Returns media metadata.

Exposes `cameraPermission`, `screenPermission` state for the consent UI, and `previewStream` so `ConsentPage` can render a live camera preview.

---

### Components

#### `frontend/src/components/RequireAdmin.jsx`

A simple route-guard component. Reads `isAdminAuthenticated` from `AdminContext`. If false, redirects to `/admin/login` (preserving the attempted location in router state so a future enhancement could redirect back after login). If true, renders `{children}`.

**Used by:** `App.jsx`, wrapping `/admin` and `/admin/users/:userId` routes.

---

## Data Flow — End-to-End Walkthroughs

### 1. Participant Registration

```
RegisterPage
  └─ POST /api/users/register  { name, email }
       └─ userController.registerUser
            └─ User.findOne({ email }) → existing? return user
                                       → new?      User.create → 201
  └─ SessionContext.loginUser(user)   ← stored in localStorage
  └─ navigate("/hub")
```

### 2. Consent & Permission Grant

```
HubPage → navigate("/consent/mcq")

ConsentPage
  └─ useMediaRecording.requestPermissions()
       └─ getUserMedia({ video }) → cameraPermission = "granted"
       └─ getDisplayMedia({ video }) → screenPermission = "granted"
  └─ POST /api/consent  { userId, sessionId, acknowledgedStatements, permissions, browserInfo }
       └─ consentController.recordConsent
            └─ validates all 8 statements = true
            └─ validates both permissions = "granted"
            └─ Consent.create(...)  → consentId
  └─ SessionContext.setConsent(consentDoc)
  └─ navigate("/assessment/mcq")
```

### 3. Assessment Session

```
McqAssessmentPage (mounts)
  └─ POST /api/assessments/start  { userId, assessmentType, consentId }
       └─ assessmentController.startAssessment
            └─ Consent.findOne → valid?
            └─ Assessment.create({ status: "in_progress" })  → assessmentId

  [hooks attach to DOM]
  useMouseTracking.attach()
  useKeyboardTracking.attach()
  useSessionTracking.attach()
  useMediaRecording.startRecording()

  [participant answers questions]

McqAssessmentPage (submit)
  └─ POST /api/responses  { assessmentId, mcqResponses }
       └─ AssessmentResponse.findOneAndUpdate (upsert)

  └─ useMouseTracking.getSummary()   ┐
  └─ useKeyboardTracking.getSummary() ├─ merged into featureVector
  └─ useSessionTracking.getSummary() ┘

  └─ useMediaRecording.stopAndUpload(...)
       └─ POST /api/media/upload (camera blob)
            └─ imagekit.uploadToStorage → Media.findOneAndUpdate (upsert)
       └─ POST /api/media/upload (screen blob)
            └─ imagekit.uploadToStorage → Media.findOneAndUpdate (upsert)

  └─ POST /api/assessments/:id/complete  { featureVector }
       └─ assessmentController.completeAssessment
            └─ Assessment.save({ status: "completed", endedAt, duration })
            └─ BehavioralFeature.create({ featureVector })
            └─ baselineService.compareAgainstBaseline(...)  → deviation
            └─ baselineService.updateBaselineAfterAssessment(...)
            └─ featureExtractionService.enqueueExtraction({ assessmentId })
                 └─ (async, off the request/response cycle) downloads
                    webcam + screen recordings in parallel, runs the
                    Python analyzers, writes ExtractedBehaviorFeature
            └─ return { assessment, behavioralFeature, deviation }

  └─ navigate("/complete")
```

### 4. Behavioral Data Submission

The client-captured feature vector flows from three hooks → assessment page → `POST /api/assessments/:id/complete` → `BehavioralFeature.create` → `baselineService`. The vector never touches `AssessmentResponse` (which stores answers, not signals) or `Media` (which stores recording URLs, not behavioral data). Separately and asynchronously, the same `completeAssessment` call enqueues AI feature extraction, which reads the `Media` document's recording URLs and writes an independent `ExtractedBehaviorFeature` document. All of these documents reference the same `assessmentId` and `userId`, making them joinable on demand — this is exactly what the export pipeline does.

### 5. Admin Login & Dashboard

```
AdminLoginPage
  └─ POST /api/admin/login  { adminId, password }
       └─ adminController.adminLogin
            └─ compare against ADMIN_ID / ADMIN_PASSWORD env vars
            └─ jwt.sign({ adminId }, JWT_SECRET, { expiresIn: "8h" })
            └─ return { token, adminId }
  └─ AdminContext.loginAdmin(token, adminId)  → sessionStorage
  └─ navigate("/admin")

AdminDashboardPage (mounts)
  └─ api.get("/admin/overview")          ← Authorization: Bearer <token>
  └─ api.get("/admin/users")
       └─ adminAuth middleware verifies JWT on every request
       └─ adminController.getOverview / getUsersWithSummary
```

The Axios interceptor in `client.js` reads the token from sessionStorage and injects `Authorization: Bearer <token>` automatically on every request. The `adminAuth` middleware on the backend verifies the token on every protected route without any further configuration needed in individual controllers.

### 6. Participant Deletion

```
AdminDashboardPage → click Delete → confirm dialog → DELETE /api/admin/users/:userId

adminController.deleteUser
  └─ User.findOne(userId) → 404 if not found
  └─ deleteUserById(userId):
       1. Media.find({ userId }) → all media records
       2. extract imagekitFileId from cameraRecording + screenRecording
       3. imagekit.deleteFile(fileId) × N  (errors swallowed)
       4. Media.deleteMany({ userId })
       5. BehavioralFeature.deleteMany({ userId })
       6. ExtractedBehaviorFeature.deleteMany({ userId })
       7. AssessmentResponse.deleteMany({ userId })
       8. Consent.deleteMany({ userId })
       9. Baseline.deleteMany({ userId })
      10. Assessment.deleteMany({ userId })
      11. User.deleteOne({ userId })
  └─ console.log audit entry (adminId, userId, counts, IP, timestamp)
  └─ 200 { message, deleted, counts }
```

---

## API Reference

### Participant APIs (public)

| Method | Path                            | Body / Query                                                                                                          | Response                                       |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| POST   | `/api/users/register`           | `{ name, email }`                                                                                                     | `{ user, isReturningUser }`                    |
| GET    | `/api/users/:userId`            | —                                                                                                                     | `User`                                         |
| POST   | `/api/consent`                  | `{ userId, sessionId, acknowledgedStatements, cameraPermissionStatus, screenRecordingPermissionStatus, browserInfo }` | `Consent`                                      |
| GET    | `/api/consent/:consentId`       | —                                                                                                                     | `Consent`                                      |
| POST   | `/api/assessments/start`        | `{ userId, assessmentType, consentId, meta? }`                                                                        | `Assessment`                                   |
| POST   | `/api/assessments/:id/complete` | `{ featureVector, rawEvents? }`                                                                                       | `{ assessment, behavioralFeature, deviation }` |
| GET    | `/api/assessments/user/:userId` | —                                                                                                                     | `Assessment[]`                                 |
| GET    | `/api/assessments/:id`          | —                                                                                                                     | `{ assessment, feature, response }`            |
| POST   | `/api/responses`                | `{ assessmentId, userId, sessionId, assessmentType, mcqResponses?, codingResponses?, typingResponses? }`              | `AssessmentResponse`                           |
| GET    | `/api/responses/:assessmentId`  | —                                                                                                                     | `AssessmentResponse`                           |
| POST   | `/api/media/upload`             | `multipart/form-data: file, assessmentId, userId, sessionId, assessmentType, recordingType, duration`                 | `{ media, recordingMeta }`                     |
| GET    | `/api/media/:assessmentId`      | —                                                                                                                     | `Media`                                        |
| GET    | `/api/baselines/:userId`        | —                                                                                                                     | `Baseline`                                     |

### Admin APIs (all except `/login` require `Authorization: Bearer <token>`)

| Method | Path                               | Body / Query                                                                             | Response                                                                                   |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/api/admin/login`                 | `{ adminId, password }`                                                                  | `{ token, adminId }`                                                                       |
| POST   | `/api/admin/logout`                | —                                                                                        | `{ message }`                                                                              |
| GET    | `/api/admin/profile`               | —                                                                                        | `{ adminId }`                                                                              |
| GET    | `/api/admin/overview`              | —                                                                                        | `{ userCount, assessmentCount, completedCount, byType }`                                   |
| GET    | `/api/admin/users`                 | `?search=&assessmentType=&calibration=yes\|no&finalAssessment=yes\|no&dateFrom=&dateTo=` | `UserSummary[]`                                                                            |
| GET    | `/api/admin/users/:userId/details` | —                                                                                        | `{ user, assessments, features, extractedFeatures, responses, media, baseline, consents }` |
| GET    | `/api/admin/export`                | `?format=csv\|json&assessmentType=`                                                      | File download (see [Export Pipeline](#export-pipeline-unified-json--csv-dataset))          |
| DELETE | `/api/admin/users/:userId`         | —                                                                                        | `{ message, deleted, counts }`                                                             |
| POST   | `/api/admin/users/delete-selected` | `{ userIds: string[] }`                                                                  | `{ message, deleted, counts }`                                                             |
| POST   | `/api/admin/clear-all`             | `{ confirmation: "DELETE ALL DATA" }`                                                    | `{ message, counts }`                                                                      |

---

## MongoDB Collections

| Collection                  | Model file                    | Primary index                                           | Notes                                                                                                             |
| --------------------------- | ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `users`                     | `User.js`                     | `userId`, `email`                                       | One document per participant                                                                                      |
| `consents`                  | `Consent.js`                  | `consentId`, `userId`, `sessionId`                      | One per consent event; multiple per participant                                                                   |
| `assessments`               | `Assessment.js`               | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment session                                                                                        |
| `behavioralfeatures`        | `BehavioralFeature.js`        | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per completed assessment; client-captured mouse/keyboard/session/typing/coding signals                        |
| `extractedbehaviorfeatures` | `ExtractedBehaviorFeature.js` | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment; AI-derived webcam/screen signals, populated asynchronously by the feature-extraction pipeline |
| `assessmentresponses`       | `AssessmentResponse.js`       | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment (upserted)                                                                                     |
| `media`                     | `Media.js`                    | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment (upserted); holds ImageKit metadata                                                            |
| `baselines`                 | `Baseline.js`                 | `userId` (unique)                                       | One per participant; updated after every assessment                                                               |

All collections use `userId` as the common foreign key, making cross-collection joins and deletion straightforward without relational constraints.

---

## Behavioral Feature Extraction Pipeline (Webcam & Screen AI Features)

Processes completed assessments' webcam and screen recordings into numerical behavioral feature vectors, stored in `ExtractedBehaviorFeatures`, linked by `assessmentId`/`userId`/`sessionId`/`assessmentType`, and folded into the unified export for baseline generation and ML training.

Current version adds 14 new webcam metrics and 11 new screen metrics on top of the original v1 set, an incremental backfill upgrade path that fills in missing fields on already-processed recordings without touching their existing values, and per-stage pipeline logging. Nothing in v1's public behavior (endpoints, collections, field names) was removed or renamed.

### Pipeline Consistency Guarantee

`enqueueExtraction` (called by `completeAssessment` for live traffic), `enqueueAndWait` (called by the backfill script for never-processed assessments), and `enqueueIncrementalUpgrade` (called by the backfill script for already-processed-but-outdated assessments) all resolve to the same private `_processAssessment()` function running on the same job queue instance — one webcam analyzer, one screen analyzer, one Mongo write path. There is no second implementation to drift out of sync.

**Logging.** `featureExtractionService._processAssessment()` logs each stage explicitly:

```
[extract:<assessmentId>] Assessment: starting full extraction
[extract:<assessmentId>] Downloading webcam recording: ✓ success
[extract:<assessmentId>] Downloading screen recording: ✓ success
[extract:<assessmentId>] Running webcam analyzer: ✓ success
[extract:<assessmentId>] Running screen analyzer: ✓ success
[extract:<assessmentId>] Parsing Python output: ✓ success
[extract:<assessmentId>] Saving features to MongoDB: ✓ success
```

On failure, the exact stage and exception message are logged (`✘ FAILED — <error message>`) and the document's `status` flips to `"failed"` with `lastError` populated — no error is ever swallowed silently; every catch block either logs-and-rethrows or is a deliberate "this recording legitimately has no camera track" skip, never a bare `catch {}`.

Both analyzers are invoked whenever their corresponding recording URL exists (not conditionally skipped for other reasons); a missing `Media` document or a `Media` document with neither URL fails loudly (`throw`, not a silent skip); and downloads/analyzer calls run in parallel (`Promise.all`) for both live and historical paths identically.

### Webcam Features

All new fields are computed inside the _same_ single-pass MediaPipe/OpenCV loop already being run — no second video pass, no additional heavy model.

| Group                     | Field                                                                                                                                                                         | What it measures                                                                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Face detection (existing) | `blinkRate`, `blinkCount`, `screenAttention`, `lookAwayCount`, `averagePitch`, `averageYaw`, `averageRoll`, `headMovementVariance`, `faceVisiblePercentage`, `eyeClosureRate` | Original v1 metrics, unchanged                                                                                                                                                                                                                |
| Face detection (new)      | `averageFaceConfidence`                                                                                                                                                       | Mean MediaPipe Face Detection score across frames where a face was found. _(New: Face Mesh alone has no confidence score, so one lightweight `mp.solutions.face_detection` call per frame was added — still MediaPipe, no new model family.)_ |
|                           | `continuousFaceLossCount`                                                                                                                                                     | Number of distinct runs of ≥3 consecutive frames with **no face detected at all** (camera blocked, participant left frame, etc.)                                                                                                              |
|                           | `maximumFaceLossDuration`                                                                                                                                                     | Longest such run, in seconds                                                                                                                                                                                                                  |
| Blink behaviour (new)     | `averageBlinkDuration` / `maximumBlinkDuration`                                                                                                                               | Mean/max blink duration in ms (previously only the count/rate were exposed)                                                                                                                                                                   |
|                           | `blinkIntervalVariance`                                                                                                                                                       | Variance of the time gaps between blinks — a rhythm-regularity signal                                                                                                                                                                         |
| Eye gaze (new)            | `screenAttentionPercentage`                                                                                                                                                   | Same computation as the existing `screenAttention` field, added under this name for consistency with the v2 naming convention (intentional duplicate — both are populated identically)                                                        |
|                           | `averageLookAwayDuration` / `maximumLookAwayDuration`                                                                                                                         | Mean/max duration of a look-away run, in seconds                                                                                                                                                                                              |
| Head pose (new)           | `pitchStdDeviation` / `yawStdDeviation` / `rollStdDeviation`                                                                                                                  | Standard deviation of each pose angle individually (previously only combined into one `headMovementVariance` figure)                                                                                                                          |
| Head motion (new)         | `averageHeadSpeed` / `maximumHeadSpeed`                                                                                                                                       | Angular speed (degrees/second) between consecutive valid pose readings                                                                                                                                                                        |

**Refinement:** v1 conflated "no face detected" and "face detected but looking away" into one `lookAwayCount` counter. The pipeline now tracks these as two separate run-trackers, so `continuousFaceLossCount` (face absent) and `lookAwayCount` (face present, head turned) measure genuinely different things. `lookAwayCount`'s _meaning_ is slightly narrower than before as a result — worth knowing if you're comparing pre- and post-upgrade values for the same assessment.

**Bug fixed along the way:** blink/away/face-loss durations were being computed assuming every _processed_ frame is exactly `1/fps` apart, which undercounts durations on long videos where frame sampling skips raw frames (see `MAX_SAMPLED_FRAMES`). Now computed via an explicit `seconds_per_sample` that accounts for the actual sampling stride.

### Screen Features

| Group                  | Field                                                                                                                     | What it measures                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing               | `cursorSpeed`, `cursorAcceleration`, `cursorSmoothness`, `scrollFrequency`, `scrollSpeed`, `idleDuration`, `focusChanges` | Original v1 metrics, unchanged                                                                                                                                    |
| Mouse behaviour (new)  | `mouseStopCount` / `averageMouseStopDuration`                                                                             | Count/mean duration of brief (≥0.3s) low-motion runs — finer-grained than the existing `idleDuration`, which only counts runs ≥2s                                 |
|                        | `mousePathCurvature`                                                                                                      | Mean absolute turning angle (degrees) of the optical-flow direction between consecutive motion frames — proxy for how "wandering" vs. "direct" cursor movement is |
|                        | `cursorJitter`                                                                                                            | Std. deviation of frame-to-frame acceleration — proxy for high-frequency back-and-forth motion                                                                    |
| Scroll behaviour (new) | `scrollBurstCount` / `averageScrollBurstDuration`                                                                         | Count/mean duration of consecutive scroll-classified-frame runs, vs. the existing per-minute `scrollFrequency`                                                    |
| Idle behaviour (new)   | `idleEventCount` / `maximumIdleDuration`                                                                                  | Count and longest single idle run, vs. the existing total `idleDuration`                                                                                          |
| Activity density (new) | `mouseEventsPerSecond` / `scrollEventsPerSecond` / `activityDensity`                                                      | Normalized motion-frame rate, scroll-frame rate, and fraction-of-session-with-any-motion (0–1)                                                                    |

These are all optical-flow **proxies** derived from video motion, not literal cursor/scroll coordinates — a screen recording has none. `useMouseTracking.js`/`useKeyboardTracking.js` remain the precise, client-captured source of truth; treat this module's numbers as a cross-check, not a replacement.

### Historical Recordings: Incremental Upgrade

`npm run backfill` has three possible outcomes per assessment:

| Situation                                                                       | Action                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| No `ExtractedBehaviorFeature` document exists yet                               | **Full extraction** (`enqueueAndWait`)                 |
| Document exists, `status !== "completed"` (crash leftover / previously failed)  | **Full extraction** — not reliably complete either way |
| Document exists, `status === "completed"`, but missing any new-generation field | **Incremental upgrade** (`enqueueIncrementalUpgrade`)  |
| Document exists, `status === "completed"`, has every canonical field            | **Skip**                                               |

"Missing any field" is checked against the canonical field list in `config/featureSchema.js` — the single source of truth for what a "complete" `webcamFeatures`/`screenFeatures` object contains, shared by the backfill script, the export normalization, and (implicitly) the Mongoose schema.

**How the upgrade preserves existing values:** there's no cheaper way to compute "only the new fields" — old and new metrics come out of the same per-frame MediaPipe/OpenCV loop, so the upgrade re-runs the full analyzer. The result is then merged with the existing document giving **existing values priority**:

```js
merged = { ...freshlyComputed, ...existingNonNullFields };
```

So a previously-computed `blinkRate` of `14.2` stays exactly `14.2` even though the analyzer recomputed it during the upgrade — only fields that were actually missing (e.g. `averageFaceConfidence`) get filled from the fresh computation. This is what keeps already-exported baseline numbers stable across the upgrade.

**Resume/idempotence:** re-running `npm run backfill` after an interruption just re-evaluates each assessment's current state and does the same three-way decision again; anything already fully upgraded is skipped.

Example output:

```
====================================
ABEIS Historical Extraction
====================================

Completed assessments found: 128

[1/128] Processing assessment A001...
✔ Completed

[2/128] Upgrading assessment A002 (missing new-generation fields)...
✔ Upgraded

[3/128] Already processed
Skipping

[4/128] Missing recordings
Skipping

...

====================================
Finished
====================================

Processed (full)        : 40
Upgraded (incremental)   : 70
Skipped                  : 15
Failed                   : 3
```

### Automatic Extraction for Future Assessments

`completeAssessment()` calls `enqueueExtraction()`, which runs the same `_processAssessment()` producing the full current field set automatically — no frontend changes, no additional wiring. A brand-new assessment has no prior document to merge against, so it always gets a full extraction with every field populated in one pass.

### Schema & Forward Compatibility

- All original fields remain unchanged.
- All new fields are added to both `webcamFeaturesSchema` and `screenFeaturesSchema`, each `{ type: Number, default: null }`.
- Both sub-schemas set `strict: false`, so a field present in a document but not (yet) known to this schema version passes through untouched (forward-compatible with a future version running before this code is deployed everywhere).
- **No migration script required.** Two things make old documents "just work": (1) Mongoose doesn't error on missing paths when reading existing documents, and (2) the export layer explicitly normalizes missing fields to `null` at read time rather than relying on Mongoose schema defaults — which is important because `.lean()` reads (used everywhere in this codebase for performance) **do not** apply Mongoose schema defaults to pre-existing documents. Relying on schema defaults alone would have silently under-delivered on "missing values should default to null" for any document fetched via `.lean()`.

`metadata.modelVersion` is `"v2.0"` for anything processed by the current pipeline (`config/featureSchema.js`'s `CURRENT_MODEL_VERSION`) — documents untouched since before this upgrade still show `"v1.0"`, giving you a quick way to `db.ExtractedBehaviorFeatures.countDocuments({"metadata.modelVersion": "v1.0"})` to see how much of the backfill remains.

### Performance Notes

- No new heavy model family introduced. The one addition, `mp.solutions.face_detection`, is the same lightweight BlazeFace-based MediaPipe solution already listed in the original spec — not a new dependency category.
- Every new metric is computed inside the **same** per-frame loop as the existing metrics (one webcam pass, one screen optical-flow pass) — there is no second pass over either video.
- Frame sampling (`MAX_SAMPLED_FRAMES = 900`) and concurrency (`FEATURE_EXTRACTION_CONCURRENCY`) are unchanged, so per-assessment extraction time is approximately the same as before the upgrade; the extra per-frame work (one more MediaPipe call for face detection, plus arithmetic on already-collected arrays) is small relative to the Face-Mesh/optical-flow cost that dominates either pass.
- Webcam and screen recordings continue to be downloaded and analyzed in parallel via `Promise.all` in `_processAssessment()`, in both the live and backfill paths.

### Testing Performed

Real participant recordings weren't available in the development environment, so correctness was verified with synthetic edge-case videos rather than a full face/screen recording:

- **`screen_features.py`**, run against a synthetic video with a moving/stopping bar: produced all 11 new fields with sane values (no exceptions, no NaNs) — confirms the optical-flow-based mouse-stop/curvature/jitter/burst/idle/density logic runs end-to-end.
- **`webcam_features.py`**, run against a synthetic _no-face_ video (worst case: every frame fails Face Mesh detection): completed without error, correctly reported `continuousFaceLossCount: 1`, `maximumFaceLossDuration` equal to the full clip length, and every other field at its safe zero/default — confirms the pipeline degrades gracefully rather than crashing when a participant isn't in frame.
- **Found and fixed a real environment issue in the process**: `mediapipe==0.10.33` (the latest release at time of testing) has removed the legacy `mp.solutions` API entirely, which `webcam_features.py` depends on (`AttributeError: module 'mediapipe' has no attribute 'solutions'`). Re-installing the exact pin from `requirements.txt` (`mediapipe==0.10.14`) resolved it. **This means the version pin in `requirements.txt` is load-bearing, not just a suggestion** — documented directly in that file so a future `pip install --upgrade mediapipe` doesn't silently break the pipeline in production.
- Node-side: every file in `backend-nodejs/` (source tree for `backend/`) passes `node --check` (syntax-level) after the rewrite; the merge-priority logic (`_mergePreferExisting`) and the three-way backfill decision (`_decideAction`) were traced through by hand for all four cases (missing doc / incomplete doc / up-to-date doc / no recordings) since a live MongoDB + real recordings weren't available to exercise them end-to-end in that environment.

**Not yet verified (recommend doing before full-scale rollout):** running the pipeline against 1–2 real participant recordings with an actual face present, to sanity-check the absolute values of `averageFaceConfidence`, head-speed, and blink-duration numbers against what a human reviewer would expect. The synthetic tests confirm the code _runs correctly_; they can't confirm the numbers are _meaningful_ the way real footage can.

---

## Export Pipeline (Unified JSON / CSV Dataset)

### Overview

`GET /api/admin/export` provides a **single unified dataset** containing all participant information required for behavioral baseline generation, statistical analysis, ML model training, research, participant auditing, data backup, and offline analysis. Instead of exporting data from individual MongoDB collections separately, the endpoint combines all required information into one structured JSON (or flattened CSV) record per assessment, via `services/exportService.js`.

```
GET /api/admin/export?format=json
GET /api/admin/export?format=csv
GET /api/admin/export?format=json&assessmentType=mcq|coding|typing
```

### Why it exists

Earlier iterations of the export exposed only user details, assessment information, recording URLs, and browser behavioral features as an opaque string (`featureVectorJSON`), requiring additional parsing and multiple MongoDB queries before the dataset could be used. The current export produces a fully structured dataset immediately usable without any additional processing.

### Collections combined into each exported row

| Source                     | Contributes                                                                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                     | User ID, Name, Email                                                                                                                                                                          |
| `Assessment`               | Assessment ID, Session ID, Assessment Type, Status, Start Time, End Time, Duration                                                                                                            |
| `Media`                    | Camera Recording URL, Screen Recording URL                                                                                                                                                    |
| `BehavioralFeature`        | Client-captured mouse / keyboard / session features, plus assessment-specific features (typing WPM/accuracy, coding copy-paste/backspaces; MCQ has no assessment-specific behavioral metrics) |
| `ExtractedBehaviorFeature` | AI-generated webcam and screen features (see [Behavioral Feature Extraction Pipeline](#behavioral-feature-extraction-pipeline-webcam--screen-ai-features) for the full field list)            |
| `AssessmentResponse`       | Participant answers (MCQ / Coding / Typing, shape depends on `assessmentType`)                                                                                                                |

#### Mouse features (from `BehavioralFeature`)

Total Movement, Average Speed, Maximum Speed, Acceleration, Cursor Smoothness, Click Frequency, Total Clicks, Double Clicks, Right Clicks, Drag Events, Scroll Events, Scroll Distance.

#### Keyboard features (from `BehavioralFeature`)

Average Key Press Duration, Average Inter Key Latency, Typing Rhythm Variance, Total Keystrokes, Key Frequency, Backspace Count, Delete Count, Shift Usage, Ctrl Usage, Copy Attempts, Paste Attempts, Error Rate.

#### Session features (from `BehavioralFeature`)

Idle Time, Idle Period Count, Focus Changes, Tab Switches, Fullscreen Exits, Network Latency, Session Duration, Browser, OS, Device Type, Screen Resolution, Average Response Time.

#### Assessment-specific features

- **Typing:** WPM, Accuracy, Task-wise WPM, Task-wise Accuracy.
- **Coding:** Copy Paste Attempts, Backspaces.
- **MCQ:** none.

#### Assessment responses

- **MCQ:** Question ID, Question, Selected Option, Correct Option, Correct/Incorrect, Response Time.
- **Coding:** Question Number, Prompt, Submitted Code, Programming Language, Response Time, Provided Solution (where applicable), Match Status.
- **Typing:** Task Number, Source Text, Typed Text, WPM, Accuracy, Response Time.

### Export row structure

```json
{
  "userId": "...",
  "name": "...",
  "email": "...",

  "assessmentId": "...",
  "sessionId": "...",
  "assessmentType": "typing",
  "status": "completed",

  "startedAt": "...",
  "endedAt": "...",
  "durationSeconds": 120,

  "cameraRecordingUrl": "...",
  "screenRecordingUrl": "...",

  "behavioralFeatures": {},

  "videoFeatures": {
    "webcam": {},
    "screen": {}
  },

  "responses": {}
}
```

`videoFeatures.webcam` and `videoFeatures.screen` are run through `normalizeFeatureObject()` (from `config/featureSchema.js`) before being returned, so **every** canonical AI feature field is present in the export, with `null` for any field a given document doesn't have — whether that's because the document predates a pipeline upgrade and hasn't been backfilled yet, or the extraction is still in progress. Downstream ML code can rely on e.g. `videoFeatures.webcam.averageFaceConfidence` always existing as a key (possibly `null`) rather than needing to check for its presence first.

Full example of a `videoFeatures` block:

```json
"videoFeatures": {
  "webcam": {
    "blinkRate": 14.2,
    "averageFaceConfidence": 0.91,
    "continuousFaceLossCount": 0,
    "maximumFaceLossDuration": 0,
    "averageBlinkDuration": 118.4,
    "maximumBlinkDuration": 210.0,
    "blinkIntervalVariance": 3.2,
    "screenAttentionPercentage": 92.5,
    "averageLookAwayDuration": 1.8,
    "maximumLookAwayDuration": 4.1,
    "pitchStdDeviation": 2.1,
    "yawStdDeviation": 3.4,
    "rollStdDeviation": 1.0,
    "averageHeadSpeed": 12.3,
    "maximumHeadSpeed": 58.0
  },
  "screen": {
    "cursorSpeed": 3.1,
    "mouseStopCount": 6,
    "averageMouseStopDuration": 0.9,
    "mousePathCurvature": 14.7,
    "cursorJitter": 0.42,
    "scrollBurstCount": 2,
    "averageScrollBurstDuration": 1.1,
    "idleEventCount": 1,
    "maximumIdleDuration": 3.0,
    "mouseEventsPerSecond": 1.8,
    "scrollEventsPerSecond": 0.1,
    "activityDensity": 0.63
  }
}
```

No route, controller signature, or CSV/JSON toggle changes across pipeline upgrades — `GET /api/admin/export?format=json|csv&assessmentType=` behaves identically from the frontend's perspective; the file it downloads just carries more (and, for old data, `null`-safe) fields.

### CSV export

CSV export remains available alongside JSON. Nested JSON objects are automatically flattened into dot notation, e.g.:

```
behavioralFeatures.mouse.avgSpeed
behavioralFeatures.keyboard.totalKeystrokes
videoFeatures.webcam.blinkRate
videoFeatures.screen.cursorSpeed
```

Arrays such as assessment responses are serialized into JSON strings. JSON export is recommended for ML and baseline generation; CSV is useful for spreadsheet analysis.

### Benefits

- Single unified dataset, no MongoDB joins required after export.
- No string parsing.
- Complete client-captured behavioral features, complete webcam AI features, complete screen AI features.
- Participant responses, recording URLs, user metadata, and assessment metadata all in one place.
- Ready for behavioral baseline generation, ML training, statistical analysis, and research.
- Missing behavioral or video features are exported as `null` rather than omitted, so downstream code never has to guard for a missing key.

---

## Baseline Generation Workflow

With the unified export in place, a baseline/ML pipeline can consume one file with no further joins:

```
Participant completes assessment
        ↓
Client-captured behavioral features generated
        ↓
Webcam recording uploaded
        ↓
Screen recording uploaded
        ↓
AI feature extraction pipeline processes recordings (async)
        ↓
Features stored in MongoDB (ExtractedBehaviorFeature)
        ↓
Admin exports dataset (GET /api/admin/export)
        ↓
Unified JSON dataset generated
        ↓
Baseline generation
        ↓
Machine Learning model training
        ↓
Behavioral authentication
```

1. `GET /api/admin/export?format=json` → one JSON array, one object per assessment.
2. Group by `userId` (and optionally `assessmentType`).
3. For each group, `behavioralFeatures.*` gives the client-captured mouse/keyboard/session/typing/coding signals, and `videoFeatures.webcam.*` / `videoFeatures.screen.*` give the AI-derived signals — all as real numbers (or `null`), ready to average, z-score, or feed into a model without any type coercion or additional MongoDB queries.
4. `null` fields should be treated as "not yet available" (extraction still running, or a not-yet-backfilled document) rather than "value is zero" — filter them out of an average rather than including them as 0.

---

## Security Model

### Admin authentication

- Credentials (`ADMIN_ID`, `ADMIN_PASSWORD`) are stored exclusively in server-side environment variables. They are never sent to the client or referenced in any frontend file.
- The backend validates credentials on every login request and signs a short-lived JWT (8 hours) with `JWT_SECRET`.
- The JWT is stored in browser `sessionStorage` — it is cleared automatically when the tab closes and is not accessible to other origins.
- Every protected admin route verifies the JWT in `adminAuth` middleware before any controller logic runs. A missing or invalid token returns `401 Unauthorized`.

### Audit log

Every destructive admin action logs a structured entry to the server console:

```
[ADMIN_DELETE] adminId=ADMIN001 deletedUser=<uuid> counts={...} ip=::1 ts=2025-01-01T00:00:00.000Z
```

Log entries include: event type, admin ID, affected user IDs, per-collection record counts, IP address, and ISO timestamp.

### Rate limiting

All `/api` routes are rate-limited to 1 000 requests per 15-minute window per IP (configurable in `server.js`).

### CORS

The `cors` middleware is configured with `credentials: true` and an explicit `origin` set to `FRONTEND_URL`. In production this should be set to the exact frontend domain, not `*`.

### Future hardening

The authentication system is designed to be upgraded to multi-admin support by replacing the env-var comparison in `adminController.adminLogin` with a lookup against an `admins` MongoDB collection (bcrypt-hashed passwords, RBAC roles) without requiring changes to the JWT issuance logic, middleware, or protected routes.

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build          # outputs to dist/
# Push to GitHub, connect repo in Vercel
# Set environment variable: VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

### Backend → Render

Create a Web Service pointing to the `backend/` directory with start command `node server.js`. Set these environment variables in the Render dashboard:

```
MONGODB_URI          = mongodb+srv://...
IMAGEKIT_PUBLIC_KEY  = ...
IMAGEKIT_PRIVATE_KEY = ...
IMAGEKIT_URL_ENDPOINT = https://ik.imagekit.io/...
FRONTEND_URL         = https://your-app.vercel.app
NODE_ENV             = production
ADMIN_ID             = (choose a strong ID)
ADMIN_PASSWORD       = (choose a strong password)
JWT_SECRET           = (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
PRIVACY_POLICY_VERSION = 1.0.0
FEATURE_EXTRACTION_CONCURRENCY = 2
```

### Python worker

The Python worker (`python-worker/`) must be deployed alongside (or reachable by) the backend so `featureExtractionService.js` can invoke it. Respect the `mediapipe==0.10.14` pin in `requirements.txt` — newer releases have removed the `mp.solutions` API the webcam analyzer depends on.

### Storage abstraction

Media uploads and deletions go through `backend/config/imagekit.js` (`uploadToStorage` / `deleteFromStorage`). To swap ImageKit for AWS S3 or Azure Blob Storage in production, reimplement only those two functions — no controller code needs to change.

---

## Known Limitations & Future Hardening

- **Question bank** — MCQ questions, coding prompts, and typing passages are hardcoded sample content in the assessment page files. Wire these to a CMS or a `questions` MongoDB collection to make them configurable without a code deploy.
- **Camera-based signals** — `camera.lookingAwayCount` and `faceDetectionStatus` in the client-captured `BehavioralFeature` schema remain self-reported flags rather than measured signals. Real, measured camera-based signals (face confidence, look-away duration, head pose, blink dynamics) are now populated via the separate `ExtractedBehaviorFeature` AI pipeline; consider deprecating or clearly re-labeling the unpopulated `BehavioralFeature.camera` sub-fields to avoid confusion between the two sources.
- **Raw event storage** — `BehavioralFeature.rawEvents` can grow large for long sessions. Consider adding a TTL index, moving raw events to cold storage after a configurable retention period, or streaming events to the backend incrementally instead of batching on submit.
- **Participant auth** — participants are identified only by email lookup (no password, token, or magic link). Before exposing this platform to any real-world population, add a session token or email-verified magic link so participants cannot impersonate each other.
- **Single admin** — the current system supports exactly one administrator via env vars. Upgrade to a MongoDB-backed `admins` collection with bcrypt and RBAC when multiple researchers need independent access.
- **Admin JWT revocation** — JWTs are stateless; a logged-out token remains valid until expiry (8 hours). For stricter security, maintain a server-side deny-list or switch to shorter-lived tokens with refresh.
- **Media size limits** — Multer is configured to accept up to 200 MB per upload. Tune this limit or implement chunked uploads for longer recording sessions.
- **AI feature extraction is a proxy, not ground truth** — all screen-based mouse/scroll metrics are optical-flow proxies derived from video motion, not literal cursor/scroll coordinates; treat `useMouseTracking.js`/`useKeyboardTracking.js` as the precise source of truth and the AI-extracted screen features as a cross-check.
- **Real-footage validation pending** — the v2 webcam/screen metrics have only been validated against synthetic edge-case videos (no face, moving/stopping bar). Absolute values for `averageFaceConfidence`, head-speed, and blink-duration metrics should be sanity-checked against 1–2 real participant recordings before relying on them at scale.
- **`mediapipe` version pin is load-bearing** — `mediapipe==0.10.14` must not be casually upgraded; 0.10.33+ removes the legacy `mp.solutions` API the webcam analyzer depends on. Any future upgrade needs a corresponding rewrite of `webcam_features.py` against the new API, not just a version bump. -->

# ABEIS — Automated Behavioral & Engagement Intelligence System

A full-stack research platform that registers participants, captures explicit informed consent, records webcam and screen video, and collects rich behavioral telemetry (mouse, keyboard, session signals) across three assessment types — MCQ, Coding, and Typing — to build per-user behavioral baselines for longitudinal comparison. A background feature-extraction pipeline turns the raw webcam/screen recordings into AI-derived behavioral signals (face, gaze, head pose, face position/size, mouse/scroll dynamics). A fully authenticated Admin Dashboard lets researchers search, inspect, export, and permanently delete participant data, and export a single unified JSON/CSV dataset combining all of the above for baseline generation and ML training.

> **v3 changelog:** adds face-count, face bounding-box/size/position, cumulative face-disappearance duration, and four-directional gaze-duration/percentage webcam features; fixes a live-extraction bug where newly completed assessments could get stuck at `status: "processing"` until `npm run backfill` was run manually; all changes are additive and backward compatible — no existing field, endpoint, or collection was renamed or removed. See [Live Extraction "Stuck in Processing" Bug Fix (v3)](#live-extraction-stuck-in-processing-bug-fix-v3) and [Face Position & Gaze Features (v3)](#face-position--gaze-features-v3).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Repository Structure](#repository-structure)
3. [Technology Stack](#technology-stack)
4. [Environment Variables](#environment-variables)
5. [Quick Start](#quick-start)
6. [Backend — File Reference](#backend--file-reference)
   - [Entry Point](#entry-point)
   - [Configuration](#configuration)
   - [Models](#models)
   - [Controllers](#controllers)
   - [Routes](#routes)
   - [Middleware](#middleware)
   - [Services](#services)
7. [Frontend — File Reference](#frontend--file-reference)
   - [Entry Point & Root](#entry-point--root)
   - [Context Providers](#context-providers)
   - [API Client](#api-client)
   - [Pages](#pages)
   - [Hooks](#hooks)
   - [Components](#components)
8. [Data Flow — End-to-End Walkthroughs](#data-flow--end-to-end-walkthroughs)
   - [Participant Registration](#1-participant-registration)
   - [Consent & Permission Grant](#2-consent--permission-grant)
   - [Assessment Session](#3-assessment-session)
   - [Behavioral Data Submission](#4-behavioral-data-submission)
   - [Admin Login & Dashboard](#5-admin-login--dashboard)
   - [Participant Deletion](#6-participant-deletion)
9. [API Reference](#api-reference)
10. [MongoDB Collections](#mongodb-collections)
11. [Behavioral Feature Extraction Pipeline (Webcam & Screen AI Features)](#behavioral-feature-extraction-pipeline-webcam--screen-ai-features)
    - [Pipeline Consistency Guarantee](#pipeline-consistency-guarantee)
    - [Live Extraction "Stuck in Processing" Bug Fix (v3)](#live-extraction-stuck-in-processing-bug-fix-v3)
    - [Webcam Features](#webcam-features)
    - [Face Position & Gaze Features (v3)](#face-position--gaze-features-v3)
    - [Screen Features](#screen-features)
    - [Historical Recordings: Incremental Upgrade](#historical-recordings-incremental-upgrade)
    - [Automatic Extraction for Future Assessments](#automatic-extraction-for-future-assessments)
    - [Schema & Forward Compatibility](#schema--forward-compatibility)
    - [Performance Notes](#performance-notes)
    - [Testing Performed](#testing-performed)
12. [Export Pipeline (Unified JSON / CSV Dataset)](#export-pipeline-unified-json--csv-dataset)
13. [Migration / Integration Guide (v3)](#migration--integration-guide-v3)
14. [Baseline Generation Workflow](#baseline-generation-workflow)
15. [Security Model](#security-model)
16. [Deployment](#deployment)
17. [Known Limitations & Future Hardening](#known-limitations--future-hardening)

---

## Architecture Overview

```
Browser (React + Vite)
        │
        │  HTTP / multipart
        ▼
Express API (Node.js)
        │                        │                     │
        │  Mongoose ODM           │  ImageKit SDK        │  Job Queue
        ▼                        ▼                     ▼
  MongoDB Atlas            ImageKit Cloud       Python Worker
  (structured data)        (video recordings)   (MediaPipe / OpenCV
                                                  feature extraction)
```

The frontend is a single-page React application. Every state-changing action hits a REST endpoint on the Express backend. Recordings (webcam, screen) are the only binary data; they are streamed directly from the browser's `MediaRecorder` to the backend, which forwards them to ImageKit. Only the resulting metadata (URL, file ID, size) is stored in MongoDB.

Once an assessment completes, its webcam and screen recordings are also enqueued for asynchronous AI feature extraction: a Node-side job queue downloads both recordings and hands them to a Python worker (MediaPipe for webcam, OpenCV optical flow for screen), which returns a numerical feature vector that is written to its own collection, independent of and additive to the client-captured `BehavioralFeature` document.

The Admin Dashboard is entirely separate from the participant flow. It is protected by a JWT issued by the backend on successful admin login. No admin credential ever reaches the browser's JavaScript bundle.

---

## Repository Structure

```
abeis/
├── backend/
│   ├── server.js                     # Express app entry point
│   ├── package.json
│   ├── .env.example
│   ├── config/
│   │   ├── db.js                     # MongoDB connection
│   │   ├── imagekit.js               # ImageKit upload/delete abstraction
│   │   └── featureSchema.js          # Canonical AI feature field lists + normalize/isMissingFields helpers
│   ├── models/
│   │   ├── User.js
│   │   ├── Consent.js
│   │   ├── Assessment.js
│   │   ├── BehavioralFeature.js
│   │   ├── AssessmentResponse.js
│   │   ├── Media.js
│   │   ├── Baseline.js
│   │   └── ExtractedBehaviorFeature.js   # AI-derived webcam/screen feature vectors
│   ├── controllers/
│   │   ├── userController.js
│   │   ├── consentController.js
│   │   ├── assessmentController.js
│   │   ├── responseController.js
│   │   ├── mediaController.js
│   │   ├── baselineController.js
│   │   └── adminController.js
│   ├── routes/
│   │   ├── userRoutes.js
│   │   ├── consentRoutes.js
│   │   ├── assessmentRoutes.js
│   │   ├── responseRoutes.js
│   │   ├── mediaRoutes.js
│   │   ├── baselineRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── adminAuth.js              # JWT verification middleware
│   │   └── errorMiddleware.js        # 404 + error handler
│   ├── services/
│   │   ├── baselineService.js        # Running-average baseline engine
│   │   ├── featureExtractionService.js  # Stage logging, enqueueExtraction/enqueueAndWait/enqueueIncrementalUpgrade, merge logic
│   │   └── exportService.js          # Builds the unified export dataset
│   └── scripts/
│       └── backfillExtraction.js     # Historical full/incremental/skip decision + progress reporting
│
├── python-worker/
│   ├── requirements.txt              # mediapipe version pin is load-bearing — documented here
│   ├── webcam_features.py            # MediaPipe Face Mesh + Face Detection analyzer
│   ├── screen_features.py            # OpenCV optical-flow analyzer
│   └── utils/
│       └── ear.py                    # BlinkTracker (eye-aspect-ratio based blink detection)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    ├── .env.example
    └── src/
        ├── main.jsx                  # React entry point
        ├── App.jsx                   # Route definitions + AdminProvider
        ├── index.css                 # Tailwind + global CSS vars
        ├── api/
        │   └── client.js             # Axios instance + JWT interceptor
        ├── context/
        │   ├── SessionContext.jsx    # Participant session state
        │   └── AdminContext.jsx      # Admin auth state (JWT)
        ├── components/
        │   └── RequireAdmin.jsx      # Route guard for admin pages
        ├── hooks/
        │   ├── useMouseTracking.js
        │   ├── useKeyboardTracking.js
        │   ├── useSessionTracking.js
        │   └── useMediaRecording.js
        └── pages/
            ├── RegisterPage.jsx      # Landing + participant registration
            ├── ConsentPage.jsx       # Informed consent + permission grant
            ├── HubPage.jsx           # Assessment selection hub
            ├── McqAssessmentPage.jsx
            ├── CodingAssessmentPage.jsx
            ├── TypingAssessmentPage.jsx
            ├── CompletePage.jsx
            ├── AdminLoginPage.jsx
            ├── AdminDashboardPage.jsx
            └── AdminUserDetailPage.jsx
```

---

## Technology Stack

| Layer                 | Technology                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| Frontend framework    | React 18 + Vite                                                                |
| Styling               | Tailwind CSS                                                                   |
| Routing               | React Router v6                                                                |
| HTTP client           | Axios                                                                          |
| Backend framework     | Express 4                                                                      |
| Database              | MongoDB (via Mongoose 8)                                                       |
| Media storage         | ImageKit                                                                       |
| Auth tokens           | JSON Web Tokens (jsonwebtoken)                                                 |
| File upload (backend) | Multer (memory storage)                                                        |
| CSV export            | json2csv                                                                       |
| ID generation         | uuid v4                                                                        |
| Logging               | Morgan (HTTP) + stage-level pipeline logging                                   |
| Security headers      | Helmet                                                                         |
| Rate limiting         | express-rate-limit                                                             |
| AI feature extraction | Python worker — MediaPipe (Face Mesh + Face Detection) & OpenCV (optical flow) |
| Extraction job queue  | Node-side job queue (`featureExtractionService.js`)                            |

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/abeis

# ImageKit credentials
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# Allowed CORS origin (set to your frontend URL in production)
FRONTEND_URL=http://localhost:5173

# Privacy policy version stamped on every consent record
PRIVACY_POLICY_VERSION=1.0.0

# Admin credentials — never hardcode these in source
ADMIN_ID=ADMIN001
ADMIN_PASSWORD=ADMIN@001

# JWT signing secret — use a long random string in production
JWT_SECRET=change-this-to-a-long-random-secret

# Feature-extraction job queue concurrency
FEATURE_EXTRACTION_CONCURRENCY=2
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Python worker (`python-worker/requirements.txt`)

```
mediapipe==0.10.14   # PINNED — see "Testing Performed" below; do not upgrade without re-validating
opencv-python
numpy
```

---

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env        # fill in your credentials
npm install
npm run dev                  # nodemon — restarts on file changes
# API listening at http://localhost:5000
```

### Frontend

```bash
cd frontend
cp .env.example .env         # adjust VITE_API_BASE_URL if needed
npm install
npm run dev
# App at http://localhost:5173
```

### Python worker

```bash
cd python-worker
pip install -r requirements.txt   # respect the mediapipe pin
```

### Backfilling historical recordings (optional, one-time / as-needed)

```bash
cd backend
npm run backfill
```

Visit `http://localhost:5173` to start as a participant, or click **Admin Login** on the landing page and use the credentials set in your `.env` to access the Admin Dashboard.

---

## Backend — File Reference

### Entry Point

#### `backend/server.js`

The root of the Express application. Responsibilities:

- Loads `.env` via `dotenv`.
- Calls `connectDB()` to establish the MongoDB connection before the server starts.
- Applies global middleware in order: `helmet` (security headers), `cors` (restricted to `FRONTEND_URL`), `express.json` (10 MB limit for large feature vector payloads), `morgan` (request logging), and a `rateLimit` of 1 000 requests per 15-minute window on all `/api` routes.
- Mounts every route group under its path prefix (`/api/users`, `/api/consent`, etc.).
- Registers the `notFound` and `errorHandler` middleware last so they catch anything not matched by a route.
- Starts the HTTP server on `process.env.PORT` (default 5000).

**Connections:** imports every route file; imports `connectDB` and `errorMiddleware`.

---

### Configuration

#### `backend/config/db.js`

Exports a single async function `connectDB()`. Calls `mongoose.connect()` with the `MONGODB_URI` env var and logs the connected host. Exits the process on failure so a misconfigured environment fails fast rather than serving 500s.

**Used by:** `server.js`.

#### `backend/config/imagekit.js`

Initialises the ImageKit SDK with the three ImageKit env vars and exports two wrapper functions:

- `uploadToStorage(fileBuffer, fileName, folder)` — uploads a `Buffer` to a given ImageKit folder and returns the full ImageKit response (including `fileId`, `url`, `name`, `size`).
- `deleteFromStorage(fileId)` — deletes a single file by its ImageKit file ID.

The abstraction keeps all ImageKit SDK calls in one place; replacing ImageKit with S3 or Azure Blob means reimplementing only these two functions without touching any controller.

**Used by:** `mediaController.js`, `adminController.js`, `featureExtractionService.js` (to download recordings for analysis).

#### `backend/config/featureSchema.js`

The single source of truth for what a "complete" AI-derived `webcamFeatures` / `screenFeatures` object contains. Exports:

- The canonical field lists for `webcamFeatures` and `screenFeatures` (v1 + v2 fields).
- `CURRENT_MODEL_VERSION` (currently `"v2.0"`).
- `normalizeFeatureObject()` — fills any field missing from a stored document with `null`, guaranteeing every canonical key is always present in reads (important because `.lean()` queries do not apply Mongoose schema defaults — see [Schema & Forward Compatibility](#schema--forward-compatibility)).
- `isMissingFields()` — used by the backfill script to decide whether an already-processed document needs an incremental upgrade.

**Used by:** `scripts/backfillExtraction.js`, `services/exportService.js`, and implicitly documents the shape backing `models/ExtractedBehaviorFeature.js`.

---

### Models

All models use Mongoose schemas. Every document that belongs to a participant references the participant by their `userId` string (a UUID v4), not by MongoDB's `_id`. This makes cross-collection queries straightforward and keeps the deletion logic consistent.

#### `backend/models/User.js`

Stores the participant's identity.

| Field                     | Type             | Notes                                |
| ------------------------- | ---------------- | ------------------------------------ |
| `userId`                  | String (UUID v4) | Auto-generated, unique, indexed      |
| `name`                    | String           | Required, trimmed                    |
| `email`                   | String           | Required, unique, lowercase, indexed |
| `createdAt` / `updatedAt` | Date             | Auto-managed by Mongoose timestamps  |

Registering with an existing email returns the existing record (idempotent register), enabling returning participants to build on their baseline without creating duplicate profiles.

#### `backend/models/Consent.js`

One document per consent event (a participant may consent multiple times across assessment types).

Key fields: `consentId` (UUID), `userId`, `sessionId`, `consentAccepted` (boolean), `acknowledgedStatements` (one boolean per the 8 required statements), `cameraPermissionStatus`, `screenRecordingPermissionStatus`, `browserInfo`, `privacyPolicyVersion`, `ipAddress`.

The consent record is the gate that `startAssessment` checks before creating an `Assessment` document. Both `cameraPermissionStatus` and `screenRecordingPermissionStatus` must equal `"granted"` or consent creation is rejected with a 403.

#### `backend/models/Assessment.js`

One document per assessment session.

Key fields: `assessmentId` (UUID), `userId`, `sessionId` (UUID shared with the consent for that session), `assessmentType` (`"mcq" | "coding" | "typing"`), `consentId`, `status` (`"in_progress" | "completed" | "abandoned"`), `startedAt`, `endedAt`, `duration` (seconds), `meta` (arbitrary config snapshot — which questions were served, etc.).

#### `backend/models/BehavioralFeature.js`

One document per completed assessment. Stores the aggregated **client-captured** feature vector and optionally the raw event log.

`featureVector` is a `Mixed` (schemaless) object. Its expected shape contains sub-objects:

```
mouse:    { totalMovement, avgSpeed, maxSpeed, acceleration, clickFrequency,
            doubleClicks, rightClicks, dragEvents, scrollEvents, scrollDistance,
            cursorSmoothness }

keyboard: { avgKeyPressDuration, avgInterKeyLatency, typingRhythmVariance,
            keyFrequency, errorRate, backspaceCount, deleteCount, shiftUsageCount,
            ctrlComboCount, copyAttempts, pasteAttempts }

session:  { idleTimeMs, idlePeriodsCount, focusChanges, tabSwitches,
            fullscreenExits, avgNetworkLatencyMs, browser, device,
            screenResolution, sessionDurationMs }

camera:   { cameraEnabled, lookingAwayCount, faceDetectionStatus }
screen:   { screenRecordingEnabled, recordingDurationMs }

typing:   { wpm, accuracy, errorCorrections }       ← typing assessments only
coding:   { copyPasteAttempts, backspaces, corrections }  ← coding assessments only
```

`rawEvents` optionally stores the full arrays of `mouseEvents`, `keyboardEvents`, and `sessionEvents` for deep re-analysis. These are capped client-side to keep payload sizes manageable.

> **Note:** this document's `camera`/`screen` sub-objects are self-reported client flags (was the camera enabled, was the recording started), not AI-derived measurements. The actual AI-derived webcam/screen signals — face detection quality, gaze, head pose, optical-flow mouse dynamics — live in the separate `ExtractedBehaviorFeature` document described below, produced by the Python feature-extraction pipeline rather than the browser.

#### `backend/models/AssessmentResponse.js`

One document per assessment — stores the actual answers given.

- `mcqResponses[]` — per-question: `questionId`, `selectedOption`, `correctOption`, `isCorrect`, `responseTimeMs`.
- `codingResponses[]` — per question (independent + transcription): `submittedCode`, `language`, `backspaceCount`, `correctionCount`, `copyPasteAttempts`, `matchesProvidedSolution`.
- `typingResponses[]` — per task (plain + symbol-heavy): `sourceText`, `typedText`, `wpm`, `accuracy`, `responseTimeMs`.

#### `backend/models/Media.js`

One document per assessment. Stores the metadata for both recordings after they have been uploaded to ImageKit.

Each of `cameraRecording` and `screenRecording` is an embedded sub-document containing: `imagekitFileId`, `imageUrl`, `fileName`, `size` (bytes), `duration` (seconds). The `imagekitFileId` is what `deleteFromStorage()` uses during deletion, and what `featureExtractionService` uses to download the recording for AI analysis.

#### `backend/models/Baseline.js`

One document per participant (unique on `userId`). Maintains a running average of nine behavioural metrics split by assessment type — `mcqBaseline`, `codingBaseline`, `typingBaseline` — each a sub-document with:

`sampleCount`, `avgResponseTimeMs`, `avgTypingSpeedWpm`, `avgMouseSpeed`, `avgClickFrequency`, `avgKeyLatencyMs`, `avgScrollDistance`, `avgIdleDurationMs`, `avgBackspaceCount`, `avgFocusChanges`, `lastUpdatedAt`, `lastFeatureVector` (full snapshot of the most recent assessment's vector).

#### `backend/models/ExtractedBehaviorFeature.js`

One document per assessment, linked by `assessmentId` / `userId` / `sessionId` / `assessmentType`, holding the **AI-derived** feature vectors computed by the Python worker from the webcam and screen recordings. Populated asynchronously after `completeAssessment` enqueues extraction (see [Behavioral Feature Extraction Pipeline](#behavioral-feature-extraction-pipeline-webcam--screen-ai-features)).

Top-level shape:

```
status:   "pending" | "completed" | "failed"
lastError: string | null           # populated only when status === "failed"
webcamFeatures: { ...see below }
screenFeatures: { ...see below }
metadata: { modelVersion: "v1.0" | "v2.0", processedAt, ... }
```

Both `webcamFeaturesSchema` and `screenFeaturesSchema` are `strict: false` (a field present in a document but not yet known to the currently-deployed schema version passes through untouched — forward compatible with a future v3), and every individual field defaults to `null` rather than being required, since not every recording will contain a usable signal for every metric (e.g. no face in frame at all).

**Used by:** `featureExtractionService.js` (writes), `exportService.js` (reads, via `.lean()` + `normalizeFeatureObject()`), `adminController.getUserDetails` (drill-down view).

---

### Controllers

Controllers are thin async handlers (using `express-async-handler` to avoid boilerplate try/catch). They read from the request, call models or services, and write the response.

#### `backend/controllers/userController.js`

| Function       | Route                      | Description                                                                                                                                                      |
| -------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerUser` | `POST /api/users/register` | Creates a new participant or returns an existing one (matched by email). Sets `isReturningUser` in the response so the frontend can show a personalised message. |
| `getUserById`  | `GET /api/users/:userId`   | Returns one participant by their UUID.                                                                                                                           |
| `listUsers`    | `GET /api/users`           | Returns all participants; supports a `search` query parameter that matches against `name`, `email`, or `userId` using case-insensitive regex.                    |

#### `backend/controllers/consentController.js`

| Function        | Route                         | Description                                                                                                                                                                                                                 |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recordConsent` | `POST /api/consent`           | Validates that all 8 `acknowledgedStatements` are `true` and that both permissions are `"granted"`, then creates a `Consent` document. Stamps the `privacyPolicyVersion` from the env var and the participant's IP address. |
| `getConsent`    | `GET /api/consent/:consentId` | Returns one consent record by ID.                                                                                                                                                                                           |

#### `backend/controllers/assessmentController.js`

| Function                | Route                                          | Description                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startAssessment`       | `POST /api/assessments/start`                  | Looks up the `consentId`, verifies `consentAccepted === true`, generates a `sessionId`, and creates an `Assessment` with `status: "in_progress"`.                                                                                                                                                                                                                         |
| `completeAssessment`    | `POST /api/assessments/:assessmentId/complete` | Marks the assessment completed, saves a `BehavioralFeature` document, runs `compareAgainstBaseline` to compute deviation, updates the baseline via `updateBaselineAfterAssessment`, and calls `featureExtractionService.enqueueExtraction()` to schedule AI feature extraction from the webcam/screen recordings. Returns `{ assessment, behavioralFeature, deviation }`. |
| `getAssessmentsForUser` | `GET /api/assessments/user/:userId`            | Lists all assessments for a user sorted newest-first.                                                                                                                                                                                                                                                                                                                     |
| `getAssessmentById`     | `GET /api/assessments/:assessmentId`           | Returns an assessment with its joined `BehavioralFeature` and `AssessmentResponse`.                                                                                                                                                                                                                                                                                       |

#### `backend/controllers/responseController.js`

| Function        | Route                              | Description                                                                                                                            |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `saveResponses` | `POST /api/responses`              | Upserts the `AssessmentResponse` document for a given `assessmentId`. Called by each assessment page just before `completeAssessment`. |
| `getResponses`  | `GET /api/responses/:assessmentId` | Returns the response document.                                                                                                         |

#### `backend/controllers/mediaController.js`

| Function                | Route                          | Description                                                                                                                                                                                     |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uploadRecording`       | `POST /api/media/upload`       | Receives a `multipart/form-data` upload (via Multer), calls `uploadToStorage()` to push the buffer to ImageKit, then upserts a `Media` document for the assessment with the resulting metadata. |
| `getMediaForAssessment` | `GET /api/media/:assessmentId` | Returns the media metadata document for an assessment.                                                                                                                                          |

#### `backend/controllers/baselineController.js`

| Function             | Route                        | Description                                                                                         |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `getBaselineForUser` | `GET /api/baselines/:userId` | Returns the participant's `Baseline` document, or 404 if they haven't completed any assessment yet. |

#### `backend/controllers/adminController.js`

The largest controller. All functions except `adminLogin` require the `adminAuth` middleware.

| Function              | Route                                   | Description                                                                                                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adminLogin`          | `POST /api/admin/login`                 | Compares `adminId` and `password` against `ADMIN_ID` / `ADMIN_PASSWORD` env vars. On success, signs an 8-hour JWT with `JWT_SECRET` and returns it. Logs the event with IP and timestamp.                                                                                                                                                 |
| `adminLogout`         | `POST /api/admin/logout`                | Logs the logout event. Token invalidation happens client-side (sessionStorage is cleared).                                                                                                                                                                                                                                                |
| `adminProfile`        | `GET /api/admin/profile`                | Returns `{ adminId }` from the JWT payload. Used by the dashboard to display the signed-in admin.                                                                                                                                                                                                                                         |
| `getOverview`         | `GET /api/admin/overview`               | Returns aggregate counts: total users, total assessments, completed assessments, and a breakdown by assessment type.                                                                                                                                                                                                                      |
| `getUsersWithSummary` | `GET /api/admin/users`                  | Returns all participants with computed summary fields. Supports query parameters: `search` (name / email / userId), `assessmentType`, `calibration` (yes/no), `finalAssessment` (yes/no), `dateFrom`, `dateTo`.                                                                                                                           |
| `getUserDetails`      | `GET /api/admin/users/:userId/details`  | Full drill-down for one participant: user profile, all assessments, all client-captured behavioral feature documents, all AI-extracted behavior feature documents, all responses, media metadata, baseline, and consent history.                                                                                                          |
| `exportDataset`       | `GET /api/admin/export`                 | Builds one unified row per assessment — joining user, assessment, media, client-captured behavioral features, AI-extracted webcam/screen features, and responses — via `exportService.js`. Responds as a downloadable CSV (`format=csv`) or JSON (`format=json`) file. See [Export Pipeline](#export-pipeline-unified-json--csv-dataset). |
| `deleteUser`          | `DELETE /api/admin/users/:userId`       | Runs the deletion sequence (see [Participant Deletion](#6-participant-deletion)) for one user and logs the action.                                                                                                                                                                                                                        |
| `deleteSelectedUsers` | `POST /api/admin/users/delete-selected` | Accepts `{ userIds: string[] }` and runs the deletion sequence for each user in series.                                                                                                                                                                                                                                                   |
| `clearAllData`        | `POST /api/admin/clear-all`             | Requires `{ confirmation: "DELETE ALL DATA" }` in the body. Deletes all ImageKit files then drops all MongoDB documents from every collection (including `extractedbehaviorfeatures`). Logs the action with counts.                                                                                                                       |

The private helper `deleteUserById(userId)` is shared by all three deletion endpoints. It:

1. Finds all `Media` records for the user.
2. Extracts `imagekitFileId` values from `cameraRecording` and `screenRecording`.
3. Calls `deleteFromStorage()` for each file ID (errors are swallowed to avoid failing the entire deletion if a file was already removed).
4. Runs `deleteMany` in parallel across: `Media`, `BehavioralFeature`, `ExtractedBehaviorFeature`, `AssessmentResponse`, `Consent`, `Baseline`, `Assessment`.
5. Deletes the `User` document last.
6. Returns per-collection deleted counts.

---

### Routes

Each route file creates an Express `Router`, wires handler functions to HTTP method + path pairs, and exports the router. `server.js` mounts them at their prefix.

| File                  | Prefix             | Key routes                                                                                                                                                                                                                                                      |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userRoutes.js`       | `/api/users`       | `POST /register`, `GET /`, `GET /:userId`                                                                                                                                                                                                                       |
| `consentRoutes.js`    | `/api/consent`     | `POST /`, `GET /:consentId`                                                                                                                                                                                                                                     |
| `assessmentRoutes.js` | `/api/assessments` | `POST /start`, `POST /:id/complete`, `GET /user/:userId`, `GET /:id`                                                                                                                                                                                            |
| `responseRoutes.js`   | `/api/responses`   | `POST /`, `GET /:assessmentId`                                                                                                                                                                                                                                  |
| `mediaRoutes.js`      | `/api/media`       | `POST /upload` (Multer memory storage, 200 MB limit), `GET /:assessmentId`                                                                                                                                                                                      |
| `baselineRoutes.js`   | `/api/baselines`   | `GET /:userId`                                                                                                                                                                                                                                                  |
| `adminRoutes.js`      | `/api/admin`       | Public: `POST /login`. Protected (adminAuth applied to everything after): `POST /logout`, `GET /profile`, `GET /overview`, `GET /users`, `GET /users/:userId/details`, `GET /export`, `DELETE /users/:userId`, `POST /users/delete-selected`, `POST /clear-all` |

`adminRoutes.js` applies `adminAuth` middleware via `router.use(adminAuth)` after the `/login` route, ensuring every subsequent route definition in the file is automatically protected.

---

### Middleware

#### `backend/middleware/adminAuth.js`

Exports:

- `adminAuth(req, res, next)` — reads the `Authorization: Bearer <token>` header, calls `jwt.verify()` with `JWT_SECRET`, and attaches the decoded payload (`{ adminId }`) to `req.admin`. Returns 401 if the header is missing, the token is malformed, or the token is expired.
- `JWT_SECRET` — the signing secret (re-exported so `adminController.js` can sign tokens with the same value without duplicating the env-var read).

#### `backend/middleware/errorMiddleware.js`

- `notFound(req, res, next)` — sets status 404 and forwards an error with the unmatched URL. Mounted after all routes.
- `errorHandler(err, req, res, next)` — global error handler. Reads `res.statusCode` (set by controllers before throwing) and serialises `{ message, stack }` to JSON. Stack trace is omitted in production.

---

### Services

#### `backend/services/baselineService.js`

Pure business-logic module; has no HTTP awareness and is called directly by `assessmentController.js`.

**`updateBaselineAfterAssessment({ userId, assessmentType, featureVector })`**

Reads the existing `Baseline` document (or creates one), increments `sampleCount`, and recalculates nine running averages using the formula `(prevAvg × prevCount + newValue) / (prevCount + 1)`. The private `pick(vector, paths)` helper extracts a metric from the feature vector by trying multiple dot-notation paths (different assessment types nest metrics slightly differently). Saves and returns the updated baseline.

**`compareAgainstBaseline({ userId, assessmentType, featureVector })`**

If a baseline with at least one sample exists, computes the percentage deviation of each metric from its baseline average: `((current − baseline) / baseline) × 100`. Returns `{ hasBaseline: true, deviations: { metricName: { baseline, current, percentChange } } }` or `{ hasBaseline: false, deviations: null }` for first-time participants.

Both functions are called inside `completeAssessment`: comparison happens first (before the new session pollutes the baseline), then `update` is called.

#### `backend/services/featureExtractionService.js`

Owns all AI feature-extraction logic. See [Behavioral Feature Extraction Pipeline](#behavioral-feature-extraction-pipeline-webcam--screen-ai-features) for full detail. Exports:

- `enqueueExtraction({ assessmentId })` — called by `completeAssessment` for live traffic.
- `enqueueAndWait({ assessmentId })` — called by the backfill script for assessments with no `ExtractedBehaviorFeature` document yet.
- `enqueueIncrementalUpgrade({ assessmentId })` — called by the backfill script for already-processed-but-outdated documents; re-runs the analyzer but preserves existing non-null field values.

All three resolve to the same private `_processAssessment()` function running on the same job queue — there is exactly one implementation of the extraction logic, shared by live and historical paths.

#### `backend/services/exportService.js`

Builds the unified per-assessment export row consumed by `GET /api/admin/export`. See [Export Pipeline](#export-pipeline-unified-json--csv-dataset).

---

## Frontend — File Reference

### Entry Point & Root

#### `frontend/index.html`

Standard Vite HTML shell. Contains `<div id="root">` where React mounts.

#### `frontend/src/main.jsx`

Bootstraps the React application:

```
<React.StrictMode>
  <BrowserRouter>          ← React Router context
    <SessionProvider>      ← participant session state
      <App />
    </SessionProvider>
  </BrowserRouter>
</React.StrictMode>
```

Imports `index.css` (Tailwind directives + CSS custom properties for the design system).

#### `frontend/src/App.jsx`

Defines all client-side routes and wraps everything in `<AdminProvider>`:

```
<AdminProvider>
  <Routes>
    /                     → RegisterPage        (public)
    /consent/:type        → ConsentPage         (public)
    /hub                  → HubPage             (public, checks session)
    /assessment/mcq       → McqAssessmentPage   (public, checks session)
    /assessment/coding    → CodingAssessmentPage
    /assessment/typing    → TypingAssessmentPage
    /complete             → CompletePage

    /admin/login          → AdminLoginPage      (public)
    /admin                → AdminDashboardPage  (RequireAdmin guard)
    /admin/users/:userId  → AdminUserDetailPage (RequireAdmin guard)

    *                     → Navigate to /
  </Routes>
</AdminProvider>
```

`RequireAdmin` wraps the two protected admin routes. Participant routes do not use `RequireAdmin`; they perform their own soft redirects (e.g., `if (!user) navigate("/")`).

---

### Context Providers

#### `frontend/src/context/SessionContext.jsx`

Manages participant identity across the assessment flow. Persists the user object in `localStorage` so a page refresh doesn't log the participant out mid-assessment.

Exports `SessionProvider` and the `useSession()` hook.

State: `user` (the registered participant object), `consent` (the active consent document for the current assessment type).

Methods:

- `loginUser(userObj)` — stores the user in state and localStorage.
- `logout()` — clears state and localStorage.
- `setConsent(consentObj)` — used by `ConsentPage` to pass the created consent ID to the assessment page.

**Used by:** `RegisterPage`, `ConsentPage`, `HubPage`, all three assessment pages.

#### `frontend/src/context/AdminContext.jsx`

Manages administrator authentication state. Stores the JWT in `sessionStorage` (cleared when the browser tab closes, limiting exposure if the tab is left open).

Exports `AdminProvider` and the `useAdmin()` hook.

State: `token` (JWT string), `adminId` (admin identifier from the login response), `isAdminAuthenticated` (boolean).

Methods:

- `loginAdmin(token, adminId)` — writes to sessionStorage and state.
- `logoutAdmin()` — clears sessionStorage and state.

**Used by:** `App.jsx`, `RequireAdmin`, `AdminLoginPage`, `AdminDashboardPage`.

---

### API Client

#### `frontend/src/api/client.js`

Creates and exports a single Axios instance configured with `VITE_API_BASE_URL` as its `baseURL`.

An Axios request interceptor runs before every outgoing call:

```js
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("abeis_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

This means all pages — including assessment pages — automatically include the admin JWT if one is present. Admin-only endpoints reject requests that lack a valid token at the middleware level regardless; the interceptor just ensures the header is always there when it exists.

**Imported by:** every page and the `useMediaRecording` hook.

---

### Pages

#### `frontend/src/pages/RegisterPage.jsx`

**Route:** `/`

The platform landing page. Renders two primary call-to-action buttons:

- **Start Assessment** — scrolls to the registration form.
- **Admin Login** — navigates to `/admin/login`.

The registration form collects `name` and `email`, posts to `POST /api/users/register`, and on success calls `loginUser()` and navigates to `/hub`.

#### `frontend/src/pages/ConsentPage.jsx`

**Route:** `/consent/:assessmentType`

Two-phase page:

1. **Permission phase** — renders a "Check Permissions" button that calls `media.requestPermissions()` (from `useMediaRecording`). Both camera and screen permissions must be `"granted"` to proceed.
2. **Consent phase** — renders the 8 consent statements as checkboxes. All must be checked and both permissions must be granted before the "Begin Assessment" button is enabled.

On submit, posts to `POST /api/consent` with the permission statuses, browser info, and acknowledged statements. Stores the returned consent object in `SessionContext` via `setConsent()`, then navigates to the assessment page for the chosen type.

**Uses:** `useSession`, `useMediaRecording`.

#### `frontend/src/pages/HubPage.jsx`

**Route:** `/hub`

Shows the logged-in participant's name and three assessment cards (MCQ, Coding, Typing). Clicking a card navigates to `/consent/:assessmentType`. If no user is in session, immediately redirects to `/`.

#### `frontend/src/pages/McqAssessmentPage.jsx`

**Route:** `/assessment/mcq`

Starts an assessment session (`POST /api/assessments/start`) on mount, then presents 5 multiple-choice questions one at a time. Tracks per-question response time. Attaches mouse, keyboard, and session tracking hooks for the full duration. On "Submit":

1. Posts answers to `POST /api/responses`.
2. Calls `assessment.completeAssessment()` with the aggregated feature vector from all three tracking hooks.
3. Navigates to `/complete`.

Does not use `useMediaRecording` directly — recordings are started on the consent page and uploaded from there (upload is triggered on stop by the hook itself, called from the assessment page's `useEffect` cleanup).

#### `frontend/src/pages/CodingAssessmentPage.jsx`

**Route:** `/assessment/coding`

Two-question structure: (1) an independent coding problem (write from scratch), and (2) a transcription task (copy a provided solution exactly). Measures `backspaceCount`, `copyPasteAttempts`, and `corrections` per question. Otherwise the same start/track/submit pattern as MCQ.

#### `frontend/src/pages/TypingAssessmentPage.jsx`

**Route:** `/assessment/typing`

Two tasks: (1) type a plain prose paragraph, (2) type a paragraph dense with numbers and symbols. Computes `wpm` and `accuracy` in real time. Records per-task `sourceText`, `typedText`, and timing.

#### `frontend/src/pages/CompletePage.jsx`

**Route:** `/complete`

Simple confirmation screen shown after a successful assessment submission.

#### `frontend/src/pages/AdminLoginPage.jsx`

**Route:** `/admin/login`

Renders a login form with Admin ID and Password fields. Posts to `POST /api/admin/login`. On success, calls `loginAdmin(token, adminId)` from `AdminContext` and navigates to `/admin`. Displays `"Invalid Admin ID or Password."` on a 401. Includes a "← Back to Landing Page" link.

#### `frontend/src/pages/AdminDashboardPage.jsx`

**Route:** `/admin` (protected by `RequireAdmin`)

The main research control panel. Key features:

- **Header** — displays the signed-in `adminId`, Export CSV / Export JSON buttons, a Clear Dataset button, and a Logout button.
- **Overview cards** — registered users, total assessments, completed assessments, breakdown by type (fetched from `GET /api/admin/overview`).
- **Advanced filter bar** — search text, assessment type dropdown, calibration filter, final assessment filter, date-from and date-to date pickers. Submitting the form re-fetches `GET /api/admin/users` with the active query parameters.
- **User table** — columns: checkbox, User ID, Name, Email, Registration Date, Total Assessments, Calibration (Yes/No badge), Final Assessment (Yes/No badge), Last Assessment Date, Actions (View / Delete). Supports select-all.
- **Bulk delete** — once one or more checkboxes are selected, a "Delete Selected" banner appears. Clicking it opens a confirmation modal.
- **Delete single** — clicking "Delete" in a row opens a confirmation modal listing all data types that will be removed.
- **Clear Dataset** — opens a modal requiring the administrator to type `DELETE ALL DATA` before proceeding.
- **Export** — uses `fetch` with the `Authorization` header (since `window.open` cannot set headers) to download the file as a blob and trigger a browser save dialog.

Logout calls `POST /api/admin/logout`, then `logoutAdmin()`, then navigates to `/admin/login`.

#### `frontend/src/pages/AdminUserDetailPage.jsx`

**Route:** `/admin/users/:userId` (protected by `RequireAdmin`)

Fetches `GET /api/admin/users/:userId/details` on mount and renders sections for: Baselines, Assessment History, Behavioral Features (client-captured), AI-Extracted Webcam/Screen Features, Assessment Responses, Media Recordings, and Consent History. Includes a **Delete User** button in the header that opens the same confirmation dialog as the dashboard's single-delete flow. On confirmed deletion, navigates back to `/admin`.

---

### Hooks

#### `frontend/src/hooks/useMouseTracking.js`

Exports `useMouseTracking()`. Call `attach()` once in a `useEffect` to add DOM event listeners; call `getSummary()` at submission time to receive an aggregated `mouse` feature sub-object.

Tracks: `totalMovement`, `avgSpeed`, `maxSpeed`, `acceleration`, `clickFrequency`, `doubleClicks` (< 350 ms gap), `rightClicks`, `dragEvents`, `scrollEvents`, `scrollDistance`, `cursorSmoothness`. Raw positions are capped at 5 000 entries to bound memory usage.

#### `frontend/src/hooks/useKeyboardTracking.js`

Exports `useKeyboardTracking()`. Same `attach()` / `getSummary()` pattern.

Tracks: `avgKeyPressDuration`, `avgInterKeyLatency`, `typingRhythmVariance`, `keyFrequency` (per-key count map), `errorRate`, `backspaceCount`, `deleteCount`, `shiftUsageCount`, `ctrlComboCount`, `copyAttempts`, `pasteAttempts`.

#### `frontend/src/hooks/useSessionTracking.js`

Exports `useSessionTracking()`. Hooks into `visibilitychange`, `focus`, `blur`, `fullscreenchange`, and a periodic idle-check interval.

Tracks: `idleTimeMs`, `idlePeriodsCount`, `focusChanges`, `tabSwitches`, `fullscreenExits`, `sessionDurationMs`. Also captures static device/browser metadata (`browser`, `device`, `screenResolution`) and runs a network latency probe by timing a `HEAD` request to the API root.

#### `frontend/src/hooks/useMediaRecording.js`

Exports `useMediaRecording()`. Manages both `getUserMedia` (camera) and `getDisplayMedia` (screen).

Key methods:

- `requestPermissions()` — requests both streams and returns `{ camGranted, screenGranted }`. Used by `ConsentPage`.
- `startRecording()` — creates two `MediaRecorder` instances and starts them.
- `stopAndUpload({ assessmentId, userId, sessionId, assessmentType })` — stops both recorders, waits for the final `ondataavailable` events, assembles the blobs, and posts each to `POST /api/media/upload` as `multipart/form-data`. Returns media metadata.

Exposes `cameraPermission`, `screenPermission` state for the consent UI, and `previewStream` so `ConsentPage` can render a live camera preview.

---

### Components

#### `frontend/src/components/RequireAdmin.jsx`

A simple route-guard component. Reads `isAdminAuthenticated` from `AdminContext`. If false, redirects to `/admin/login` (preserving the attempted location in router state so a future enhancement could redirect back after login). If true, renders `{children}`.

**Used by:** `App.jsx`, wrapping `/admin` and `/admin/users/:userId` routes.

---

## Data Flow — End-to-End Walkthroughs

### 1. Participant Registration

```
RegisterPage
  └─ POST /api/users/register  { name, email }
       └─ userController.registerUser
            └─ User.findOne({ email }) → existing? return user
                                       → new?      User.create → 201
  └─ SessionContext.loginUser(user)   ← stored in localStorage
  └─ navigate("/hub")
```

### 2. Consent & Permission Grant

```
HubPage → navigate("/consent/mcq")

ConsentPage
  └─ useMediaRecording.requestPermissions()
       └─ getUserMedia({ video }) → cameraPermission = "granted"
       └─ getDisplayMedia({ video }) → screenPermission = "granted"
  └─ POST /api/consent  { userId, sessionId, acknowledgedStatements, permissions, browserInfo }
       └─ consentController.recordConsent
            └─ validates all 8 statements = true
            └─ validates both permissions = "granted"
            └─ Consent.create(...)  → consentId
  └─ SessionContext.setConsent(consentDoc)
  └─ navigate("/assessment/mcq")
```

### 3. Assessment Session

```
McqAssessmentPage (mounts)
  └─ POST /api/assessments/start  { userId, assessmentType, consentId }
       └─ assessmentController.startAssessment
            └─ Consent.findOne → valid?
            └─ Assessment.create({ status: "in_progress" })  → assessmentId

  [hooks attach to DOM]
  useMouseTracking.attach()
  useKeyboardTracking.attach()
  useSessionTracking.attach()
  useMediaRecording.startRecording()

  [participant answers questions]

McqAssessmentPage (submit)
  └─ POST /api/responses  { assessmentId, mcqResponses }
       └─ AssessmentResponse.findOneAndUpdate (upsert)

  └─ useMouseTracking.getSummary()   ┐
  └─ useKeyboardTracking.getSummary() ├─ merged into featureVector
  └─ useSessionTracking.getSummary() ┘

  └─ useMediaRecording.stopAndUpload(...)
       └─ POST /api/media/upload (camera blob)
            └─ imagekit.uploadToStorage → Media.findOneAndUpdate (upsert)
       └─ POST /api/media/upload (screen blob)
            └─ imagekit.uploadToStorage → Media.findOneAndUpdate (upsert)

  └─ POST /api/assessments/:id/complete  { featureVector }
       └─ assessmentController.completeAssessment
            └─ Assessment.save({ status: "completed", endedAt, duration })
            └─ BehavioralFeature.create({ featureVector })
            └─ baselineService.compareAgainstBaseline(...)  → deviation
            └─ baselineService.updateBaselineAfterAssessment(...)
            └─ featureExtractionService.enqueueExtraction({ assessmentId })
                 └─ (async, off the request/response cycle) downloads
                    webcam + screen recordings in parallel, runs the
                    Python analyzers, writes ExtractedBehaviorFeature
            └─ return { assessment, behavioralFeature, deviation }

  └─ navigate("/complete")
```

### 4. Behavioral Data Submission

The client-captured feature vector flows from three hooks → assessment page → `POST /api/assessments/:id/complete` → `BehavioralFeature.create` → `baselineService`. The vector never touches `AssessmentResponse` (which stores answers, not signals) or `Media` (which stores recording URLs, not behavioral data). Separately and asynchronously, the same `completeAssessment` call enqueues AI feature extraction, which reads the `Media` document's recording URLs and writes an independent `ExtractedBehaviorFeature` document. All of these documents reference the same `assessmentId` and `userId`, making them joinable on demand — this is exactly what the export pipeline does.

### 5. Admin Login & Dashboard

```
AdminLoginPage
  └─ POST /api/admin/login  { adminId, password }
       └─ adminController.adminLogin
            └─ compare against ADMIN_ID / ADMIN_PASSWORD env vars
            └─ jwt.sign({ adminId }, JWT_SECRET, { expiresIn: "8h" })
            └─ return { token, adminId }
  └─ AdminContext.loginAdmin(token, adminId)  → sessionStorage
  └─ navigate("/admin")

AdminDashboardPage (mounts)
  └─ api.get("/admin/overview")          ← Authorization: Bearer <token>
  └─ api.get("/admin/users")
       └─ adminAuth middleware verifies JWT on every request
       └─ adminController.getOverview / getUsersWithSummary
```

The Axios interceptor in `client.js` reads the token from sessionStorage and injects `Authorization: Bearer <token>` automatically on every request. The `adminAuth` middleware on the backend verifies the token on every protected route without any further configuration needed in individual controllers.

### 6. Participant Deletion

```
AdminDashboardPage → click Delete → confirm dialog → DELETE /api/admin/users/:userId

adminController.deleteUser
  └─ User.findOne(userId) → 404 if not found
  └─ deleteUserById(userId):
       1. Media.find({ userId }) → all media records
       2. extract imagekitFileId from cameraRecording + screenRecording
       3. imagekit.deleteFile(fileId) × N  (errors swallowed)
       4. Media.deleteMany({ userId })
       5. BehavioralFeature.deleteMany({ userId })
       6. ExtractedBehaviorFeature.deleteMany({ userId })
       7. AssessmentResponse.deleteMany({ userId })
       8. Consent.deleteMany({ userId })
       9. Baseline.deleteMany({ userId })
      10. Assessment.deleteMany({ userId })
      11. User.deleteOne({ userId })
  └─ console.log audit entry (adminId, userId, counts, IP, timestamp)
  └─ 200 { message, deleted, counts }
```

---

## API Reference

### Participant APIs (public)

| Method | Path                            | Body / Query                                                                                                          | Response                                       |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| POST   | `/api/users/register`           | `{ name, email }`                                                                                                     | `{ user, isReturningUser }`                    |
| GET    | `/api/users/:userId`            | —                                                                                                                     | `User`                                         |
| POST   | `/api/consent`                  | `{ userId, sessionId, acknowledgedStatements, cameraPermissionStatus, screenRecordingPermissionStatus, browserInfo }` | `Consent`                                      |
| GET    | `/api/consent/:consentId`       | —                                                                                                                     | `Consent`                                      |
| POST   | `/api/assessments/start`        | `{ userId, assessmentType, consentId, meta? }`                                                                        | `Assessment`                                   |
| POST   | `/api/assessments/:id/complete` | `{ featureVector, rawEvents? }`                                                                                       | `{ assessment, behavioralFeature, deviation }` |
| GET    | `/api/assessments/user/:userId` | —                                                                                                                     | `Assessment[]`                                 |
| GET    | `/api/assessments/:id`          | —                                                                                                                     | `{ assessment, feature, response }`            |
| POST   | `/api/responses`                | `{ assessmentId, userId, sessionId, assessmentType, mcqResponses?, codingResponses?, typingResponses? }`              | `AssessmentResponse`                           |
| GET    | `/api/responses/:assessmentId`  | —                                                                                                                     | `AssessmentResponse`                           |
| POST   | `/api/media/upload`             | `multipart/form-data: file, assessmentId, userId, sessionId, assessmentType, recordingType, duration`                 | `{ media, recordingMeta }`                     |
| GET    | `/api/media/:assessmentId`      | —                                                                                                                     | `Media`                                        |
| GET    | `/api/baselines/:userId`        | —                                                                                                                     | `Baseline`                                     |

### Admin APIs (all except `/login` require `Authorization: Bearer <token>`)

| Method | Path                               | Body / Query                                                                             | Response                                                                                   |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/api/admin/login`                 | `{ adminId, password }`                                                                  | `{ token, adminId }`                                                                       |
| POST   | `/api/admin/logout`                | —                                                                                        | `{ message }`                                                                              |
| GET    | `/api/admin/profile`               | —                                                                                        | `{ adminId }`                                                                              |
| GET    | `/api/admin/overview`              | —                                                                                        | `{ userCount, assessmentCount, completedCount, byType }`                                   |
| GET    | `/api/admin/users`                 | `?search=&assessmentType=&calibration=yes\|no&finalAssessment=yes\|no&dateFrom=&dateTo=` | `UserSummary[]`                                                                            |
| GET    | `/api/admin/users/:userId/details` | —                                                                                        | `{ user, assessments, features, extractedFeatures, responses, media, baseline, consents }` |
| GET    | `/api/admin/export`                | `?format=csv\|json&assessmentType=`                                                      | File download (see [Export Pipeline](#export-pipeline-unified-json--csv-dataset))          |
| DELETE | `/api/admin/users/:userId`         | —                                                                                        | `{ message, deleted, counts }`                                                             |
| POST   | `/api/admin/users/delete-selected` | `{ userIds: string[] }`                                                                  | `{ message, deleted, counts }`                                                             |
| POST   | `/api/admin/clear-all`             | `{ confirmation: "DELETE ALL DATA" }`                                                    | `{ message, counts }`                                                                      |

---

## MongoDB Collections

| Collection                  | Model file                    | Primary index                                           | Notes                                                                                                             |
| --------------------------- | ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `users`                     | `User.js`                     | `userId`, `email`                                       | One document per participant                                                                                      |
| `consents`                  | `Consent.js`                  | `consentId`, `userId`, `sessionId`                      | One per consent event; multiple per participant                                                                   |
| `assessments`               | `Assessment.js`               | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment session                                                                                        |
| `behavioralfeatures`        | `BehavioralFeature.js`        | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per completed assessment; client-captured mouse/keyboard/session/typing/coding signals                        |
| `extractedbehaviorfeatures` | `ExtractedBehaviorFeature.js` | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment; AI-derived webcam/screen signals, populated asynchronously by the feature-extraction pipeline |
| `assessmentresponses`       | `AssessmentResponse.js`       | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment (upserted)                                                                                     |
| `media`                     | `Media.js`                    | `assessmentId`, `userId`, `sessionId`, `assessmentType` | One per assessment (upserted); holds ImageKit metadata                                                            |
| `baselines`                 | `Baseline.js`                 | `userId` (unique)                                       | One per participant; updated after every assessment                                                               |

All collections use `userId` as the common foreign key, making cross-collection joins and deletion straightforward without relational constraints.

---

## Behavioral Feature Extraction Pipeline (Webcam & Screen AI Features)

Processes completed assessments' webcam and screen recordings into numerical behavioral feature vectors, stored in `ExtractedBehaviorFeatures`, linked by `assessmentId`/`userId`/`sessionId`/`assessmentType`, and folded into the unified export for baseline generation and ML training.

Current version adds 14 new webcam metrics and 11 new screen metrics on top of the original v1 set, an incremental backfill upgrade path that fills in missing fields on already-processed recordings without touching their existing values, and per-stage pipeline logging. Nothing in v1's public behavior (endpoints, collections, field names) was removed or renamed.

### Pipeline Consistency Guarantee

`enqueueExtraction` (called by `completeAssessment` for live traffic), `enqueueAndWait` (called by the backfill script for never-processed assessments), and `enqueueIncrementalUpgrade` (called by the backfill script for already-processed-but-outdated assessments) all resolve to the same private `_processAssessment()` function running on the same job queue instance — one webcam analyzer, one screen analyzer, one Mongo write path. There is no second implementation to drift out of sync.

**Logging.** `featureExtractionService._processAssessment()` logs each stage explicitly:

```
[extract:<assessmentId>] Assessment: starting full extraction
[extract:<assessmentId>] Downloading webcam recording: ✓ success
[extract:<assessmentId>] Downloading screen recording: ✓ success
[extract:<assessmentId>] Running webcam analyzer: ✓ success
[extract:<assessmentId>] Running screen analyzer: ✓ success
[extract:<assessmentId>] Parsing Python output: ✓ success
[extract:<assessmentId>] Saving features to MongoDB: ✓ success
```

On failure, the exact stage and exception message are logged (`✘ FAILED — <error message>`) and the document's `status` flips to `"failed"` with `lastError` populated — no error is ever swallowed silently; every catch block either logs-and-rethrows or is a deliberate "this recording legitimately has no camera track" skip, never a bare `catch {}`.

Both analyzers are invoked whenever their corresponding recording URL exists (not conditionally skipped for other reasons); a missing `Media` document or a `Media` document with neither URL fails loudly (`throw`, not a silent skip); and downloads/analyzer calls run in parallel (`Promise.all`) for both live and historical paths identically.

### Live Extraction "Stuck in Processing" Bug Fix (v3)

**Symptom (pre-fix):** after a participant completed an assessment, `completeAssessment()` called `enqueueExtraction()`, an `ExtractedBehaviorFeature` document was created with `status: "processing"`, and it stayed there indefinitely — the webcam/screen features were never populated — until an administrator manually ran `npm run backfill`, at which point extraction succeeded immediately. Because `npm run backfill` always worked, MediaPipe, OpenCV, the Python worker, and the MongoDB update logic were all confirmed working; the defect was isolated to the **live enqueue path only**.

**Confirmed root cause — two compounding bugs in `backend/services/featureExtractionService.js`:**

1. **The `try`/`catch` in `_processAssessment()` didn't wrap the `Media` lookup.** Status was flipped to `"processing"` and _then_ the code looked up the `Media` document and validated its recording URLs — both **before** the `try` block began:

   ```js
   await ExtractedBehaviorFeature.updateOne({ assessmentId }, { $set: { status: "processing" }, ... });

   const media = await Media.findOne({ assessmentId });   // ← outside try
   if (!media) {
     throw new Error(`No Media document found for assessmentId=${assessmentId}`); // ← escapes uncaught
   }
   ...
   try { /* download + analyze + save only */ } catch (err) { ...status: "failed"... }
   ```

   If `Media.findOne` returned nothing — plausible on the very first live attempt, since the frontend's camera/screen blob uploads and the `/complete` call happen in close succession with no backend-enforced ordering guarantee — the `throw` happened **outside** the `try`/`catch`. It propagated out of `_processAssessment()` entirely, and the only thing catching it was `enqueueExtraction()`'s dangling `.catch()`, which only does `console.error(...)`. **The document was never touched again: stuck at `"processing"` forever, with no `lastError`.**

2. **`enqueueExtraction()`'s idempotency guard had no time bound.** It treated any existing `"pending"` or `"processing"` document as "already being handled, don't touch":
   ```js
   if (
     existing &&
     ["pending", "processing", "completed"].includes(existing.status)
   ) {
     return existing; // no-op — forever, once stuck
   }
   ```
   So once a document was stuck at `"processing"` by bug #1, **no future live-path call could ever re-enqueue it** — it was permanently poisoned from that entrypoint's perspective. `enqueueAndWait()` (used only by `scripts/backfillExtraction.js`) has a looser guard that only skips `status === "completed"`, so it was the only code path willing to touch a stuck document at all — which is the entire reason `npm run backfill` "fixed" it: not because backfill does anything different with the video, but because it's the only entrypoint that would re-run `_processAssessment()` against a non-`"completed"` document in the first place.

**Fix applied (in `backend/services/featureExtractionService.js`):**

- The `try` block now starts immediately after the `status: "processing"` update and wraps the `Media` lookup and URL validation along with everything else. Every failure from that point on — Media not found, no recording URLs, download failure, analyzer failure, save failure — funnels through the same `catch`, which always writes `status: "failed"` with `lastError` populated. A document can no longer escape uncaught and get stuck in limbo.
- `Media.findOne` is now wrapped in `_findMediaWithRetry()` — up to 4 attempts, 3 seconds apart — before giving up. This directly addresses the likely trigger (the upload/complete race) rather than only catching its consequence, so the common case now succeeds without ever needing a retry at all.
- `enqueueExtraction()`'s guard now calls a new `_isStale(doc)` check (10-minute threshold, based on the document's Mongoose `updatedAt`): a `"pending"`/`"processing"` document older than that is treated as an abandoned job and is re-enqueued, exactly like `enqueueAndWait()` already would. This makes the **live path self-healing** — a stuck document now clears itself on the next live trigger for that assessment (e.g., an admin "retry" action) without requiring `npm run backfill` at all — while a genuinely in-flight job (updated recently) still isn't double-enqueued.

**Operational check:** to confirm no assessments are currently stuck, run:

```js
db.extractedbehaviorfeatures.find({
  status: { $in: ["pending", "processing"] },
  updatedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) },
});
```

Any result is now something the live path itself will clear on its own next trigger (see `_isStale`/`STALE_PROCESSING_MS` above) — but a persistently non-empty result over time is still worth alerting on, since it means jobs are failing to complete for some other, new reason.

### Webcam Features

All new fields are computed inside the _same_ single-pass MediaPipe/OpenCV loop already being run — no second video pass, no additional heavy model.

| Group                     | Field                                                                                                                                                                         | What it measures                                                                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Face detection (existing) | `blinkRate`, `blinkCount`, `screenAttention`, `lookAwayCount`, `averagePitch`, `averageYaw`, `averageRoll`, `headMovementVariance`, `faceVisiblePercentage`, `eyeClosureRate` | Original v1 metrics, unchanged                                                                                                                                                                                                                |
| Face detection (new)      | `averageFaceConfidence`                                                                                                                                                       | Mean MediaPipe Face Detection score across frames where a face was found. _(New: Face Mesh alone has no confidence score, so one lightweight `mp.solutions.face_detection` call per frame was added — still MediaPipe, no new model family.)_ |
|                           | `continuousFaceLossCount`                                                                                                                                                     | Number of distinct runs of ≥3 consecutive frames with **no face detected at all** (camera blocked, participant left frame, etc.)                                                                                                              |
|                           | `maximumFaceLossDuration`                                                                                                                                                     | Longest such run, in seconds                                                                                                                                                                                                                  |
| Blink behaviour (new)     | `averageBlinkDuration` / `maximumBlinkDuration`                                                                                                                               | Mean/max blink duration in ms (previously only the count/rate were exposed)                                                                                                                                                                   |
|                           | `blinkIntervalVariance`                                                                                                                                                       | Variance of the time gaps between blinks — a rhythm-regularity signal                                                                                                                                                                         |
| Eye gaze (new)            | `screenAttentionPercentage`                                                                                                                                                   | Same computation as the existing `screenAttention` field, added under this name for consistency with the v2 naming convention (intentional duplicate — both are populated identically)                                                        |
|                           | `averageLookAwayDuration` / `maximumLookAwayDuration`                                                                                                                         | Mean/max duration of a look-away run, in seconds                                                                                                                                                                                              |
| Head pose (new)           | `pitchStdDeviation` / `yawStdDeviation` / `rollStdDeviation`                                                                                                                  | Standard deviation of each pose angle individually (previously only combined into one `headMovementVariance` figure)                                                                                                                          |
| Head motion (new)         | `averageHeadSpeed` / `maximumHeadSpeed`                                                                                                                                       | Angular speed (degrees/second) between consecutive valid pose readings                                                                                                                                                                        |

**Refinement:** v1 conflated "no face detected" and "face detected but looking away" into one `lookAwayCount` counter. The pipeline now tracks these as two separate run-trackers, so `continuousFaceLossCount` (face absent) and `lookAwayCount` (face present, head turned) measure genuinely different things. `lookAwayCount`'s _meaning_ is slightly narrower than before as a result — worth knowing if you're comparing pre- and post-upgrade values for the same assessment.

**Bug fixed along the way:** blink/away/face-loss durations were being computed assuming every _processed_ frame is exactly `1/fps` apart, which undercounts durations on long videos where frame sampling skips raw frames (see `MAX_SAMPLED_FRAMES`). Now computed via an explicit `seconds_per_sample` that accounts for the actual sampling stride.

### Face Position & Gaze Features (v3)

Computed inside the same single-pass MediaPipe loop as every other webcam metric — no second video pass, no new model family beyond what's already listed above (Face Detection + Face Mesh/Iris landmarks). All previously existing webcam fields (v1 and the earlier v2 additions above) are retained unchanged.

| Group                        | Field                                                                                                | What it measures                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-face detection         | `numberOfFaces`                                                                                      | Maximum number of simultaneously visible faces across the recording — a proxy for detecting a second person present during the assessment.                                                                                                                                                                                                                                        |
| Face framing                 | `faceBoundingBox`                                                                                    | Average bounding box (`{ x, y, width, height }`, normalized 0–1 to frame dimensions) across all frames with a successfully detected face — where in the frame the participant typically sits.                                                                                                                                                                                     |
|                              | `averageFaceSize`                                                                                    | Mean `width × height` of the bounding box, normalized to frame area — a proxy for how close/far the participant sits from the camera.                                                                                                                                                                                                                                             |
|                              | `averageFacePosition`                                                                                | Average face center (`{ x, y }`, normalized 0–1) — whether the participant stays centered during the session.                                                                                                                                                                                                                                                                     |
| Face absence (cumulative)    | `faceDisappearanceDuration`                                                                          | **Cumulative** total seconds with no face detected, summed across every disappearance run in the recording (e.g. 2s + 4s + 1s = 7s). This is distinct from the existing `maximumFaceLossDuration`, which reports only the single longest run — the two together give both "how bad was the worst gap" and "how much of the session total was the participant absent."             |
| Gaze direction (durations)   | `lookingLeftDuration` / `lookingRightDuration` / `lookingUpDuration` / `lookingDownDuration`         | Seconds spent with gaze estimated in each of the four cardinal directions, derived from the existing Face Mesh/Iris landmarks (no additional model).                                                                                                                                                                                                                              |
| Gaze direction (percentages) | `lookingLeftPercentage` / `lookingRightPercentage` / `lookingUpPercentage` / `lookingDownPercentage` | Same four directions expressed as a percentage of total _processed_ frames (e.g. `lookingLeftPercentage: 18.4` means ~18.4% of processed frames had gaze estimated as "left"). Percentages are independent per direction and are not required to sum to 100, since a frame with no reliable gaze estimate (e.g. face partially occluded) contributes to none of the four buckets. |

Example of the extended `webcamFeatures` export shape (in addition to every existing v1/v2 field):

```json
{
  "numberOfFaces": 1,
  "faceBoundingBox": { "x": 0.42, "y": 0.35, "width": 0.28, "height": 0.37 },
  "averageFaceSize": 0.104,
  "averageFacePosition": { "x": 0.47, "y": 0.44 },
  "faceDisappearanceDuration": 3.84,
  "lookingLeftDuration": 2.3,
  "lookingRightDuration": 1.7,
  "lookingUpDuration": 0.8,
  "lookingDownDuration": 1.2,
  "lookingLeftPercentage": 8.1,
  "lookingRightPercentage": 6.0,
  "lookingUpPercentage": 2.8,
  "lookingDownPercentage": 4.2
}
```

**Schema note:** `faceBoundingBox` and `averageFacePosition` are the first _nested-object_ webcam features (every prior field, v1 and v2, was a flat number). They're stored as embedded sub-documents (`{ type: { x: Number, y: Number, width: Number, height: Number }, default: null }` and `{ type: { x: Number, y: Number }, default: null }` respectively) rather than flattened into separate `...X` / `...Y` scalar fields, so a document that predates this upgrade simply has `faceBoundingBox: null` / `averageFacePosition: null` — consistent with how every other missing v2/v3 field defaults to `null` rather than to a partially-populated object. `normalizeFeatureObject()` treats these two fields as atomic (either the whole object is present or the whole field is `null`), so downstream consumers can safely do `videoFeatures.webcam.faceBoundingBox?.x` without checking for partial objects.

### Screen Features

| Group                  | Field                                                                                                                     | What it measures                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing               | `cursorSpeed`, `cursorAcceleration`, `cursorSmoothness`, `scrollFrequency`, `scrollSpeed`, `idleDuration`, `focusChanges` | Original v1 metrics, unchanged                                                                                                                                    |
| Mouse behaviour (new)  | `mouseStopCount` / `averageMouseStopDuration`                                                                             | Count/mean duration of brief (≥0.3s) low-motion runs — finer-grained than the existing `idleDuration`, which only counts runs ≥2s                                 |
|                        | `mousePathCurvature`                                                                                                      | Mean absolute turning angle (degrees) of the optical-flow direction between consecutive motion frames — proxy for how "wandering" vs. "direct" cursor movement is |
|                        | `cursorJitter`                                                                                                            | Std. deviation of frame-to-frame acceleration — proxy for high-frequency back-and-forth motion                                                                    |
| Scroll behaviour (new) | `scrollBurstCount` / `averageScrollBurstDuration`                                                                         | Count/mean duration of consecutive scroll-classified-frame runs, vs. the existing per-minute `scrollFrequency`                                                    |
| Idle behaviour (new)   | `idleEventCount` / `maximumIdleDuration`                                                                                  | Count and longest single idle run, vs. the existing total `idleDuration`                                                                                          |
| Activity density (new) | `mouseEventsPerSecond` / `scrollEventsPerSecond` / `activityDensity`                                                      | Normalized motion-frame rate, scroll-frame rate, and fraction-of-session-with-any-motion (0–1)                                                                    |

These are all optical-flow **proxies** derived from video motion, not literal cursor/scroll coordinates — a screen recording has none. `useMouseTracking.js`/`useKeyboardTracking.js` remain the precise, client-captured source of truth; treat this module's numbers as a cross-check, not a replacement.

### Historical Recordings: Incremental Upgrade

`npm run backfill` has three possible outcomes per assessment:

| Situation                                                                       | Action                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| No `ExtractedBehaviorFeature` document exists yet                               | **Full extraction** (`enqueueAndWait`)                 |
| Document exists, `status !== "completed"` (crash leftover / previously failed)  | **Full extraction** — not reliably complete either way |
| Document exists, `status === "completed"`, but missing any new-generation field | **Incremental upgrade** (`enqueueIncrementalUpgrade`)  |
| Document exists, `status === "completed"`, has every canonical field            | **Skip**                                               |

"Missing any field" is checked against the canonical field list in `config/featureSchema.js` — the single source of truth for what a "complete" `webcamFeatures`/`screenFeatures` object contains, shared by the backfill script, the export normalization, and (implicitly) the Mongoose schema.

**How the upgrade preserves existing values:** there's no cheaper way to compute "only the new fields" — old and new metrics come out of the same per-frame MediaPipe/OpenCV loop, so the upgrade re-runs the full analyzer. The result is then merged with the existing document giving **existing values priority**:

```js
merged = { ...freshlyComputed, ...existingNonNullFields };
```

So a previously-computed `blinkRate` of `14.2` stays exactly `14.2` even though the analyzer recomputed it during the upgrade — only fields that were actually missing (e.g. `averageFaceConfidence`, or in the v3 upgrade, `numberOfFaces` / `faceBoundingBox` / the gaze-direction fields) get filled from the fresh computation. This is what keeps already-exported baseline numbers stable across the upgrade.

**v3-specific note on object fields:** `faceBoundingBox` and `averageFacePosition` are merged as whole objects, not per-key — `existingNonNullFields` treats `faceBoundingBox` as present-or-absent as a unit (never merging `{x, y}` from one run with `{width, height}` from another), so a document either keeps its previously-computed bounding box untouched or receives a freshly computed one in full; it never ends up with a box assembled from two different analyzer runs.

**Resume/idempotence:** re-running `npm run backfill` after an interruption just re-evaluates each assessment's current state and does the same three-way decision again (this is unchanged by the v3 field additions — the three-way decision logic itself didn't need to change, only the canonical field list it checks against); anything already fully upgraded is skipped.

Example output:

```
====================================
ABEIS Historical Extraction
====================================

Completed assessments found: 128

[1/128] Processing assessment A001...
✔ Completed

[2/128] Upgrading assessment A002 (missing new-generation fields)...
✔ Upgraded

[3/128] Already processed
Skipping

[4/128] Missing recordings
Skipping

...

====================================
Finished
====================================

Processed (full)        : 40
Upgraded (incremental)   : 70
Skipped                  : 15
Failed                   : 3
```

### Automatic Extraction for Future Assessments

`completeAssessment()` calls `enqueueExtraction()`, which runs the same `_processAssessment()` producing the full current field set automatically — no frontend changes, no additional wiring. A brand-new assessment has no prior document to merge against, so it always gets a full extraction with every field populated in one pass.

### Schema & Forward Compatibility

- All original fields (v1 and v2) remain unchanged — nothing renamed, nothing removed.
- Scalar v3 fields (`numberOfFaces`, `averageFaceSize`, `faceDisappearanceDuration`, the four `looking*Duration` fields, the four `looking*Percentage` fields) are added to `webcamFeaturesSchema` as `{ type: Number, default: null }`, same convention as every prior field.
- The two v3 object fields (`faceBoundingBox: { x, y, width, height }`, `averageFacePosition: { x, y }`) are added as **nested sub-schemas** with `default: null` on the parent path — the only webcam fields so far that aren't flat numbers. Because `strict: false` is set at the `webcamFeaturesSchema` level, this doesn't require a schema-version migration; it only requires that `normalizeFeatureObject()` treat these two keys specially (return the whole object or `null`, never a partially-filled object) so CSV flattening and ML consumers get a stable shape.
- Both sub-schemas remain `strict: false`, so a field present in a document but not (yet) known to the currently-deployed schema version passes through untouched (forward-compatible with a future version running before this code is deployed everywhere).
- **No migration script required.** Two things make old documents "just work": (1) Mongoose doesn't error on missing paths when reading existing documents, and (2) the export layer explicitly normalizes missing fields to `null` at read time rather than relying on Mongoose schema defaults — which is important because `.lean()` reads (used everywhere in this codebase for performance) **do not** apply Mongoose schema defaults to pre-existing documents. Relying on schema defaults alone would have silently under-delivered on "missing values should default to null" for any document fetched via `.lean()`.

`metadata.modelVersion` is `"v3.0"` for anything processed by the current pipeline (`config/featureSchema.js`'s `CURRENT_MODEL_VERSION`) — documents processed only through the v2 upgrade show `"v2.0"`, and documents untouched since before that show `"v1.0"`. This gives you a quick way to check backfill progress at each stage, e.g.:

```js
db.extractedbehaviorfeatures.countDocuments({
  "metadata.modelVersion": "v1.0",
}); // never touched
db.extractedbehaviorfeatures.countDocuments({
  "metadata.modelVersion": "v2.0",
}); // needs the v3 incremental upgrade
db.extractedbehaviorfeatures.countDocuments({
  "metadata.modelVersion": "v3.0",
}); // fully current
```

### Performance Notes

- No new heavy model family introduced. The one addition, `mp.solutions.face_detection`, is the same lightweight BlazeFace-based MediaPipe solution already listed in the original spec — not a new dependency category.
- Every new metric is computed inside the **same** per-frame loop as the existing metrics (one webcam pass, one screen optical-flow pass) — there is no second pass over either video.
- Frame sampling (`MAX_SAMPLED_FRAMES = 900`) and concurrency (`FEATURE_EXTRACTION_CONCURRENCY`) are unchanged, so per-assessment extraction time is approximately the same as before the upgrade; the extra per-frame work (one more MediaPipe call for face detection, plus arithmetic on already-collected arrays) is small relative to the Face-Mesh/optical-flow cost that dominates either pass.
- Webcam and screen recordings continue to be downloaded and analyzed in parallel via `Promise.all` in `_processAssessment()`, in both the live and backfill paths.

### Testing Performed

Real participant recordings weren't available in the development environment, so correctness was verified with synthetic edge-case videos rather than a full face/screen recording:

- **`screen_features.py`**, run against a synthetic video with a moving/stopping bar: produced all 11 new fields with sane values (no exceptions, no NaNs) — confirms the optical-flow-based mouse-stop/curvature/jitter/burst/idle/density logic runs end-to-end.
- **`webcam_features.py`**, run against a synthetic _no-face_ video (worst case: every frame fails Face Mesh detection): completed without error, correctly reported `continuousFaceLossCount: 1`, `maximumFaceLossDuration` equal to the full clip length, and every other field at its safe zero/default — confirms the pipeline degrades gracefully rather than crashing when a participant isn't in frame.
- **Found and fixed a real environment issue in the process**: `mediapipe==0.10.33` (the latest release at time of testing) has removed the legacy `mp.solutions` API entirely, which `webcam_features.py` depends on (`AttributeError: module 'mediapipe' has no attribute 'solutions'`). Re-installing the exact pin from `requirements.txt` (`mediapipe==0.10.14`) resolved it. **This means the version pin in `requirements.txt` is load-bearing, not just a suggestion** — documented directly in that file so a future `pip install --upgrade mediapipe` doesn't silently break the pipeline in production.
- Node-side: every file in `backend-nodejs/` (source tree for `backend/`) passes `node --check` (syntax-level) after the rewrite; the merge-priority logic (`_mergePreferExisting`) and the three-way backfill decision (`_decideAction`) were traced through by hand for all four cases (missing doc / incomplete doc / up-to-date doc / no recordings) since a live MongoDB + real recordings weren't available to exercise them end-to-end in that environment.

**Not yet verified (recommend doing before full-scale rollout):** running the pipeline against 1–2 real participant recordings with an actual face present, to sanity-check the absolute values of `averageFaceConfidence`, head-speed, and blink-duration numbers against what a human reviewer would expect. The synthetic tests confirm the code _runs correctly_; they can't confirm the numbers are _meaningful_ the way real footage can.

---

## Export Pipeline (Unified JSON / CSV Dataset)

### Overview

`GET /api/admin/export` provides a **single unified dataset** containing all participant information required for behavioral baseline generation, statistical analysis, ML model training, research, participant auditing, data backup, and offline analysis. Instead of exporting data from individual MongoDB collections separately, the endpoint combines all required information into one structured JSON (or flattened CSV) record per assessment, via `services/exportService.js`.

```
GET /api/admin/export?format=json
GET /api/admin/export?format=csv
GET /api/admin/export?format=json&assessmentType=mcq|coding|typing
```

### Why it exists

Earlier iterations of the export exposed only user details, assessment information, recording URLs, and browser behavioral features as an opaque string (`featureVectorJSON`), requiring additional parsing and multiple MongoDB queries before the dataset could be used. The current export produces a fully structured dataset immediately usable without any additional processing.

### Collections combined into each exported row

| Source                     | Contributes                                                                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                     | User ID, Name, Email                                                                                                                                                                          |
| `Assessment`               | Assessment ID, Session ID, Assessment Type, Status, Start Time, End Time, Duration                                                                                                            |
| `Media`                    | Camera Recording URL, Screen Recording URL                                                                                                                                                    |
| `BehavioralFeature`        | Client-captured mouse / keyboard / session features, plus assessment-specific features (typing WPM/accuracy, coding copy-paste/backspaces; MCQ has no assessment-specific behavioral metrics) |
| `ExtractedBehaviorFeature` | AI-generated webcam and screen features (see [Behavioral Feature Extraction Pipeline](#behavioral-feature-extraction-pipeline-webcam--screen-ai-features) for the full field list)            |
| `AssessmentResponse`       | Participant answers (MCQ / Coding / Typing, shape depends on `assessmentType`)                                                                                                                |

#### Mouse features (from `BehavioralFeature`)

Total Movement, Average Speed, Maximum Speed, Acceleration, Cursor Smoothness, Click Frequency, Total Clicks, Double Clicks, Right Clicks, Drag Events, Scroll Events, Scroll Distance.

#### Keyboard features (from `BehavioralFeature`)

Average Key Press Duration, Average Inter Key Latency, Typing Rhythm Variance, Total Keystrokes, Key Frequency, Backspace Count, Delete Count, Shift Usage, Ctrl Usage, Copy Attempts, Paste Attempts, Error Rate.

#### Session features (from `BehavioralFeature`)

Idle Time, Idle Period Count, Focus Changes, Tab Switches, Fullscreen Exits, Network Latency, Session Duration, Browser, OS, Device Type, Screen Resolution, Average Response Time.

#### Assessment-specific features

- **Typing:** WPM, Accuracy, Task-wise WPM, Task-wise Accuracy.
- **Coding:** Copy Paste Attempts, Backspaces.
- **MCQ:** none.

#### Assessment responses

- **MCQ:** Question ID, Question, Selected Option, Correct Option, Correct/Incorrect, Response Time.
- **Coding:** Question Number, Prompt, Submitted Code, Programming Language, Response Time, Provided Solution (where applicable), Match Status.
- **Typing:** Task Number, Source Text, Typed Text, WPM, Accuracy, Response Time.

### Export row structure

```json
{
  "userId": "...",
  "name": "...",
  "email": "...",

  "assessmentId": "...",
  "sessionId": "...",
  "assessmentType": "typing",
  "status": "completed",

  "startedAt": "...",
  "endedAt": "...",
  "durationSeconds": 120,

  "cameraRecordingUrl": "...",
  "screenRecordingUrl": "...",

  "behavioralFeatures": {},

  "videoFeatures": {
    "webcam": {},
    "screen": {}
  },

  "responses": {}
}
```

`videoFeatures.webcam` and `videoFeatures.screen` are run through `normalizeFeatureObject()` (from `config/featureSchema.js`) before being returned, so **every** canonical AI feature field is present in the export, with `null` for any field a given document doesn't have — whether that's because the document predates a pipeline upgrade and hasn't been backfilled yet, or the extraction is still in progress. Downstream ML code can rely on e.g. `videoFeatures.webcam.averageFaceConfidence` always existing as a key (possibly `null`) rather than needing to check for its presence first.

Full example of a `videoFeatures` block:

```json
"videoFeatures": {
  "webcam": {
    "blinkRate": 14.2,
    "averageFaceConfidence": 0.91,
    "continuousFaceLossCount": 0,
    "maximumFaceLossDuration": 0,
    "averageBlinkDuration": 118.4,
    "maximumBlinkDuration": 210.0,
    "blinkIntervalVariance": 3.2,
    "screenAttentionPercentage": 92.5,
    "averageLookAwayDuration": 1.8,
    "maximumLookAwayDuration": 4.1,
    "pitchStdDeviation": 2.1,
    "yawStdDeviation": 3.4,
    "rollStdDeviation": 1.0,
    "averageHeadSpeed": 12.3,
    "maximumHeadSpeed": 58.0,
    "numberOfFaces": 1,
    "faceBoundingBox": { "x": 0.42, "y": 0.35, "width": 0.28, "height": 0.37 },
    "averageFaceSize": 0.104,
    "averageFacePosition": { "x": 0.47, "y": 0.44 },
    "faceDisappearanceDuration": 3.84,
    "lookingLeftDuration": 2.3,
    "lookingRightDuration": 1.7,
    "lookingUpDuration": 0.8,
    "lookingDownDuration": 1.2,
    "lookingLeftPercentage": 8.1,
    "lookingRightPercentage": 6.0,
    "lookingUpPercentage": 2.8,
    "lookingDownPercentage": 4.2
  },
  "screen": {
    "cursorSpeed": 3.1,
    "mouseStopCount": 6,
    "averageMouseStopDuration": 0.9,
    "mousePathCurvature": 14.7,
    "cursorJitter": 0.42,
    "scrollBurstCount": 2,
    "averageScrollBurstDuration": 1.1,
    "idleEventCount": 1,
    "maximumIdleDuration": 3.0,
    "mouseEventsPerSecond": 1.8,
    "scrollEventsPerSecond": 0.1,
    "activityDensity": 0.63
  }
}
```

No route, controller signature, or CSV/JSON toggle changes across pipeline upgrades — `GET /api/admin/export?format=json|csv&assessmentType=` behaves identically from the frontend's perspective; the file it downloads just carries more (and, for old data, `null`-safe) fields.

### CSV export

CSV export remains available alongside JSON. Nested JSON objects are automatically flattened into dot notation, e.g.:

```
behavioralFeatures.mouse.avgSpeed
behavioralFeatures.keyboard.totalKeystrokes
videoFeatures.webcam.blinkRate
videoFeatures.screen.cursorSpeed
```

Arrays such as assessment responses are serialized into JSON strings. JSON export is recommended for ML and baseline generation; CSV is useful for spreadsheet analysis.

### Benefits

- Single unified dataset, no MongoDB joins required after export.
- No string parsing.
- Complete client-captured behavioral features, complete webcam AI features, complete screen AI features.
- Participant responses, recording URLs, user metadata, and assessment metadata all in one place.
- Ready for behavioral baseline generation, ML training, statistical analysis, and research.
- Missing behavioral or video features are exported as `null` rather than omitted, so downstream code never has to guard for a missing key.

---

## Migration / Integration Guide (v3)

**Files delivered and ready to drop in as-is** (already updated, reviewed against your actual codebase, and backward compatible):

| File                                           | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/services/featureExtractionService.js` | Both bug fixes: `try`/`catch` scope now covers the `Media` lookup; `Media` lookup retried up to 4× with a delay; idempotency guard is now staleness-aware (`_isStale` / `STALE_PROCESSING_MS`) so the live path can self-heal a stuck document instead of only `npm run backfill` being able to.                                                                                                                                                                                                          |
| `backend/config/featureSchema.js`              | Added the 13 new v3 webcam keys to `WEBCAM_FIELDS`; added a `WEBCAM_OBJECT_FIELDS` export documenting the two nested-object fields; bumped `CURRENT_MODEL_VERSION` to `"v3.0"`.                                                                                                                                                                                                                                                                                                                           |
| `backend/models/ExtractedBehaviorFeature.js`   | Added the 13 new v3 fields to `webcamFeaturesSchema` (11 scalars + 2 nested sub-schemas: `boundingBoxSchema`, `pointSchema`), all `default: null`, `strict: false` preserved.                                                                                                                                                                                                                                                                                                                             |
| `python-worker/webcam_features.py`             | Computes all 13 new v3 fields inside the existing single MediaPipe pass — `numberOfFaces` (Face Detection now runs every sampled frame instead of only frames where Face Mesh found a face), `faceBoundingBox`/`averageFaceSize`/`averageFacePosition` (from the same detection call), `faceDisappearanceDuration` (cumulative, alongside the existing single-longest-run `maximumFaceLossDuration`), and the 8 gaze duration/percentage fields (reusing the existing per-frame pitch/yaw pose estimate). |

**Not modified — and don't need to be, by design:** `backend/scripts/backfillExtraction.js` and `backend/services/exportService.js` both read their field lists dynamically from `config/featureSchema.js`, so the v3 fields flow through both automatically. `backend/controllers/assessmentController.js` is also unchanged — its call to `enqueueExtraction(ctx)` didn't need to change; the fix lives entirely inside the function it's calling. Files not reviewed in this pass — `backend/queue/jobQueue.js`, `backend/services/videoDownloader.js`, `backend/services/pythonBridge.js`, `python-worker/utils/ear.py`, `python-worker/utils/head_pose.py` — were not touched and don't need to be for either the bug fix or the v3 features; send them over if you'd like them reviewed too, but nothing here depends on changing them.

How to fold these into the running project without downtime or data loss, in order:

1. **Deploy code first, run nothing yet.**
   - Drop in the four updated files above — the live-extraction fix and the queue-sharing behavior (`enqueueExtraction`/`enqueueAndWait`/`enqueueIncrementalUpgrade` all still resolve to the one shared `_processAssessment()` on the one shared `jobQueue`) are already applied inside `featureExtractionService.js`; no changes are needed to your queue module itself.
   - No changes are needed in `exportService.js`'s _logic_ — since it already runs webcam features through `normalizeFeatureObject()` against the field list in `featureSchema.js`, the 13 new fields appear in the export automatically. No frontend changes are required either.
   - Deploy this to production. At this point: **new assessments completed from now on get full v3 extraction automatically**, live extraction can no longer get permanently stuck (this also verifies the bug fix under real traffic), and existing documents are untouched and still export correctly (as `null` for the 13 new keys, via `normalizeFeatureObject()`).

2. **Backfill historical data (when convenient — not urgent, since nothing is broken by waiting).**

   ```bash
   cd backend
   npm run backfill
   ```

   Every assessment with a `"completed"` `ExtractedBehaviorFeature` document that predates v3 will be picked up as an **incremental upgrade** (not a full re-extraction from scratch) — existing v1/v2 field values are preserved exactly, and only the 13 new v3 fields are filled in. This can be run at any time, interrupted and resumed safely, and re-run harmlessly if it's ever unclear whether it fully completed.

3. **Verify.**

   ```js
   // Should trend toward 0 as the backfill progresses:
   db.extractedbehaviorfeatures.countDocuments({
     "metadata.modelVersion": { $ne: "v3.0" },
   });

   // Should be empty/near-empty at all times post-fix — a non-trivial, aging result means
   // the live pipeline is stuck again and needs the Part 6 diagnostic checklist re-run:
   db.extractedbehaviorfeatures.find({ status: "processing" });
   ```

4. **No action needed for:** the frontend, the participant-facing flow, `AssessmentResponse`, `BehavioralFeature` (client-captured), `Baseline`, or any admin-dashboard code — none of them read or write webcam/screen AI fields directly; they all go through `exportService.js` / `adminController.getUserDetails`, both of which already treat the webcam feature object as an opaque, schema-normalized blob.

**Rollback safety:** if the v3 analyzer needs to be reverted for any reason, existing `ExtractedBehaviorFeature` documents are unaffected (Mongoose `strict: false` means the extra fields simply persist unread), and `normalizeFeatureObject()` reverted to its v2 field list would simply stop emitting the nine new keys in the export — no data is destroyed either direction.

---

## Baseline Generation Workflow

With the unified export in place, a baseline/ML pipeline can consume one file with no further joins:

```
Participant completes assessment
        ↓
Client-captured behavioral features generated
        ↓
Webcam recording uploaded
        ↓
Screen recording uploaded
        ↓
AI feature extraction pipeline processes recordings (async)
        ↓
Features stored in MongoDB (ExtractedBehaviorFeature)
        ↓
Admin exports dataset (GET /api/admin/export)
        ↓
Unified JSON dataset generated
        ↓
Baseline generation
        ↓
Machine Learning model training
        ↓
Behavioral authentication
```

1. `GET /api/admin/export?format=json` → one JSON array, one object per assessment.
2. Group by `userId` (and optionally `assessmentType`).
3. For each group, `behavioralFeatures.*` gives the client-captured mouse/keyboard/session/typing/coding signals, and `videoFeatures.webcam.*` / `videoFeatures.screen.*` give the AI-derived signals — all as real numbers (or `null`), ready to average, z-score, or feed into a model without any type coercion or additional MongoDB queries.
4. `null` fields should be treated as "not yet available" (extraction still running, or a not-yet-backfilled document) rather than "value is zero" — filter them out of an average rather than including them as 0.

---

## Security Model

### Admin authentication

- Credentials (`ADMIN_ID`, `ADMIN_PASSWORD`) are stored exclusively in server-side environment variables. They are never sent to the client or referenced in any frontend file.
- The backend validates credentials on every login request and signs a short-lived JWT (8 hours) with `JWT_SECRET`.
- The JWT is stored in browser `sessionStorage` — it is cleared automatically when the tab closes and is not accessible to other origins.
- Every protected admin route verifies the JWT in `adminAuth` middleware before any controller logic runs. A missing or invalid token returns `401 Unauthorized`.

### Audit log

Every destructive admin action logs a structured entry to the server console:

```
[ADMIN_DELETE] adminId=ADMIN001 deletedUser=<uuid> counts={...} ip=::1 ts=2025-01-01T00:00:00.000Z
```

Log entries include: event type, admin ID, affected user IDs, per-collection record counts, IP address, and ISO timestamp.

### Rate limiting

All `/api` routes are rate-limited to 1 000 requests per 15-minute window per IP (configurable in `server.js`).

### CORS

The `cors` middleware is configured with `credentials: true` and an explicit `origin` set to `FRONTEND_URL`. In production this should be set to the exact frontend domain, not `*`.

### Future hardening

The authentication system is designed to be upgraded to multi-admin support by replacing the env-var comparison in `adminController.adminLogin` with a lookup against an `admins` MongoDB collection (bcrypt-hashed passwords, RBAC roles) without requiring changes to the JWT issuance logic, middleware, or protected routes.

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build          # outputs to dist/
# Push to GitHub, connect repo in Vercel
# Set environment variable: VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

### Backend → Render

Create a Web Service pointing to the `backend/` directory with start command `node server.js`. Set these environment variables in the Render dashboard:

```
MONGODB_URI          = mongodb+srv://...
IMAGEKIT_PUBLIC_KEY  = ...
IMAGEKIT_PRIVATE_KEY = ...
IMAGEKIT_URL_ENDPOINT = https://ik.imagekit.io/...
FRONTEND_URL         = https://your-app.vercel.app
NODE_ENV             = production
ADMIN_ID             = (choose a strong ID)
ADMIN_PASSWORD       = (choose a strong password)
JWT_SECRET           = (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
PRIVACY_POLICY_VERSION = 1.0.0
FEATURE_EXTRACTION_CONCURRENCY = 2
```

### Python worker

The Python worker (`python-worker/`) must be deployed alongside (or reachable by) the backend so `featureExtractionService.js` can invoke it. Respect the `mediapipe==0.10.14` pin in `requirements.txt` — newer releases have removed the `mp.solutions` API the webcam analyzer depends on.

### Storage abstraction

Media uploads and deletions go through `backend/config/imagekit.js` (`uploadToStorage` / `deleteFromStorage`). To swap ImageKit for AWS S3 or Azure Blob Storage in production, reimplement only those two functions — no controller code needs to change.

---

## Known Limitations & Future Hardening

- **Question bank** — MCQ questions, coding prompts, and typing passages are hardcoded sample content in the assessment page files. Wire these to a CMS or a `questions` MongoDB collection to make them configurable without a code deploy.
- **Camera-based signals** — `camera.lookingAwayCount` and `faceDetectionStatus` in the client-captured `BehavioralFeature` schema remain self-reported flags rather than measured signals. Real, measured camera-based signals (face confidence, look-away duration, head pose, blink dynamics) are now populated via the separate `ExtractedBehaviorFeature` AI pipeline; consider deprecating or clearly re-labeling the unpopulated `BehavioralFeature.camera` sub-fields to avoid confusion between the two sources.
- **Raw event storage** — `BehavioralFeature.rawEvents` can grow large for long sessions. Consider adding a TTL index, moving raw events to cold storage after a configurable retention period, or streaming events to the backend incrementally instead of batching on submit.
- **Participant auth** — participants are identified only by email lookup (no password, token, or magic link). Before exposing this platform to any real-world population, add a session token or email-verified magic link so participants cannot impersonate each other.
- **Single admin** — the current system supports exactly one administrator via env vars. Upgrade to a MongoDB-backed `admins` collection with bcrypt and RBAC when multiple researchers need independent access.
- **Admin JWT revocation** — JWTs are stateless; a logged-out token remains valid until expiry (8 hours). For stricter security, maintain a server-side deny-list or switch to shorter-lived tokens with refresh.
- **Media size limits** — Multer is configured to accept up to 200 MB per upload. Tune this limit or implement chunked uploads for longer recording sessions.
- **AI feature extraction is a proxy, not ground truth** — all screen-based mouse/scroll metrics are optical-flow proxies derived from video motion, not literal cursor/scroll coordinates; treat `useMouseTracking.js`/`useKeyboardTracking.js` as the precise source of truth and the AI-extracted screen features as a cross-check.
- **Real-footage validation pending** — the v2 webcam/screen metrics have only been validated against synthetic edge-case videos (no face, moving/stopping bar). Absolute values for `averageFaceConfidence`, head-speed, and blink-duration metrics should be sanity-checked against 1–2 real participant recordings before relying on them at scale.
- **`mediapipe` version pin is load-bearing** — `mediapipe==0.10.14` must not be casually upgraded; 0.10.33+ removes the legacy `mp.solutions` API the webcam analyzer depends on. Any future upgrade needs a corresponding rewrite of `webcam_features.py` against the new API, not just a version bump.
- **Gaze-direction thresholds are a first pass** — `lookingLeft/Right/Up/Down` are estimated from Face Mesh/Iris landmark angles against fixed thresholds; they haven't yet been validated against labeled real-footage ground truth the way `screenAttention` was, so treat the four percentages as directional signal rather than a precise calibrated instrument until a validation pass is done (see "Real-footage validation pending" above, which now also applies to the v3 gaze fields).
- **`numberOfFaces` is a max, not a timeline** — it currently reports only the single highest simultaneous face count seen in the recording, not when or for how long a second face was visible. If "a second person appeared for the last 30 seconds" needs to be distinguishable from "a second person was in frame for 2 seconds," a future version would need a duration-style field analogous to `faceDisappearanceDuration`.
- **Live-extraction monitoring** — the v3 fix makes the live path self-healing (a stuck `"pending"`/`"processing"` document older than `STALE_PROCESSING_MS` is automatically re-enqueued on its next live trigger), and every failure path now reliably resolves to `status: "failed"` with `lastError` rather than hanging silently. There is still no _automated, unprompted_ alert if a document is failing repeatedly for a new reason — consider adding a scheduled check (cron job or dashboard metric) on `status: "failed"` counts and on stale `"pending"`/`"processing"` documents older than the staleness threshold, rather than relying on someone running the operational check query manually.

# ABEIS Feature Extraction — Audit & Correction Pass (README / Change Tracker)

This document tracks exactly what was audited, what was actually wrong, what
was changed, and what you need to do to deploy it. It is scoped to the
**webcam/screen AI feature extraction pipeline** only (per the audit
request) — nothing about auth, participant flow, export routes, or the
Media/Assessment/BehavioralFeature models was touched.

**Important framing:** the code you gave me was already a fairly mature
"v3" pipeline that had already fixed most of the _catastrophic_ symptoms
described in the original audit request (e.g. `blinkRate = 10000`,
`headSpeed = 32066`, `numberOfFaces` always `1`). Those were real bugs, but
they were already resolved before this pass. What follows is a second,
deeper audit of that v3 code, which found five real, still-live defects —
described below with before/after behavior — plus a scan of everything
else in the pipeline against the original audit checklist, most of which
was already correct.

---

## 1. What was actually wrong (and fixed)

### 1.1 Blink timing was frame-count-based, not time-based — `python-worker/utils/ear.py`

**Symptom this causes:** on any recording where frame sampling has to skip
raw frames to stay under `MAX_SAMPLED_FRAMES = 900` (i.e. any recording
longer than a few minutes), the _real-world_ gap between two consecutive
_sampled_ frames grows. The old `BlinkTracker` counted a blink whenever
`EAR_CONSEC_FRAMES = 2` **sampled frames** were closed — with no regard for
how much real time those 2 frames spanned.

- On a long recording sampled down to ~1.5 effective fps, 2 sampled frames
  = ~1.3 seconds. No real blink (100–300ms) can ever reach that — blink
  count silently collapses toward zero, and the rare runs that do get
  counted (e.g. someone genuinely closing their eyes for a couple of
  seconds) get reported as "blinks" with durations far outside the normal
  range. This is the direct mechanism behind implausible
  `averageBlinkDuration` values like 833ms/1200ms.
- On a short, lightly-downsampled recording, 2 frames of single-frame
  landmark jitter could be miscounted as a real blink.
- There was also no upper bound at all — a multi-second eye closure
  (participant looking away/down, covering their eyes, drowsiness) was
  counted as one very long "blink," which is exactly what corrupts
  `maximumBlinkDuration`.

**Fix:** `BlinkTracker` now takes `seconds_per_sample` at construction and
converts three _time-based_ constants into frame thresholds once:

| Constant             | Value | Meaning                                                                                                     |
| -------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| `MIN_BLINK_MS`       | 80ms  | Shorter closures = EAR/landmark noise, not a blink                                                          |
| `MAX_BLINK_MS`       | 500ms | Longer closures = prolonged closure, not a blink; excluded from blink stats entirely                        |
| `BLINK_MERGE_GAP_MS` | 60ms  | A reopening shorter than this is treated as noise and merged into the same blink, instead of counted as two |

**Expected ranges after the fix:** `blinkCount` proportional to real
elapsed minutes at 10–20/min typical (per the original spec); `blinkRate`
bounded and stable across recordings of different lengths;
`averageBlinkDuration` clustered in ~80–500ms; `maximumBlinkDuration` never
exceeds 500ms (prolonged closures are now excluded, not counted as a
blink).

**Known residual limitation (not fixed in this pass, documented instead):**
if a recording is _so_ long that even `MIN_BLINK_MS` rounds down to 1
sampled frame representing well over 300ms of real time, individual blinks
become structurally undetectable — no threshold tuning in `ear.py` can
recover that, because the frames simply aren't dense enough. Fixing this
would mean decoupling blink sampling density from `MAX_SAMPLED_FRAMES`
(e.g. a duration-aware sampling budget), which changes per-assessment
processing time and was deliberately left out of this pass to respect the
"maintain approximately current processing speed" requirement. Flagging it
here rather than silently shipping a partial fix.

---

### 1.2 Face bounding box / size / position could silently track the wrong person — `python-worker/webcam_features.py`

**Symptom this causes:** in any recording with more than one face visible
(the exact scenario the audit spec calls out: "videos containing two or
three people"), the old code picked `max(detections, key=score)` — i.e.
whichever face scored highest **in that single frame** — to compute
`averageFaceConfidence` and (in this v3 pipeline) `faceBoundingBox`,
`averageFaceSize`, and `averageFacePosition`. If the higher-confidence face
flips between two different people from frame to frame (e.g. whoever is
better lit or closer at that instant), the averaged box/position/size
becomes a meaningless blend of two different people's positions — and it
may not even correspond to the same person whose EAR/blink/head-pose was
just computed from Face Mesh's tracked landmarks.

**Fix:** Face Detection's box is now matched to Face Mesh's currently
tracked face by centroid distance (`_match_primary_detection`), so every
sample describes the same identity that the rest of the frame's metrics
(blink, gaze, head pose) are already describing. Detections below a
`MIN_CONFIDENCE_FOR_STATS = 0.6` floor are skipped entirely for this stat
rather than recorded as a misleading `0.0` (which previously dragged the
whole-recording average down even on frames where nothing was actually
measured).

**Also hardened (already-working feature, made more robust):**
`numberOfFaces` now applies a stricter `SECOND_FACE_MIN_CONFIDENCE = 0.6`
floor (vs. the detector's own internal 0.5) specifically for counting a
face as evidence of a second person, to cut down on false positives from
reflections, posters, or photos in the background. Note: the underlying
mechanism that lets `numberOfFaces` report more than 1 at all — running
Face Detection on every sampled frame independent of Face Mesh's
`max_num_faces=1` cap — was **already correctly implemented** in the code
you gave me; this pass only tightens its confidence floor.

---

### 1.3 Gaze-direction buckets had no debounce — `python-worker/webcam_features.py`

**Symptom:** `lookingLeft/Right/Up/Down` incremented on _every single
frame_ independently, unlike the existing look-away/attention logic which
already required 5 consecutive frames before counting an event. A single
frame of landmark jitter could flip a gaze bucket on, inflating that
direction's percentage with noise not present in the other, debounced
metrics.

**Fix:** added `_AxisGazeCounter`, mirroring the existing away-detection
pattern with a smaller `GAZE_MIN_CONSEC_FRAMES = 2` (gaze glances are
legitimately shorter than a "looking away from the screen" event, so a
smaller threshold than `AWAY_CONSEC_FRAMES=5` is intentional). Documented
trade-off: this slightly _under_-counts total duration (the first frame of
every qualifying run isn't counted) in exchange for not _over_-counting
single-frame noise — negligible at `GAZE_MIN_CONSEC_FRAMES=2`.

---

### 1.4 `scrollSpeed` measured any fast motion, not scroll motion — `python-worker/screen_features.py`

**Symptom:** `scrollSpeed` was computed as the mean flow magnitude of _any_
frame above `SCROLL_MIN_MAGNITUDE`, without checking the vertical-dominance
condition that `is_scroll_frame` (used everywhere else — `scrollFrequency`,
`scrollBurstCount`) actually requires. A fast horizontal drag or window
resize would count toward "scroll speed" even though it isn't scrolling.

**Fix:** `scrollSpeed` is now the mean magnitude of frames that actually
passed the same `is_scroll_frame` classification used by every other
scroll-related metric, so all scroll fields in the output now share one
consistent definition of "this frame is a scroll frame."

---

### 1.5 Historical documents won't self-correct via `npm run backfill` — new script

This is an operational gap, not a formula bug, but it directly affects
whether the fixes above actually reach your existing data.

`npm run backfill`'s incremental-upgrade path (`enqueueIncrementalUpgrade`)
deliberately **prefers existing non-null values** — that's correct when a
field is _missing_, but it means a document that already has a (wrong)
`blinkRate` or `faceBoundingBox` computed by the old formula will **keep
that wrong value forever**, because from the merge logic's point of view
the field isn't missing, it's just wrong.

**Fix:** added one small additive export,
`enqueueForceReprocess()`, to `featureExtractionService.js` (does a full,
unmerged recompute regardless of current status — see §3 below for the
exact diff), plus a new script,
`backend/scripts/reprocessCorrectedFeatures.js`, that targets only
documents whose `metadata.modelVersion` predates this fix and forces them
through a full recompute. See §4 for how/when to run it.

---

## 2. What was checked and found to already be correct

To be explicit about what I verified rather than just trusted, given the
original audit spec's checklist:

| Item                                                                       | Status                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blink rate FPS/duration normalization (the `blinkRate=10000` class of bug) | Already correctly fixed in the given code via `seconds_per_sample`; this pass only corrected the _frame-count vs. time_ mismatch described in §1.1, a subtler residual issue                                                              |
| Head speed unit/FPS normalization (the `headSpeed=32066` class of bug)     | Already correct — computed as real angular delta (deg) over real elapsed seconds via `pose_history` positions × `seconds_per_sample`                                                                                                      |
| `numberOfFaces` always reporting 1                                         | Already fixed — Face Detection runs every sampled frame independent of Face Mesh's single-face cap; this pass only raised its confidence floor (§1.2)                                                                                     |
| `eyeClosureRate` normalization (closed frames / processed frames)          | Correct — denominator is `total_frames` inside `BlinkTracker`, which only increments on frames actually passed to `update()`                                                                                                              |
| `faceVisiblePercentage`                                                    | Correct — `frames_with_face / frames_sampled`                                                                                                                                                                                             |
| Divide-by-zero guards (screen metrics)                                     | Checked throughout `screen_features.py` — every ratio guards its denominator (`if duration_seconds > 0`, `if frames_with_flow > 0`, etc.)                                                                                                 |
| `NaN`/negative-duration guards                                             | No unguarded `np.mean`/`np.std` calls on empty lists found in either file — all are conditioned on the underlying list being non-empty                                                                                                    |
| Idempotency / resumability of `npm run backfill`                           | Confirmed via `_decideAction`'s three-way logic in `backfillExtraction.js` — safe to interrupt and re-run                                                                                                                                 |
| Live-extraction "stuck in `processing`" bug                                | Already fixed in the given `featureExtractionService.js` (try/catch now wraps the `Media` lookup, plus a staleness-based self-healing re-enqueue) — verified by reading the actual fixed code, not just the changelog's description of it |

---

## 3. Exact file changes

### Files to **replace as-is** (full corrected files provided):

| File                               | Change                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `python-worker/utils/ear.py`       | Blink timing rewritten to be time-based (§1.1)                                                          |
| `python-worker/webcam_features.py` | Primary-face-consistent bbox/confidence (§1.2), gaze debounce (§1.3), updated `BlinkTracker` call sites |
| `python-worker/screen_features.py` | `scrollSpeed` fix (§1.4)                                                                                |

No fields were added, removed, or renamed in any of the three files above
— every existing key in the JSON output is still produced, with the same
name, same type, same nullability behavior. `config/featureSchema.js`'s
`WEBCAM_FIELDS`/`SCREEN_FIELDS` lists and `ExtractedBehaviorFeature.js`'s
Mongoose schema **do not need to change**.

### New file (add, doesn't replace anything):

| File                                            | Purpose                                          |
| ----------------------------------------------- | ------------------------------------------------ |
| `backend/scripts/reprocessCorrectedFeatures.js` | One-time (or as-needed) correction pass — see §4 |

### One additive export in an existing file (do NOT replace the whole file — just add this function and update the final `module.exports` line):

In `backend/services/featureExtractionService.js`, add, near the other
exported entrypoints:

```js
/**
 * Force-reprocess entrypoint for documents that are already "completed"
 * but were computed with a formula that has since been corrected (as
 * opposed to a document that's merely missing NEW fields, which is what
 * enqueueIncrementalUpgrade is for). Unlike enqueueAndWait, this does NOT
 * short-circuit on status === "completed", and unlike
 * enqueueIncrementalUpgrade it does NOT merge-prefer-existing values —
 * every field is fully recomputed and overwrites the prior value. Use
 * this only for a deliberate, versioned correction pass (see
 * scripts/reprocessCorrectedFeatures.js), not as part of routine backfill.
 *
 * Same shared _processAssessment() / same jobQueue as every other
 * entrypoint — still exactly one implementation of the extraction logic.
 */
async function enqueueForceReprocess(ctx) {
  const doc = await jobQueue.enqueue(
    () => _processAssessment(ctx, { mergeWithExisting: false }),
    { label: `reprocess:${ctx.assessmentId}` },
  );
  return { skipped: false, doc };
}
```

And change the final line of that file from:

```js
module.exports = {
  enqueueExtraction,
  enqueueAndWait,
  enqueueIncrementalUpgrade,
};
```

to:

```js
module.exports = {
  enqueueExtraction,
  enqueueAndWait,
  enqueueIncrementalUpgrade,
  enqueueForceReprocess,
};
```

That's it — nothing else in that file changes. `enqueueExtraction`,
`enqueueAndWait`, `enqueueIncrementalUpgrade`, and the live-extraction bug
fix already in that file are untouched.

### One-line version bump in `backend/config/featureSchema.js`:

```diff
- const CURRENT_MODEL_VERSION = "v3.0";
+ const CURRENT_MODEL_VERSION = "v3.1";
```

This is what lets `reprocessCorrectedFeatures.js` (and, going forward,
`db.extractedbehaviorfeatures.countDocuments({"metadata.modelVersion": {$ne: "v3.1"}})`)
distinguish "computed with the corrected formulas" from "computed before
this fix." No field-list changes are needed alongside this bump — this
correction pass didn't add any new fields, only corrected existing ones.

---

## 4. Deployment steps, in order

1. **Install: nothing new.** No new pip packages, no new npm packages. All
   three corrected Python files use only `cv2`, `numpy`, and `mediapipe` —
   already in `requirements.txt` — and the `mediapipe==0.10.14` pin is
   unaffected (nothing here touches the `mp.solutions` API surface beyond
   what was already in use).

2. **Replace the three Python files** (§3) and **apply the two small JS
   edits** (§3) in a normal deploy. No MongoDB schema migration is
   required — same guarantee the existing pipeline already relies on
   (`strict: false` sub-schemas, `default: null` on every field).

3. **From this point on, all NEW assessments get the corrected formulas
   automatically** via the existing `completeAssessment → enqueueExtraction`
   path — no frontend changes, no additional wiring, exactly like every
   prior version of this pipeline.

4. **Existing/historical data does NOT get corrected by `npm run
backfill`** — see §1.5. To actually apply the corrected blink timing /
   face bounding-box logic / scrollSpeed fix to already-processed
   recordings, run the new script once traffic allows:

   ```bash
   cd backend
   node scripts/reprocessCorrectedFeatures.js
   ```

   (Optionally wire this up as an npm script: add
   `"reprocess-corrected-features": "node scripts/reprocessCorrectedFeatures.js"`
   to `package.json`.)

   This is safe to interrupt and re-run — it only re-touches documents
   whose `metadata.modelVersion` is still behind `"v3.1"`.

5. **Verify:**

   ```js
   // Should trend toward 0 as reprocessing completes:
   db.extractedbehaviorfeatures.countDocuments({
     status: "completed",
     "metadata.modelVersion": { $ne: "v3.1" },
   });
   ```

   Spot-check a few reprocessed documents' `webcamFeatures.blinkRate`
   (should now be roughly 10–20 for a normal, attentive participant, never
   in the thousands) and `webcamFeatures.maximumBlinkDuration` (should
   never exceed 500).

---

## 5. Validation performed on this pass — and what I could NOT validate

Being direct about this rather than implying more than actually happened:

- **What I did:** read every line of the five files you provided
  (`ear.py`, `webcam_features.py`, `screen_features.py`,
  `featureExtractionService.js`, `ExtractedBehaviorFeature.js`,
  `featureSchema.js`, `backfillExtraction.js`, `assessmentController.js`,
  `Media.js`) and traced the actual formulas against the audit checklist
  line by line, rather than trusting the existing README's description of
  what those files do. The bugs in §1 were found this way — by reading the
  code, not by pattern-matching to the symptoms listed in the audit
  request.
- **What I could NOT validate:** `python-worker/utils/head_pose.py` was
  **not provided**, so `estimate_head_pose()` — which underlies
  `averagePitch/Yaw/Roll`, `screenAttention`, `headMovementVariance`,
  `averageHeadSpeed`, and now the gaze-direction buckets — is a black box
  to this audit. I've assumed its output is in degrees (consistent with
  how every threshold that consumes it, e.g. `YAW_AWAY_DEG = 25.0`, is
  written), but I have not verified its internal math. If you want that
  file audited too, send it over.
- **No real footage was available to me either** (same limitation the
  existing README already discloses for the v2/v3 pass) — everything
  above was validated by formula inspection and unit/dimensional
  reasoning (does the math produce a bounded, physically-plausible number
  given realistic inputs), not by running the corrected code against an
  actual recording. Before relying on absolute values at scale, I'd
  recommend the same real-footage sanity pass the existing README already
  flags as outstanding for `averageFaceConfidence`, head-speed, and blink
  duration — now extended to also cover `faceBoundingBox`/
  `averageFacePosition` consistency in a real multi-person recording and
  `scrollSpeed` against a real scrolling session.

---

## 6. Follow-ups intentionally NOT done in this pass (recommendations only)

These are real observations, deliberately left as recommendations rather
than code changes, either because they're out of scope for a formula audit
or because the trade-offs need a product decision, not just a bug fix:

1. **Concurrent double-enqueue race.** `enqueueExtraction()` checks the
   existing document's status, then separately writes a "pending" record
   and enqueues a job — there's no single atomic "claim" operation. Two
   near-simultaneous calls (e.g. a duplicate `/complete` request) could
   both pass the check and both enqueue a job for the same assessment.
   Wasteful (double download + double analysis) but not data-corrupting,
   since the final Mongo write is just last-writer-wins. If this matters
   to you, the fix is a single atomic `findOneAndUpdate` claim (with the
   document's own `unique: true` index on `assessmentId` as the collision
   backstop) instead of the current check-then-act pattern — happy to
   implement if you want it.
2. **Blink-detection sampling density on long recordings** (§1.1's
   residual limitation) — would need a duration-aware sampling budget,
   which trades off against the "maintain current processing speed"
   requirement and should be a deliberate decision, not a silent change.
3. **Gaze-direction and focus-change thresholds remain uncalibrated
   against real footage** — already flagged as a known limitation in the
   existing README; this pass didn't change that status, just didn't make
   it worse.
4. **`head_pose.py` is unaudited** (see §5) — send it if you'd like it
   reviewed.

## Changes for Live Coding Test

# ABEIS — Coding Assessment Question Update

This document describes a single, narrowly-scoped change made to the ABEIS
platform: the content of the coding assessment questions. Nothing else in
the project was modified.

## What was changed

**Files changed:**

1. `frontend/src/pages/CodingAssessmentPage.jsx` — question content and
   stage structure (full file provided alongside this README).
2. `backend/models/AssessmentResponse.js` — one small, necessary fix (full
   file provided alongside this README). See "Why the model needed a
   change" below for exactly what and why.

**No other file was changed.** No controller, route, other model,
API endpoint, behavioral feature extraction module, or baseline
generation module was touched.

### Why the model needed a change

`AssessmentResponse.codingResponses[].questionNumber` was defined as
`{ type: Number, enum: [1, 2] }` — a hard validation constraint left over
from the old two-question flow (`1` = independent problem, `2` =
transcription task). The new assessment submits three responses per
attempt (`questionNumber` 1, 2, and 3). Submitting `questionNumber: 3`
against an `enum: [1, 2]` field fails Mongoose validation on any code
path that runs validators (a direct `.save()`, or `findOneAndUpdate` with
`runValidators: true`) — silently corrupting or outright rejecting every
coding-assessment submission going forward.

This was not optional to leave alone: it is the one place where the
question-content change and the database schema were actually coupled,
because the schema encoded an assumption ("there are exactly 2 coding
questions, with these two fixed meanings") that the new content set
breaks. The fix removes the enum restriction (`questionNumber` is now a
plain `Number`) and updates the stale comments. `providedSolution` and
`matchesProvidedSolution` — fields specific to the old transcription
task — were left in the schema, unset and unused by new submissions, so
that historical documents which do have them keep validating and
exporting exactly as before. Nothing else in the model changed: field
names, MCQ/typing sub-schemas, indexes, and collection name are all
untouched.

The three hardcoded coding problems previously shown during the coding
assessment have been replaced with the following three questions:

1. **Sum of Odd Numbers** — return the sum of all odd numbers in an
   array/list of integers.
2. **Find the Smallest Element** — return the smallest element in an
   array/list.
3. **Count Uppercase Characters** — return the total number of uppercase
   alphabetic characters in a string.

None of the three problem statements name a specific programming
language. A language selector (C++, Java, Python, JavaScript, C, Other)
was added so the participant can freely choose their language; their
choice is recorded per response in the existing `language` field that
`AssessmentResponse.codingResponses[]` already supports.

## One structural note (read before deploying)

The previous version of this page had a **two-stage** flow:

- Stage 1: an independent problem to solve from scratch.
- Stage 2: a **transcription task** — a JavaScript code block was shown
  on screen and the participant had to type it out exactly.

The transcription stage displayed a specific language's syntax directly
in the problem UI, which conflicts with the requirement that the
assessment content be language-independent. None of the three replacement
questions is a "copy this exact solution" task — all three are
independent problems, matching the shape of the first stage's questions,
not the second.

To keep this change as small as possible while still satisfying the
language-independence requirement, the two-stage (independent +
transcription) flow was converted into a **three-stage flow of three
independent problems**, and the JavaScript transcription task was
removed. This was the minimum change needed to accommodate the three new
questions without leaving a language-specific transcription screen in
place that contradicts the stated requirement. No other part of the
assessment flow, timer behavior, or submission logic was altered as part
of this — only the number of stages (2 → 3) needed to change to fit the
three questions, and the content of what's shown at each stage.

If you specifically want a transcription-style task retained (in
addition to or instead of one of the three independent problems), let me
know and I can add a fourth, language-independent transcription problem
rather than removing that assessment type outright — I did not do this
unprompted since it wasn't part of your three supplied questions.

## Why these questions were chosen

The three replacement questions were selected because they:

- Have a difficulty level comparable to the questions they replace
  (each solvable with a single loop/aggregation over an array or string).
- Require similar logical thinking (iterate, filter/compare, accumulate).
- Require similar typing effort and similar quantities of code, so
  keystroke-timing and typing-rhythm signals stay comparable to prior
  baseline data.
- Produce similar mouse interaction patterns (minimal mouse use beyond
  focusing the textarea and scrolling), keeping mouse-based behavioral
  signals comparable.
- Produce similar correction/backspace behavior — none of the three
  requires unusual edge-case handling that would provoke atypical amounts
  of backtracking compared to the previous questions.
- Avoid simple memorization, since a participant cannot recall a stored
  answer from a prior session if the specific problem changes each time
  while remaining structurally and cognitively equivalent.

## Why language-independent questions were selected

The platform already allows participants to answer in any supported
language (C++, Java, Python, JavaScript, C, or other). Naming a specific
language in the problem statement would either bias participants toward
that language or create a mismatch between the stated problem and the
language they actually use. Writing the problems in language-neutral
terms ("a given array or list", "a given string") keeps the assessment
fair and consistent regardless of which language a participant picks.

## Why similar difficulty matters for behavioral authentication

The system's authentication approach depends on comparing a participant's
live behavioral signals (typing rhythm, mouse movement, correction
patterns, timing) against their previously-established statistical
baseline. If a new question is meaningfully harder or easier than the
baseline questions, natural behavioral variation (more hesitation, more
corrections, different timing) would be driven by task difficulty rather
than by whether the same person is typing — this would corrupt the
Weighted Z-Score comparison with noise unrelated to identity. Keeping
difficulty, logical complexity, and typing effort comparable to the
original calibration questions ensures behavioral deviations measured
during authentication reflect genuine behavioral differences, not just
a harder or easier problem.

## Confirmation of scope

- **No architectural changes were made.** The overall flow (calibration →
  behavioral feature collection → baseline generation → authentication →
  Weighted Z-Score comparison) is unchanged.
- **The baseline generation module (`backend/services/baselineService.js`)
  is unchanged.** It reads whatever feature vector is submitted; it has no
  dependency on the text of the coding questions.
- **The authentication workflow is unchanged.** `assessmentController.js`,
  `featureExtractionService.js`, `exportService.js`, and all MongoDB
  models and collections are unchanged.
- **No API routes or request/response shapes were changed.**
  `POST /api/responses` and `POST /api/assessments/:id/complete` accept
  exactly the same payload shapes as before.
- **One MongoDB schema constraint was corrected, not redesigned:** the
  `questionNumber` field on `AssessmentResponse.codingResponses[]` had a
  hardcoded `enum: [1, 2]` tied to the old two-question flow. This was
  loosened to a plain `Number` so a third question doesn't fail
  validation. No fields were renamed or removed, no other sub-schema
  (MCQ, typing) was touched, and no collection, index, or endpoint
  changed as a result.
- **Only the coding assessment's question content, the stage count
  (2 → 3), and this one schema constraint were updated.** Question
  timers, assessment duration limits, mouse/keyboard/session tracking,
  video/webcam recording, feature extraction, and all other parts of
  response storage and MongoDB collections remain exactly as they were.

## Expected result after this change

- The coding assessment now displays the three new questions listed above,
  one per stage, in order.
- Participants can select any supported programming language before
  answering; their choice is stored per response.
- Mouse, keyboard, and session behavioral tracking continue to run exactly
  as before, unchanged.
- Webcam and screen recording, and the AI feature-extraction pipeline,
  continue to run exactly as before, unchanged.
- Baseline generation and the future Weighted Z-Score authentication
  module continue to work without any changes, since they consume the same
  `featureVector` / `codingResponses[]` shapes as before.
