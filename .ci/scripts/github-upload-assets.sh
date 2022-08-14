#!/bin/bash

set -e 
set -o pipefail

TOKEN=$1
VERSION=$2
ASSET=$3

UPLOAD_URL=$(curl -sH "Authorization: token ${TOKEN}" \
    "https://api.github.com/repos/gosh-sh/gosh/releases/tags/v${VERSION}" | jq -r '.upload_url' | cut -d'{' -f1)

curl -sX POST -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" -H "Content-Type: $(file -b --mime-type $ASSET)" \
    -H "Content-Length: $(wc -c < $ASSET | xargs)" \
    -T $ASSET "${UPLOAD_URL}?name=$(basename $ASSET)" | cat