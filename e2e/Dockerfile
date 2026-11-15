FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /tests
COPY e2e/package*.json ./
RUN npm ci
COPY e2e/ ./
ENV BASE_URL=http://app:8080
CMD ["npm","test"]
