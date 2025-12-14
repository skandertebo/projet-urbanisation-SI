FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy all files
COPY . .

# Download dependencies and generate go.sum
RUN go mod download && go mod tidy

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o sync-service .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/sync-service .

EXPOSE 8085

CMD ["./sync-service"]

