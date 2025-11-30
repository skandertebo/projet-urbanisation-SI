FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copier tous les fichiers
COPY . .

# Télécharger les dépendances et générer go.sum
RUN go mod download && go mod tidy

# Construire l'application
RUN CGO_ENABLED=0 GOOS=linux go build -o notification-service .

# Image finale
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/notification-service .

EXPOSE 8083

CMD ["./notification-service"]

