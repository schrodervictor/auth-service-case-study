# User Authentication Service

A microservice for user registration, authentication, and profile management.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js with inversify-express-utils
- **Database:** PostgreSQL with TypeORM
- **DI Container:** Inversify
- **Testing:** Jest with Supertest

## Getting Started

```bash
# Install dependencies
npm install --omit optional

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

## Scripts

| Command             | Description             |
| ------------------- | ----------------------- |
| `npm run dev`       | Start dev server        |
| `npm run build`     | Compile TypeScript      |
| `npm start`         | Run compiled output     |
| `npm test`          | Run tests               |
| `npm run test:cov`  | Run tests with coverage |
| `npm run lint`      | Lint check              |
| `npm run typecheck` | Type check without emit |
