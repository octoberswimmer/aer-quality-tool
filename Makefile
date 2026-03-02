SHELL := /bin/bash

SEMVER_TAG_PATTERN ?= v[0-9]*.[0-9]*.[0-9]*

.PHONY: print-next-tag tag

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
