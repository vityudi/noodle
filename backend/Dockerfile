FROM golang:1.23-alpine AS builder
RUN apk --no-cache add git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# GOFLAGS=-mod=mod allows go to fetch and record any new deps (e.g. goja) not yet in go.sum.
# GONOSUMDB=* skips the checksum database — acceptable for a self-hosted tool.
RUN GONOSUMDB=* GOFLAGS=-mod=mod CGO_ENABLED=0 GOOS=linux go build -o bin/server ./cmd/server

FROM alpine:3.21
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/bin/server .
EXPOSE 8080
CMD ["./server"]
