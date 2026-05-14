# Ordkobling
A professional Norwegian word connection game built with modern web technologies and a focus on performance and high-precision interaction.

## Tech Stack & Architecture

- **Runtime**: [Node.js v24](https://nodejs.org/) (managed via `fnm`)
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 (using the new CSS-first engine)
- **State Management**: React 19 Hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
- **Testing**: Vitest and JSDOM
- **Package Manager**: pnpm

### Core Logic
- **Grid Generation**: Algorithmic checkerboard generation with protected "Snake-style" bonus word injection.
- **Interaction Engine**: Mathematical hit-detection with magnetic snapping and backtracking support.
- **API Layer**: Server-side proxy for the University of Bergen's Ordbøkene API to ensure dictionary validation.
- **Persistence**: Local high-score tracking via `localStorage`.

## Project Structure
- `/app`: App Router pages and API routes for dictionary validation.
- `/components`: React UI components and main game logic.
- `/__tests__`: Unit test suites for core logic (scoring, adjacency, grid generation).

## Development Setup

This project uses **fnm** for Node version management and **pnpm** for package management.

## Getting Started

1. **Node Version**: Ensure the correct Node version is active:
   ```bash
   fnm use
   ```
2. **Dependencies**: Install the project dependencies:
   ```bash
   pnpm install
   ```
3. **Development**: Start the local development server:
   ```bash
   pnpm dev
   ```
4. **Testing**: Run the unit test suite:
   ```bash
   pnpm test
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
