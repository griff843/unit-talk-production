# Local Development Setup

This guide will help you set up and run Unit Talk locally for development and testing.

## Quick Start

### 1. Start Local Services

```bash
# Start essential services (PostgreSQL, Redis, Temporal)
npm run dev:start
```

This will:
- Start PostgreSQL on port 5432
- Start Redis on port 6379  
- Start Temporal Server on port 7233
- Start Temporal Web UI on port 8080

### 2. Run E2E Tests

```bash
# Run E2E tests with external worker (bypasses native bridge issues on Windows)
npm run test:e2e:external
```

### 3. View Services

- **Temporal Web UI**: http://localhost:8080
- **Prometheus**: http://localhost:9090 (if started)

## Available Scripts

### Development Services
```bash
npm run dev:start          # Start all essential services
npm run dev:services       # Start services with docker compose directly
npm run dev:stop           # Stop all services
npm run dev:logs           # View service logs
npm run dev:status         # Check service status
```

### Testing
```bash
npm run test:e2e:external  # E2E tests with external worker (Windows compatible)
npm run test:e2e:local     # E2E tests with local worker
npm run test:temporal      # Temporal workflow tests only
npm run test:validate-setup # Validate environment setup
```

### Syndicate System
```bash
npm run syndicate:start    # Start syndicate scheduler
npm run syndicate:status   # Check syndicate status
npm run syndicate:stop     # Stop syndicate scheduler
```

## Troubleshooting

### Services Won't Start
1. Make sure Docker Desktop is running
2. Check if ports are available:
   - 5432 (PostgreSQL)
   - 6379 (Redis)
   - 7233 (Temporal Server)
   - 8080 (Temporal Web UI)
3. Try stopping and restarting:
   ```bash
   npm run dev:stop
   npm run dev:start
   ```

### E2E Tests Failing
1. Make sure services are running:
   ```bash
   npm run dev:status
   ```
2. Check Temporal server is accessible:
   ```bash
   curl http://localhost:7233/api/v1/namespaces/default/describe
   ```
3. Use external worker for Windows compatibility:
   ```bash
   npm run test:e2e:external
   ```

### Native Bridge Issues (Windows)
The external worker approach (`test:e2e:external`) bypasses native bridge compatibility issues by running the Temporal worker in a separate process.

### Environment Variables
Create a `.env` file in the root directory. You can copy from `.env.test` or `.env.prod` as needed.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │    │   Temporal      │
│   (port 5432)   │    │   (port 6379)   │    │   (port 7233)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Application   │
                    │   (port 3000)   │
                    └─────────────────┘
```

## Next Steps

1. **Start Services**: `npm run dev:start`
2. **Run Tests**: `npm run test:e2e:external`
3. **Start Application**: `docker compose up app`
4. **View Workflows**: http://localhost:8080

For more detailed setup, use: `npm run dev:setup`