# The Firebase emulator suite (Auth + Storage) has no official image, and the emulators
# run on the JVM — this builds once and Compose caches it.
FROM node:24.14.0-alpine

RUN apk add --no-cache openjdk21-jre-headless \
  && npm install -g firebase-tools@15.32.0

WORKDIR /firebase
COPY firebase.json storage.rules ./

CMD ["firebase", "emulators:start", "--project", "demo-brewlite", "--only", "auth,storage"]
