DOCKER              ?= docker
DOCKER_BUILDER_NAME ?= public-gosh-builder
DOCKER_BUILDX       ?= ${DOCKER} buildx --builder ${DOCKER_BUILDER_NAME} build
PLATFORM            ?= linux/amd64,linux/arm64
PROGRESS            ?= plain

GIT_COMMIT := $(shell git rev-parse HEAD)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD | tr / _)

# main ==> docker:latest
ifeq "${GIT_BRANCH}" "main"
	GIT_BRANCH := "latest"
endif

.DEFAULT_GOAL := test

clean: clear_abi
	@echo ===clean
	-${DOCKER} buildx rm ${DOCKER_BUILDER_NAME} || true

clear_screen:
	-clear && printf '\e[3J'

clear_abi:
	-rm ./resources/*.abi.json

copy_abi: clear_abi
	-mkdir -p ./resources
	-cp ../contracts/gosh/*.abi.json ./resources/

build: copy_abi clear_screen
	cargo build

test: copy_abi clear_screen
	cargo test

qemu: ## may need to setup qemu
	docker run --privileged --rm tonistiigi/binfmt --install all

debug_build: copy_abi
	@echo === prepare-builder
	( ${DOCKER} buildx inspect ${DOCKER_BUILDER_NAME} ) || ${DOCKER} buildx create \
		--name ${DOCKER_BUILDER_NAME} \
		--driver docker-container

	@echo === build + publish
	${DOCKER_BUILDX} \
		--load \
		-t teamgosh/git \
		--progress=${PROGRESS} \
		\
		-f Dockerfile \
		.

bench: copy_abi
	@echo === prepare-builder
	( ${DOCKER} buildx inspect ${DOCKER_BUILDER_NAME} ) || ${DOCKER} buildx create \
		--name ${DOCKER_BUILDER_NAME} \
		--driver docker-container

	@echo === build + publish
	${DOCKER_BUILDX} \
		--progress=${PROGRESS} \
		--platform ${PLATFORM} \
		\
		-f Dockerfile \
		.


publish: copy_abi
	@echo === prepare-builder
	( ${DOCKER} buildx inspect ${DOCKER_BUILDER_NAME} ) || ${DOCKER} buildx create \
		--name ${DOCKER_BUILDER_NAME} \
		--driver docker-container

	@echo === build + publish
	${DOCKER_BUILDX} \
		--push \
		--progress=${PROGRESS} \
		--platform ${PLATFORM} \
		-t teamgosh/git:${GIT_COMMIT} \
		-t teamgosh/git:${GIT_BRANCH} \
		-t teamgosh/git:latest \
		\
		-f Dockerfile \
		.


.PHONY: clean build clear_abi copy_abi clear_screen test publish bench
