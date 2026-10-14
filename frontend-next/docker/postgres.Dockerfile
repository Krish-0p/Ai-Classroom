FROM postgres:17-alpine AS builder
ARG PGVECTOR_VERSION=0.8.0
RUN apk add --no-cache build-base git \
    && git clone --branch v${PGVECTOR_VERSION} --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector && make OPTFLAGS="" with_llvm=no && make install with_llvm=no

FROM postgres:17-alpine
COPY --from=builder /usr/local/lib/postgresql/vector.so /usr/local/lib/postgresql/vector.so
COPY --from=builder /usr/local/share/postgresql/extension/vector* /usr/local/share/postgresql/extension/
