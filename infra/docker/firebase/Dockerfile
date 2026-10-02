# The Firebase emulator suite (Auth + Storage) has no official image, and the emulators
# run on the JVM — this builds once and Compose caches it.
FROM node:24.14.0-alpine

# `--ignore-scripts`: firebase-tools needs no install script; it downloads the emulator
# JARs on first start, into the running user's ~/.cache/firebase.
RUN apk add --no-cache openjdk21-jre-headless \
  && npm install -g --ignore-scripts firebase-tools@15.32.0

# Owned by `node`: the CLI writes firebase-debug.log into its working directory.
RUN install -d -o node -g node /firebase
WORKDIR /firebase
COPY --chown=node:node firebase.json storage.rules ./

# The image's built-in unprivileged user — never root.
USER node

CMD ["firebase", "emulators:start", "--project", "demo-brewlite", "--only", "auth,storage"]
