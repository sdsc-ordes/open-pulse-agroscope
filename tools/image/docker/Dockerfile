# Dev workspace image — Ubuntu + Node + Python for agent skills and web scaffolding.
# Playwright/Chromium runs in the playwright-mcp sidecar, not here.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    python3 \
    python3-pip \
    python3-venv \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 (skills and future src/your-web tooling)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=1000

# ubuntu:24.04 already ships a user/group at uid/gid 1000 (usually "ubuntu") — remove it first.
RUN if getent passwd "${USER_UID}" > /dev/null; then userdel -r "$(getent passwd "${USER_UID}" | cut -d: -f1)"; fi \
    && if getent group "${USER_GID}" > /dev/null; then groupdel "$(getent group "${USER_GID}" | cut -d: -f1)"; fi \
    && groupadd --gid "${USER_GID}" "${USERNAME}" \
    && useradd -s /bin/bash --uid "${USER_UID}" --gid "${USER_GID}" -m "${USERNAME}" \
    && echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# NOTE: USER does not strip shell-style quotes — `USER "${USERNAME}"` would bake
# literal double quotes into the image config and break container start.
USER ${USERNAME}
WORKDIR /home/node
