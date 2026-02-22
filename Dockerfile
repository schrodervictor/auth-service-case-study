# syntax=docker/dockerfile:1

FROM node:24-alpine3.23 AS base
WORKDIR /app

RUN apk add openssh \
    && apk add git \
    && mkdir -p -m 0600 ~/.ssh \
    && ssh-keyscan github.com >> ~/.ssh/known_hosts


# Fast, simplyfied image for development with no source code included.
# Expected to mount code at `/app/src` and `/app/tests`.
FROM base AS dev

# Spliting the copy of src and package/yarn greatly abbreviates
# build times during development, in case deps haven't changed
COPY package*.json .
RUN --mount=type=ssh,id=default npm install --omit optional

# Copy the remaining dev config files
COPY eslint.config.mjs jest.config.json prettierrc.json tsconfig.json .

EXPOSE 9000
CMD ["npm", "run", "dev"]


FROM base AS builder

# Spliting the copy of src and package/yarn greatly abbreviates
# build times, in case deps haven't changed
COPY package*.json .

# Changed id=github_ssh_key to id=default to match local env
# will be reverted back to the original at the end.
RUN --mount=type=ssh,id=default npm install --include prod

COPY . .
RUN npm run build


# For better security, the final image should be pure alpine of the
# same version, containing only the node binary (no yarn/npm)
FROM node:24-alpine3.23 AS final
WORKDIR /app

COPY --from=builder /app/package*.json .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 9000
CMD ["npm", "start" ]
