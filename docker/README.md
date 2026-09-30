# FIO Analyzer Production Deployment

This directory contains Docker configuration for production deployment in a single consolidated container.

## Architecture

```
Internet -> HTTPS reverse proxy -> 127.0.0.1:80 -> Container nginx -> Frontend + Backend
```

- **Single Container**: Consolidated architecture with nginx and FastAPI
- **Nginx**: Serves static files and reverse proxies `/api/*` to backend
- **Frontend**: React SPA served as optimized static files
- **Backend**: Python FastAPI server with authentication
- **Database**: SQLite with persistent volume
- **Authentication**: Role-based access control with external user management

Both Compose files bind HTTP to the host's loopback interface only. Local access remains
available at `http://localhost/`; for remote access, configure an HTTPS reverse proxy
on the host to forward to `http://127.0.0.1:80`. Do not expose port 80 publicly:
the browser session cookie and the HTTP Basic credentials of upload scripts travel in
every API request. The proxy must send `X-Forwarded-Proto: https`, so the backend marks
the session cookie `Secure` (or set `COOKIE_SECURE=true` for the backend). If the proxy runs
in another container, connect it over a private Docker network rather than publishing
the app's HTTP port externally. The production Compose file uses a registry image;
publish an updated image to include the multipart dependency and upload-limit fixes.

### Browser sessions

The web interface checks the password once at login (`POST /api/auth/login`) and then uses
an `HttpOnly`, `SameSite=Strict` session cookie; the browser never stores the password.
Backend settings (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `SESSION_LIFETIME_HOURS` | `48` | Absolute session lifetime; log in again afterwards |
| `COOKIE_SECURE` | `auto` | `auto` = `Secure` when the request came over HTTPS (also via `X-Forwarded-Proto`); `true`/`false` to force. **Set `true` for every HTTPS deployment**, so a proxy without the header cannot downgrade the cookie |
| `CORS_ORIGINS` | dev: `http://localhost:5173,http://127.0.0.1:5173`; Compose: empty | Browser origins that may call the API with the cookie; production serves one origin and needs none |

A session ends early on logout, and as soon as the user's password or role changes or the
user is removed. Logging in again ends the previous session. After 10 failed logins for
one username from one address (browser login and HTTP Basic together), further attempts
get HTTP 429 for 5 minutes. Behind the HTTPS proxy all clients may share one address; the
limit then works per username, and wrong guesses can lock that user out for 5 minutes. Keep each
username in one role file only (`manage_users.py add` refuses duplicates; the backend logs
a warning at startup if it finds any). Upload scripts (`fio-test.sh`) keep using HTTP Basic.

## Quick Start

```bash
cd docker

# Create required directories
mkdir -p data/backend/db data/backend/uploads data/auth

# Build and start the application
docker compose up --build -d

# Setup authentication (first time only)
# Admin users (full access)
docker exec -it fio-app python scripts/manage_users.py add --admin --username admin --password your_password

# Upload-only users (restricted access)  
docker exec -it fio-app python scripts/manage_users.py add --username uploader --password your_password

# Download testing script
wget http://localhost/fio-test.sh
```

## Production Deployment

For production deployment using pre-built registry images:

```bash
cd docker

# Create data directories
mkdir -p data/backend/db data/backend/uploads data/auth

# Deploy using production compose file
docker compose -f compose.prod.yml up -d

# Check status
docker compose -f compose.prod.yml ps

# View logs
docker compose -f compose.prod.yml logs -f
```

## Service Management

```bash
# Stop services
docker compose down

# Restart services
docker compose restart

# View logs
docker compose logs -f

# Update services (rebuild)
docker compose up --build -d

# Production service management
docker compose -f compose.prod.yml down
docker compose -f compose.prod.yml restart
```

## Downloaded Files & Static Content

The application serves static files directly via nginx:

```bash
# Download testing script
wget http://your-server/fio-test.sh

# Setup and use
chmod +x fio-test.sh
# Use --generate-env to create a .env file
./fio-test.sh --generate-env
# Edit .env with your server settings
./fio-test.sh
```

## Persistent Data

All data is stored in Docker volumes for persistence:

```yaml
volumes:
  - ./data/backend/db:/app/db                    # SQLite database
  - ./data/backend/uploads:/app/uploads          # Uploaded FIO files
  - ./data/auth/.htpasswd:/app/.htpasswd         # Admin users
  - ./data/auth/.htuploaders:/app/.htuploaders   # Upload-only users
  - ./data/auth/.htviewers:/app/.htviewers       # Read-only users
```

## Authentication Management

### User Roles
- **Admin Users** (`.htpasswd`): Full access - view data, upload tests, manage system
- **Upload-Only Users** (`.htuploaders`): Restricted access - upload FIO test results only
- **Viewer Users** (`.htviewers`): Read-only access - view all data and download raw FIO JSON, no uploads or changes

> **Upgrading to a version with viewer users:** create the file before starting the container,
> otherwise Docker creates a directory in its place:
> `touch docker/data/auth/.htviewers` (or `touch data/auth/.htviewers` next to your compose file).

### User Management
```bash
# Manage admin users (full access)
docker exec -it fio-app python scripts/manage_users.py add --admin --username admin --password your_password

# Manage upload-only users (restricted access)
docker exec -it fio-app python scripts/manage_users.py add --username uploader --password your_password

# View current users
docker exec fio-app cat /app/.htpasswd          # Admin users
docker exec fio-app cat /app/.htuploaders       # Upload-only users
docker exec fio-app cat /app/.htviewers         # Read-only users
```

### Security Features
- bcrypt password hashing with salt rounds
- Role-based API endpoint protection  
- Custom authentication forms (no browser popups)
- Comprehensive request logging and user activity tracking

## Interactive Chart Features

The web interface includes advanced interactive chart controls:

### Available Features
- **Sorting**: By name, IOPS, latency, throughput, block size, drive model, protocol, hostname, queue depth
- **Grouping**: By drive model, test type, block size, protocol, hostname, queue depth 
- **Series Controls**: Toggle individual data series visibility
- **Export**: PNG image download and CSV data export
- **Fullscreen**: Dedicated fullscreen chart viewing mode
- **Reset**: Restore default sorting and grouping settings

### Chart Templates
- **Performance Overview**: Bar chart with IOPS, latency, and throughput
- **Block Size Impact**: Line chart showing performance changes across block sizes
- **Read vs Write**: Side-by-side comparison of read/write IOPS performance
- **IOPS vs Latency**: Dual-axis chart showing both IOPS and latency metrics

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

3. **Check application health:**
   ```bash
   # Test web interface
   curl http://localhost/
   
   # Test API (requires authentication)
   curl -u admin:password http://localhost/api/test-runs
   ```

4. **Authentication issues:**
   ```bash
   # Check if user files exist
   ls -la data/auth/
   
   # Reset admin user
docker exec -it fio-app python scripts/manage_users.py add --admin --username admin --password your_password
   ```

5. **Script download issues:**
   ```bash
   # Test static file serving
   curl -I http://localhost/fio-test.sh
   ```

6. **View application logs:**
   ```bash
   # Real-time logs with user activity
   docker compose logs -f
   
   # Nginx access logs
   docker exec fio-app tail -f /var/log/nginx/access.log
   ```

## Container Registry

### Push Images to Registry

1. **Configure registry settings:**
   ```bash
   export DOCKER_REGISTRY=docker.io              # or your private registry
   export DOCKER_NAMESPACE=yourusername          # your Docker Hub username
   export IMAGE_TAG=v1.0.0                      # version tag
   ```

2. **Login to registry:**
   ```bash
   docker login                                  # Docker Hub
   # or
   docker login your-private-registry.com       # Private registry
   ```

3. **Build and push:**
   ```bash
   ./push-to-registry.sh
   ```

### Deploy from Registry

1. **Create production environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Deploy using versioned images:**
   ```bash
   # Automatic version detection from VERSION file
   ./deploy.sh
   
   # Or manually specify version
   IMAGE_TAG=v1.0.0 docker compose -f compose.prod.yml up -d
   ```

### Registry Examples

**Docker Hub:**
```bash
export DOCKER_REGISTRY=docker.io
export DOCKER_NAMESPACE=mycompany
./push-to-registry.sh
```

**AWS ECR:**
```bash
export DOCKER_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com
export DOCKER_NAMESPACE=fio-analyzer
./push-to-registry.sh
```

**GitHub Container Registry:**
```bash
export DOCKER_REGISTRY=ghcr.io
export DOCKER_NAMESPACE=mycompany
./push-to-registry.sh
```

## Production Checklist

- [ ] Update default credentials
- [ ] Configure backup for database
- [ ] Set up monitoring
- [ ] Configure log rotation
- [ ] Review security settings
- [ ] Test file upload limits
- [ ] Push images to registry
- [ ] Test deployment from registry
