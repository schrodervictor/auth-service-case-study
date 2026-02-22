VOLUME_ARGS = \
	--volume ./src:/app/src \
	--volume ./tests:/app/tests \
	--volume ./config:/app/config app

RUN_ISOLATED := docker compose run --rm --no-deps $(VOLUME_ARGS)
RUN_WITH_DEPS := docker compose run --rm $(VOLUME_ARGS)


########################
## Docker Compose Env ##
########################

.PHONY: build up down wait-for-app

build:
	docker compose build --quiet app

up: build
	docker compose up -d

down:
	docker compose down

wait-for-app:
	@echo "Waiting for app on http://localhost:9000 ..."
	URL=http://localhost:9000/partner-app/api/health-check; \
	@i=0; while [ $$i -lt 30 ]; do \
		if curl -sf "$$URL" > /dev/null 2>&1; then \
			echo "App is ready."; exit 0; \
		fi; \
		sleep 1; i=$$((i + 1)); \
	done; \
	echo "Timed out waiting for app." >&2; \
	exit 1


###########
## Tests ##
###########

.PHONY: test test-unit test-integration test-acceptance coverage

test: build test-unit test-integration test-acceptance

test-unit: build
	$(RUN_ISOLATED) npm run test:unit

test-integration: build
	$(RUN_WITH_DEPS) npm run test:integration

test-acceptance: up wait-for-app
	docker compose run --rm acceptance
	docker compose down

coverage: build
	$(RUN_WITH_DEPS) npm run test:cov -- \
		--testPathPatterns='tests/(unit|integration)' \
		--runInBand


##################
## Code Quality ##
##################

.PHONY: format lint typecheck

lint: build
	$(RUN_ISOLATED) npm run lint

typecheck: build
	$(RUN_ISOLATED) npm run typecheck

format: build
	$(RUN_ISOLATED) sh -c ' \
		npx prettier --write "src/**/*.ts" "tests/**/*.ts" \
		&& npx eslint --fix src/ tests/ \
	'
