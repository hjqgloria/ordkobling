# Ordkobling
A professional Norwegian word connection game built with modern web technologies and a focus on performance and high-precision interaction. Features a real-time multiplayer leaderboard backed by Upstash Redis.

## Tech Stack & Architecture

- **Runtime**: [Node.js v24](https://nodejs.org/) (managed via `fnm`)
- **Frontend Framework**: [Vite 8](https://vitejs.dev/) + React 19 (SPA)
- **API Framework**: [Hono](https://hono.dev/)
- **Styling**: Tailwind CSS v4 (using the new CSS-first engine)
- **State Management**: React 19 Hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
- **Testing**: Vitest and JSDOM
- **Package Manager**: pnpm
- **Backend Database**: [Upstash Redis](https://upstash.com/) (REST API for leaderboard)

### Core Features
- **Grid Generation**: Algorithmic checkerboard generation with protected "Snake-style" bonus word injection.
- **Interaction Engine**: Mathematical hit-detection with magnetic snapping and backtracking support.
- **Dictionary Validation**: Server-side proxy for the University of Bergen's Ordbøkene API.
- **Local Persistence**: Player high-scores and names cached via `localStorage`.
- **Global Leaderboard**: Real-time top 10 scores backed by Redis sorted sets.
  - **Leaderboard Safety**: IP-based rate limiting (10 submissions/minute), basic profanity filtering, and name sanitization (NFKC normalization, 32 char max, alphanumeric + spaces/hyphens/underscores/dots).
  - **Score Validation**: Only improved or new scores are recorded; ties preserve the first submission.

## Project Structure
- `/src`: Application entry point (`main.jsx`, `index.css`).
- `/api`: Hono API router for `/api/validate` and `/api/leaderboard`.
- `/components`: React UI components and game logic.
  - `WordGame.jsx`, `GameBoard.jsx`, `GameStatus.jsx`: Core game UI.
  - `useGameState.js`: Central game hook (scoring, validation, leaderboard integration).
- `/lib`:
  - `redis.js`: Upstash Redis client initialization (SDK or REST fallback).
- `index.html`: Vite HTML entry point.
- `server.mjs`: Standalone production server serving API + static frontend.

## API Endpoints

### `GET /api/leaderboard`
Returns the top 10 scores on the leaderboard.

**Response:**
```json
{
  "leaderboard": [
    { "name": "Player1", "score": 9500 },
    { "name": "Player2", "score": 8200 }
  ]
}
```

### `POST /api/leaderboard`
Submit a score to the leaderboard. Rate-limited to 10 submissions per IP per minute.

**Request:**
```json
{
  "name": "YourName",
  "score": 1250
}
```

**Response (success):**
```json
{ "ok": true, "name": "YourName" }
```

**Response (invalid):**
- 400: Invalid score (must be 0 < score ≤ 1,000,000)
- 400: Invalid name
- 429: Rate limit exceeded (10 submissions/minute per IP)
- 500: Server error

## Environment Configuration

### Local Development
Create `.env.development.local` with Upstash credentials (not committed to git):

```bash
KV_REST_API_URL=https://your-db.upstash.io
KV_REST_API_TOKEN=your-token-here
```

The app also supports `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, or raw `REDIS_URL=rediss://...`.

### Production (Vercel)
When you connected this project to Vercel and set up Upstash, Vercel automatically injected the environment variables (usually `KV_REST_API_URL` and `KV_REST_API_TOKEN`). No additional setup is required—just deploy.

## Development Setup

This project uses **fnm** for Node version management and **pnpm** for package management.

### Prerequisites
- Node.js (use `fnm use` to activate the pinned version)
- pnpm v9+
- Upstash Redis account and a database configured in `.env.development.local` (optional for local testing without leaderboard)

### Getting Started

1. **Activate Node version**:
   ```bash
   fnm use
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up local environment** (optional—required to test leaderboard):
   - Create `.env.development.local` (not committed) and add Upstash credentials:
     ```bash
     KV_REST_API_URL=https://your-db.upstash.io
     KV_REST_API_TOKEN=your-token-here
     ```

4. **Start development server**:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run tests**:
   ```bash
   pnpm test
   ```

### Quick Verification (Local)

Once the dev server is running, verify the leaderboard API:

```bash
# Get leaderboard
curl http://localhost:3000/api/leaderboard

# Submit a test score
curl -X POST http://localhost:3000/api/leaderboard \
  -H "Content-Type: application/json" \
  -d '{"name":"TestPlayer","score":500}'

# Get updated leaderboard
curl http://localhost:3000/api/leaderboard
```

## Deployment

### Vercel + Upstash

Since you've already connected the project to Vercel and set up Upstash, the environment variables are automatically configured in your Vercel project. To deploy:

1. **Commit and push** your changes to your repository.
2. **Vercel auto-deploys** on push to the production branch (usually `main`).
3. **Verify production**:
   ```bash
   # Get leaderboard from production
   curl https://your-app.vercel.app/api/leaderboard
   
   # Submit a test score
   curl -X POST https://your-app.vercel.app/api/leaderboard \
     -H "Content-Type: application/json" \
     -d '{"name":"ProdTest","score":999}'
   ```

### Environment Variables

Vercel automatically provides `KV_REST_API_URL` and `KV_REST_API_TOKEN` when you link to Upstash. If needed, verify them in the Vercel project settings under **Settings > Environment Variables**.

### Troubleshooting Deployment

- **401/403 from leaderboard endpoint**: Check that the Upstash token is correctly set in Vercel env vars.
- **Leaderboard returning 500**: Check Vercel function logs for the full error (usually shown in the Vercel dashboard).
- **Rate limit errors**: The API limits submissions to 10 per IP per minute; wait a minute and retry.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Upstash Redis Documentation](https://upstash.com/docs/redis/overview)
- [Vercel Documentation](https://vercel.com/docs)
