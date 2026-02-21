# syntax=docker/dockerfile:1

FROM node:21-alpine3.18 AS builder
WORKDIR /app

RUN apk add openssh \
    && apk add git \
    && mkdir -p -m 0600 ~/.ssh \
    && ssh-keyscan github.com >> ~/.ssh/known_hosts

# Changed id=github_ssh_key to id=default to match local env
# will be reverted back to the original at the end.
RUN --mount=type=ssh,id=default yarn install --production

# Spliting the copy of src and package/yarn greatly abbreviates
# build times during development.
COPY package.json yarn.lock .
RUN yarn install --ignore-optional

# Ideally a development image should not copy source code,
# but mount/build it on demand. Keeping it for now.
COPY . .
RUN yarn build


FROM node:19-alpine3.16 AS final
WORKDIR /app
COPY ["package.json", "./"]
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 9000
CMD ["yarn", "start" ]
