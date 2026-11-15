# Frontend

See the [repository README](../README.md) for Docker startup, accounts, API contracts and end-to-end checks.

TanStack Router manages navigation and URL filters; TanStack Query manages server state. UI components are generated from shadcn's radix-nova preset and checked into src/components/ui. Use the shadcn CLI to add components.

Local commands: npm ci, npm run dev, npm run lint, npm run format:check, npm run build. Vite proxies the backend on port 8080. Docker builds the same frontend and embeds it in Spring Boot.
