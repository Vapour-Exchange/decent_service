IMAGE_NAME = decent-service
CONTAINER_NAME = decent-service
PORT = 3000

build:
	docker build -t $(IMAGE_NAME) .

run: clean build
	docker run -d -p $(PORT):$(PORT) --name $(CONTAINER_NAME) $(IMAGE_NAME)

clean:
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true

log:
	docker logs -f $(CONTAINER_NAME)

dev: run log
	@echo "Application is running at http://localhost:$(PORT)"

.PHONY: build run clean dev
