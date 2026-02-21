RUN_ISOLATED := docker compose run --rm --no-deps -v ./src:/app/src -v ./tests:/app/tests -v ./config:/app/config app
RUN_WITH_DEPS := docker compose run --rm -v ./src:/app/src -v ./tests:/app/tests -v ./config:/app/config app

.PHONY: build up down wait-for-app lint typecheck test test-unit test-integration test-acceptance

build:
	docker compose build --quiet app

up: build
	docker compose up -d

down:
	docker compose down

wait-for-app:
	@echo "Waiting for app on http://localhost:9000 ..."
	@i=0; while [ $$i -lt 30 ]; do \
		if curl -sf http://localhost:9000/partner-app/api/health-check > /dev/null 2>&1; then \
			echo "App is ready."; exit 0; \
		fi; \
		sleep 1; i=$$((i + 1)); \
	done; \
	echo "Timed out waiting for app." >&2; exit 1

lint: build
	$(RUN_ISOLATED) npm run lint

typecheck: build
	$(RUN_ISOLATED) npm run typecheck

test: build test-unit test-integration test-acceptance

test-unit: build
	$(RUN_ISOLATED) npm run test:unit

test-integration: build
	$(RUN_WITH_DEPS) npm run test:integration

test-acceptance: up wait-for-app
	docker compose run --rm acceptance
	docker compose down
