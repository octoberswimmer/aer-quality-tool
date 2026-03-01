SHELL := /bin/bash

SEMVER_TAG_PATTERN ?= v[0-9]*.[0-9]*.[0-9]*
DOCKERFILE ?= copado/images/Dockerfile
PLATFORM ?= linux/amd64

# Required for docker targets. Example:
# make docker-build TAG=v0.1.0
IMAGE ?= ghcr.io/octoberswimmer/aer-copado-quality-tool
TAG ?=

.PHONY: print-next-tag tag print-docker-tag check-image docker-build docker-publish

print-next-tag:
	@latest=$$(git tag --list '$(SEMVER_TAG_PATTERN)' --sort=-v:refname | head -n1); \
	if [[ -z "$$latest" ]]; then \
		echo "v0.1.0"; \
	elif [[ "$$latest" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$$ ]]; then \
		major=$${BASH_REMATCH[1]}; \
		minor=$${BASH_REMATCH[2]}; \
		echo "v$${major}.$$((minor + 1)).0"; \
	else \
		echo "Unable to parse latest tag '$$latest'." >&2; \
		exit 1; \
	fi

tag:
	@latest=$$(git tag --list '$(SEMVER_TAG_PATTERN)' --sort=-v:refname | head -n1); \
	if [[ -z "$$latest" ]]; then \
		next_tag="v0.1.0"; \
	elif [[ "$$latest" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$$ ]]; then \
		major=$${BASH_REMATCH[1]}; \
		minor=$${BASH_REMATCH[2]}; \
		next_tag="v$${major}.$$((minor + 1)).0"; \
	else \
		echo "Unable to parse latest tag '$$latest'." >&2; \
		exit 1; \
	fi; \
	if git rev-parse -q --verify "refs/tags/$$next_tag" >/dev/null; then \
		echo "Tag $$next_tag already exists." >&2; \
		exit 1; \
	fi; \
	git tag -a "$$next_tag" -m "release $$next_tag"; \
	echo "Created tag $$next_tag"

print-docker-tag:
	@if [[ -n "$(TAG)" ]]; then \
		echo "$(TAG)"; \
	else \
		latest=$$(git tag --list '$(SEMVER_TAG_PATTERN)' --sort=-v:refname | head -n1); \
		if [[ -n "$$latest" ]]; then \
			echo "$$latest"; \
		else \
			echo "v0.1.0"; \
		fi; \
	fi

check-image:
	@if [[ -z "$(IMAGE)" ]]; then \
		echo "IMAGE is required. Example: make docker-build IMAGE=ghcr.io/<owner>/<name> TAG=v0.1.0" >&2; \
		exit 1; \
	fi

docker-build: check-image
	@if [[ -n "$(TAG)" ]]; then \
		image_tag="$(TAG)"; \
	else \
		latest=$$(git tag --list '$(SEMVER_TAG_PATTERN)' --sort=-v:refname | head -n1); \
		if [[ -n "$$latest" ]]; then \
			image_tag="$$latest"; \
		else \
			image_tag="v0.1.0"; \
		fi; \
	fi; \
	echo "Building $(IMAGE):$$image_tag from $(DOCKERFILE)"; \
	docker buildx build --platform "$(PLATFORM)" --load -f "$(DOCKERFILE)" -t "$(IMAGE):$$image_tag" .

docker-publish: check-image
	@if [[ -n "$(TAG)" ]]; then \
		image_tag="$(TAG)"; \
	else \
		latest=$$(git tag --list '$(SEMVER_TAG_PATTERN)' --sort=-v:refname | head -n1); \
		if [[ -n "$$latest" ]]; then \
			image_tag="$$latest"; \
		else \
			image_tag="v0.1.0"; \
		fi; \
	fi; \
	echo "Building and publishing $(IMAGE):$$image_tag for $(PLATFORM)"; \
	docker buildx build --platform "$(PLATFORM)" --push -f "$(DOCKERFILE)" -t "$(IMAGE):$$image_tag" .
