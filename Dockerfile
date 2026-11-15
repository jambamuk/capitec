# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run lint && npm run format:check && npm test && npm run build

FROM maven:3.9.11-eclipse-temurin-21 AS java-base
WORKDIR /build
COPY pom.xml ./
COPY backend/pom.xml backend/pom.xml
COPY mock-sources/pom.xml mock-sources/pom.xml
RUN mvn -B -ntp dependency:go-offline
COPY backend/src backend/src
COPY mock-sources/src mock-sources/src

FROM java-base AS java-test
CMD ["mvn","-B","-ntp","verify"]

FROM java-base AS java-build
COPY --from=frontend-build /build/frontend/dist backend/src/main/resources/static
RUN mvn -B -ntp package -DskipTests

FROM java-base AS source-build
RUN mvn -B -ntp -pl mock-sources -am package -DskipTests
FROM eclipse-temurin:21-jre-jammy AS source
WORKDIR /app
COPY --from=source-build /build/mock-sources/target/mock-sources-1.0.0-SNAPSHOT.jar app.jar
USER 10001
ENTRYPOINT ["java","-jar","app.jar"]

FROM eclipse-temurin:21-jre-jammy AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* && groupadd --gid 10001 finance && useradd --uid 10001 --gid finance --create-home finance && mkdir -p /data/statements && chown finance:finance /data/statements
WORKDIR /app
COPY --from=java-build /build/backend/target/backend-1.0.0-SNAPSHOT.jar app.jar
USER finance
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70"
ENTRYPOINT ["java","-jar","app.jar"]
