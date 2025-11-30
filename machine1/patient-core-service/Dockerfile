FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

# Copier les fichiers pom et source
COPY pom.xml .
COPY src ./src

# Construire l'application
RUN mvn clean package -DskipTests

# Image finale
FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

# Copier le JAR depuis l'étape de build
COPY --from=build /app/target/patient-core-service-1.0.0.jar app.jar

# Créer le répertoire pour les données
RUN mkdir -p /app/data

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
