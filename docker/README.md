# FIO Analyzer Production Deployment

This directory contains Docker configuration for production deployment with Nginx reverse proxy.

## Architecture

```
Internet -> Nginx (Port 80) -> Frontend (Port 3000) & Backend (Port 8000)
```

- **Nginx**: Reverse proxy serving the application on port 80
- **Frontend**: React SPA served by Nginx (optimized static files)
- **Backend**: Node.js/Express API server
- **Database**: SQLite with persistent volume

## Quick Start

## Manual Deployment

If you prefer manual deployment:

```bash
cd docker

# Create data directories
mkdir -p data/backend/db data/backend/uploads

# Build and start services
dokcer compose up --build -d

# Check status
dokcer compose ps

# View logs
dokcer compose logs -f
```

## Service Management

```bash
# Stop services
dokcer compose down

# Restart services
dokcer compose restart

# View logs
dokcer compose logs -f [service_name]

# Update services
dokcer compose up --build -d
```


## Environment Variables

1. **Copy the sample configuration:**
   ```bash
   cp docker/.env.example docker/.env
   ```

2. **Edit for your environment:**
   ```bash
   nano docker/.env
   ```

3. **Sample configurations:**
   ```bash
   # Local development
   EXTERNAL_URL=http://localhost
   
   # Production server
   EXTERNAL_URL=http://fio-analyzer.company.com
   
   # Custom port
   EXTERNAL_URL=http://server.local:8080
   
   # HTTPS
   EXTERNAL_URL=https://fio-analyzer.company.com
   ```

The frontend will automatically use `${EXTERNAL_URL}/api` as the backend endpoint.

## Persistent Data

- Database: `./data/backend/db/storage_performance.db`
- Uploads: `./data/backend/uploads/`

## Scaling

To scale the backend:
```bash
dokcer compose up --scale backend=3 -d
```

## Troubleshooting

1. **Port 80 already in use:**
   ```bash
   # Change port in compose.yml
   ports:
     - "8080:80"  # Use port 8080 instead
   ```

2. **Permission issues:**
   ```bash
   sudo chown -R $USER:$USER data/
   ```

3. **Check service health:**
   ```bash
   curl http://localhost/health
   ```

## Production Checklist

- [ ] Update default credentials
- [ ] Configure backup for database
- [ ] Set up monitoring
- [ ] Configure log rotation
- [ ] Review security settings
- [ ] Test file upload limits 