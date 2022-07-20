# syntax=docker/dockerfile:1.4.1

FROM rust:bullseye AS rustlatest

FROM rustlatest AS build

WORKDIR /src

RUN apt-get update && apt-get install -yq build-essential cmake

RUN \
    --mount=type=bind,target=".",rw \
    --mount=type=cache,target="/usr/local/cargo/git" \
    --mount=type=cache,target="/usr/local/cargo/registry" \
    --mount=type=cache,target="./target",sharing=private \
    cargo install --path . --bin git-remote-gosh

FROM debian:bullseye-slim
RUN <<EOF
    apt-get update
    apt-get install -yq --no-install-recommends git libssl1.1 libc6 ca-certificates
EOF
COPY --from=build /usr/local/cargo/bin/git-remote-gosh /usr/local/bin/git-remote-gosh

WORKDIR /workdir
ENTRYPOINT [ "git" ]
