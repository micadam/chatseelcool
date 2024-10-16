#!/bin/bash

set -euo pipefail

npm run build

# build the image for amd64 and arm64
for platform in arm64; do
    docker build -t coolseel-bot:$platform --platform linux/$platform .
done

# tag the image for arm64
docker tag coolseel-bot:arm64 192.168.1.13:5000/coolseel-bot

# push the image to the registry
docker push 192.168.1.13:5000/coolseel-bot