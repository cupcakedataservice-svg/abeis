# ABEIS — Automated Behavioral & Engagement Intelligence System

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
- **Media size limits** — Multer is configured to accept up to 200 MB per upload. Tune this limit or implement chunked uploads for longer recording sessions.
