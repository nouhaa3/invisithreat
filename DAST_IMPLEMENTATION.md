# DAST (Dynamic Application Security Testing) Implementation Guide

## Overview

InvisiThreat now includes full DAST capabilities using OWASP ZAP. The feature enables dynamic security testing of running web applications with automated vulnerability discovery.

## Architecture

### Layer 1: Daemon Management
**File**: ackend/app/services/owasp_zap.py
- Manages ZAP daemon lifecycle
- Auto-detects ZAP installation (Windows/Linux/macOS)
- Provides health checks and graceful shutdown
- Cross-platform process management

**Key Functions**:
- ensure_zap_running() - Idempotent ZAP startup
- is_zap_running() - Health check via API
- start_zap() - Launch daemon
- stop_zap() - Graceful shutdown with fallback

### Layer 2: API Client
**File**: ackend/app/services/zap_client.py
- REST API client for ZAP
- Organized into component APIs: core, spider, ascan
- Error handling and retry logic

**APIs Available**:
- client.core - Session management
- client.spider - Passive crawling
- client.ascan - Active vulnerability scanning

### Layer 3: Orchestration
**File**: ackend/app/services/dast_scanner.py
- Full scan workflow orchestration
- Async/background execution support
- Progress tracking and real-time updates
- Vulnerability normalization

**Key Functions**:
- un_dast_scan_async(target_url) - Full workflow (spider → active scan → alerts)
- get_scan_progress() - Real-time progress
- ormat_dast_result() - JSON response formatting
- start_spider(), start_active_scan(), get_alerts() - Individual steps

### Layer 4: Database
**File**: ackend/app/models/dast_scan.py
- Stores scan results and history
- Tracks progress per scan
- Audit trail with creator info

**Schema**:
`
dast_scans
├── id (UUID, PK)
├── target_url
├── session_id, zap_spider_scan_id, zap_active_scan_id
├── status (pending | running | completed | failed)
├── spider_progress, active_scan_progress (0-100)
├── alerts_found, vulnerabilities_found
├── vulnerabilities (JSON)
├── severity_distribution (JSON)
├── error_message
└── timestamps (started_at, completed_at, created_at, updated_at)
`

### Layer 5: API Endpoints
**File**: ackend/app/api/routes/dast.py
- RESTful API for DAST operations
- User authentication required
- Permission checks

**Endpoints**:
`
POST   /api/dast/scan/start
       - Trigger new DAST scan
       - Params: target_url
       - Returns: scan_id

GET    /api/dast/scan/{scan_id}/status
       - Get scan status and progress
       
GET    /api/dast/scan/{scan_id}/results
       - Get completed scan results
       
GET    /api/dast/scan/list
       - List all scans (paginated)
       
POST   /api/dast/scan/{scan_id}/stop
       - Stop running scan
       
GET    /api/dast/current-progress
       - Get current scan progress
`

## Workflow

### Full Scan Process

1. **Initialization** (10-20s)
   - Check ZAP is running
   - Create new ZAP session

2. **Spider Scan** (1-5 min typical)
   - Crawl target application
   - Discover all URLs
   - Progress: 0% → 100%

3. **Active Scan** (2-10 min typical)
   - Test discovered endpoints
   - Check for vulnerabilities
   - Progress: 0% → 100%

4. **Alert Collection**
   - Fetch all discovered issues
   - Each alert includes: name, risk, URL, description

5. **Normalization**
   - Transform ZAP alerts → internal format
   - Map risk levels: High/Medium/Low → CRITICAL/HIGH/MEDIUM/LOW
   - Add recommendations

6. **Storage**
   - Save to database
   - Make available via API

### Example API Usage

#### 1. Start a Scan
\\\ash
curl -X POST "http://localhost:8000/api/dast/scan/start?target_url=http://example.com" \
  -H "Authorization: Bearer YOUR_TOKEN"
\\\

Response:
\\\json
{
  "status": "initiated",
  "scan_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_url": "http://example.com",
  "message": "DAST scan started in background"
}
\\\

#### 2. Check Progress
\\\ash
curl "http://localhost:8000/api/dast/scan/550e8400-e29b-41d4-a716-446655440000/status" \
  -H "Authorization: Bearer YOUR_TOKEN"
\\\

Response:
\\\json
{
  "scan_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_url": "http://example.com",
  "status": "running",
  "spider_progress": 75,
  "active_scan_progress": 0,
  "alerts_found": 5,
  "vulnerabilities_found": 5,
  "started_at": "2026-04-13T11:00:00",
  "completed_at": null,
  "error": null
}
\\\

#### 3. Get Results
\\\ash
curl "http://localhost:8000/api/dast/scan/550e8400-e29b-41d4-a716-446655440000/results" \
  -H "Authorization: Bearer YOUR_TOKEN"
\\\

Response:
\\\json
{
  "scan_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_url": "http://example.com",
  "status": "completed",
  "summary": {
    "total_vulnerabilities": 12,
    "by_severity": {
      "Critical": 1,
      "High": 3,
      "Medium": 5,
      "Low": 3,
      "Info": 0
    }
  },
  "vulnerabilities": [
    {
      "type": "Cross-Site Scripting (XSS)",
      "severity": "High",
      "endpoint": "http://example.com/search?q=",
      "description": "Unsanitized user input in search parameter...",
      "recommendation": "Implement HTML entity encoding for all user inputs",
      "tool": "OWASP ZAP",
      "timestamp": "2026-04-13T11:05:00"
    }
  ],
  "completed_at": "2026-04-13T11:05:00"
}
\\\

## Docker Setup

The Dockerfile has been updated to include:
- Java Runtime (required for ZAP)
- OWASP ZAP v2.14.0
- ZAP is installed to /opt/zaproxy
- ZAP executable is in PATH as /usr/local/bin/zap

### Build & Run

\\\ash
# Build
docker build -t invisithreat:dast -f backend/Dockerfile backend/

# Run (with ZAP daemon support)
docker run -d \
  -p 8000:8000 \
  -p 8090:8090 \  # ZAP API port
  --name invisithreat-dast \
  invisithreat:dast
\\\

## Severity Mapping

ZAP Risk Levels → Internal Severity:
- High → HIGH
- Medium → MEDIUM
- Low → LOW
- Informational → INFO

(No CRITICAL mapping at ZAP level, reserved for internal threats)

## Performance Tuning

### Timeout Values (in dast_scanner.py)
- Spider scan default: 300 seconds (5 min)
- Active scan default: 600 seconds (10 min)

Customize via:
\\\python
result = await run_dast_scan_async(
    target_url="http://example.com",
    spider_timeout=600,      # 10 minutes
    ascan_timeout=1200,      # 20 minutes
)
\\\

### Check Intervals
- Spider progress check: 2 seconds
- Active scan progress check: 3 seconds

## Logging

All operations are logged to stdout:
\\\
INFO     Starting background DAST scan for http://example.com
INFO     Step 1: Ensuring ZAP is running...
INFO     Step 2: Creating new ZAP session...
INFO     Step 3: Running spider scan...
INFO     Spider scan progress: 50%
...
INFO     DAST Scan Completed (took 245.3s)
`

## Error Handling

- **ZAP not installed**: Clear error message directing to install
- **ZAP startup failure**: Automatic retry with timeout
- **Scan timeout**: Gracefully fail and save error to database
- **Permission errors**: 403 Forbidden for unauthorized users
- **Invalid URL**: 400 Bad Request with validation message

## Database Notes

- Scans are persisted in PostgreSQL
- Results are stored as JSON for flexibility
- Queries are indexed by: target_url, status, created_by_id, created_at
- Cleanup job can be added to remove old scans (if needed)

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only see/modify their own scans
3. **URL Validation**: Only http/https URLs are allowed
4. **API Key**: ZAP API key disabled in daemon mode for development
5. **Timeout Protection**: All scans have max execution time

## Troubleshooting

### ZAP Not Starting
\\\
Error: OWASP ZAP executable not found
\\\
Solution: Install OWASP ZAP or verify PATH includes ZAP executable

### Port 8090 Already in Use
\\\
Error: Cannot connect to ZAP at localhost:8090
\\\
Solution: Change ZAP_PORT in environment or stop other ZAP instances

### Scan Hangs
\\\
Status stays at 99% for extended time
\\\
Solution: Check target application is responding, increase timeout values

### Database Errors
\\\
Error: scan table not found
\\\
Solution: Run migrations: \lembic upgrade head\

## Future Enhancements

1. Support for authentication credentials during scans
2. Custom attack profiles for different scan types
3. Scheduled recurring DAST scans
4. Integration with CI/CD pipelines
5. Detailed report generation (PDF, HTML)
6. Comparison between scan runs
7. False positive management
8. Custom exclusion patterns per scan
