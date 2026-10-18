# Build ng Spring Boot jar, tapos runtime na jar lang ang laman.
# Kung hindi mahanap ang tag ng Java 25, tingnan ang Docker Hub: maven / eclipse-temurin.
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
COPY backend/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
RUN mvn -q -B -DskipTests package && cp target/*.jar /app.jar

FROM eclipse-temurin:25-jre
RUN useradd --system --create-home app
USER app
WORKDIR /home/app
COPY --from=build /app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
