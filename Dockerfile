# syntax=docker/dockerfile:1

FROM node:24-alpine3.23 AS builder
WORKDIR /app

RUN apk add openssh \
    && apk add git \
    && mkdir -p -m 0600 ~/.ssh \
    && ssh-keyscan github.com >> ~/.ssh/known_hosts

# Spliting the copy of src and package/yarn greatly abbreviates
# build times during development.
COPY package*.json .

# Changed id=github_ssh_key to id=default to match local env
# will be reverted back to the original at the end.
RUN --mount=type=ssh,id=default npm install --omit optional

# Ideally a development image should not copy source code,
# but mount/build it on demand. Keeping it for now.
COPY . .
RUN npm build


# For better security, the final image should be pure alpine of the
# same version, containing only the node binary (no yarn/npm)
FROM node:24-alpine3.23 AS final
WORKDIR /app

COPY --from=builder package*.json .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 9000
CMD ["npm", "start" ]
