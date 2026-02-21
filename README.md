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

# Start development server (uses config/default.json by default)
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

## Common Issues

### Changes to config files not taking effect

Files like `package.json`, `jest.config.json`, `tsconfig.json`, `.eslintrc`, and
`prettierrc.json` are copied into the Docker image at build time. If you modify
any of these, you must rebuild the image before running again:

```bash
docker compose build app
```

### Docker Compose using a stale app image

If `docker compose up` or `docker compose down && docker compose up` keeps
running an old version of the app, remove the existing image first:

```bash
docker image rm marta-app:latest
docker compose up
```
