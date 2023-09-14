#syntax=docker/dockerfile:1.6.0
FROM messense/cargo-zigbuild
RUN apt-get update && apt-get install -yq build-essential clang protobuf-compiler cmake librocksdb-dev libssl-dev libclang-dev
RUN <<EOF
set -xe
rustup toolchain install stable && rustup default stable
rustup target add aarch64-apple-darwin
rustup target add aarch64-unknown-linux-gnu
rustup target add aarch64-unknown-linux-musl
rustup target add x86_64-apple-darwin
rustup target add x86_64-pc-windows-gnu
rustup target add x86_64-unknown-linux-gnu
rustup target add x86_64-unknown-linux-musl
EOF
