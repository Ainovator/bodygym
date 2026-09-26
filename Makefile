.PHONY: up down logs test check migrate dev-backend dev-frontend integration
up:
	docker compose up --build -d
down:
	docker compose down
logs:
	docker compose logs -f backend frontend
test:
	cd backend && go test ./...
	cd frontend && npm test
check:
	cd backend && go test ./... && go vet ./...
	cd frontend && npm run build
	docker compose config --quiet
migrate:
	docker compose run --rm migrate
dev-backend:
	cd backend && go run ./cmd/api
dev-frontend:
	cd frontend && npm run dev
integration:
	cd frontend && npm run test:e2e
