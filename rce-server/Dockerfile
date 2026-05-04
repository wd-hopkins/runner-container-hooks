# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o rce-server .

# Run stage
FROM ghcr.io/actions/actions-runner:latest

COPY --from=builder /app/rce-server /home/runner/externals

USER root

RUN chown runner:docker /home/runner/externals/rce-server

EXPOSE 33333

ENTRYPOINT ["./rce-server"]
CMD ["-port", "33333"]

USER runner
