# Manual Setup Guide

If the automated scripts don't work, you can set up the services manually.

## Prerequisites

1. **Docker Desktop** - Download and install from https://www.docker.com/products/docker-desktop/
2. **Make sure Docker Desktop is running** - Check the system tray for the Docker icon

## Manual Service Setup

### 1. Start Docker Desktop
- Open Docker Desktop application
- Wait for it to fully start (Docker icon in system tray should be green)

### 2. Start Services
Open PowerShell or Command Prompt in the project directory and run:

```bash
# Start all essential services
docker compose up -d postgres redis temporal temporal-web
```

### 3. Verify Services
Check that services are running:

```bash
# Check running containers
docker compose ps

# Check specific ports
netstat -an | findstr "5432 6379 7233 8080"
```

### 4. Wait for Services to be Ready
Services need time to initialize:
- **PostgreSQL**: ~30 seconds
- **Redis**: ~10 seconds  
- **Temporal**: ~60 seconds
- **Temporal Web UI**: ~30 seconds

### 5. Test Connection
```bash
# Test Temporal connection
curl http://localhost:7233/api/v1/namespaces/default/describe
```

## Service URLs

- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Temporal Server**: localhost:7233
- **Temporal Web UI**: http://localhost:8080

## Run E2E Tests

Once services are running:

```bash
npm run test:e2e:external
```

## Stop Services

```bash
docker compose down
```

## Troubleshooting

### Docker Desktop Issues
- Make sure Docker Desktop is running (check system tray)
- Restart Docker Desktop if needed
- Check Docker Desktop settings for WSL2 integration (Windows)

### Port Conflicts
If ports are already in use:
```bash
# Find what's using the port
netstat -ano | findstr :5432
netstat -ano | findstr :7233

# Kill the process if needed (replace PID)
taskkill /PID <PID> /F
```

### Service Health
```bash
# Check service logs
docker compose logs postgres
docker compose logs temporal
docker compose logs temporal-web

# Restart a specific service
docker compose restart temporal
```

### Environment Variables
Create a `.env` file in the project root:
```bash
# Copy from example
copy .env.test .env
```

## Alternative: Use npm scripts

```bash
# Start services
npm run dev:services

# Check status  
npm run dev:status

# View logs
npm run dev:logs

# Stop services
npm run dev:stop
```