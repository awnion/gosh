# syntax=docker/dockerfile:1.4.1

FROM --platform=${BUILDPLATFORM} rust:bullseye AS rustlatest

FROM rustlatest AS build

WORKDIR /build
COPY --link Cargo.toml Cargo.toml
COPY --link crates crates
COPY --link src src
COPY --link resources resources

RUN apt-get update && apt-get install -yq build-essential cmake

ARG TARGETOS TARGETARCH
RUN \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=./target \
    cargo build --release --bin git-remote-gosh && cp target/release/git-remote-gosh .


FROM debian:bullseye-slim
RUN <<EOF
    apt-get update
    apt-get install -yq --no-install-recommends git libssl1.1 libc6 ca-certificates
    apt-get clean
EOF
COPY --from=build /build/git-remote-gosh /usr/local/bin/git-remote-gosh

WORKDIR /workdir
ENTRYPOINT [ "git" ]
