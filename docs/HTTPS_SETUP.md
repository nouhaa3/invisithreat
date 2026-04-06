# HTTPS Setup Guide ??

## Local Development (Self-Signed Certificates)

### Option 1: Using Python mkcert

```bash
# Install mkcert
pip install mkcert

# Generate local CA
mkcert -install

# Generate certificates for localhost
mkcert -cert-file backend/certs/server.crt -key-file backend/certs/server.key localhost 127.0.0.1
```

### Option 2: Using OpenSSL

```bash
cd backend/certs

# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate (365 days)
openssl req -new -x509 -key server.key -out server.crt -days 365 \
  -subj "/CN=localhost"
```

### Option 3: Using Python cryptography

```python
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
import datetime

# Generate key
key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)

# Generate certificate
subject = x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
])

cert = x509.CertificateBuilder().subject_name(
    subject
).issuer_name(
    subject
).public_key(
    key.public_key()
).serial_number(
    x509.random_serial_number()
).not_valid_before(
    datetime.datetime.utcnow()
).not_valid_after(
    datetime.datetime.utcnow() + datetime.timedelta(days=365)
).sign(key, hashes.SHA256(), default_backend())

# Save files
with open("backend/certs/server.key", "wb") as f:
    f.write(key.private_bytes(...))
    
with open("backend/certs/server.crt", "wb") as f:
    f.write(cert.public_bytes(...))
```

## Docker Compose Configuration

### Update docker-compose.yml for HTTPS

```yaml
services:
  backend:
    # ... existing config ...
    volumes:
      - ./backend/certs:/app/certs:ro
    environment:
      - SSL_CERTFILE=/app/certs/server.crt
      - SSL_KEYFILE=/app/certs/server.key
    command: uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile=/app/certs/server.key --ssl-certfile=/app/certs/server.crt
    ports:
      - "8443:8443"
```

## FastAPI Configuration with HTTPS

### Update app/main.py

```python
import ssl
from fastapi import FastAPI
import uvicorn

app = FastAPI()

if __name__ == "__main__":
    # Load SSL context
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(
        certfile="/app/certs/server.crt",
        keyfile="/app/certs/server.key"
    )
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8443,
        ssl_context=ssl_context
    )
```

## Production HTTPS with Let's Encrypt

### Using Certbot

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates location:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### Docker Compose for Production

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./html:/var/www/html:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    restart: unless-stopped

  backend:
    # ... existing config ...
    ports:
      - "8000" # Only internal
    environment:
      - FRONTEND_URL=https://yourdomain.com
      - BACKEND_URL=https://yourdomain.com/api
```

## HTTPS Verification

```bash
# Check certificate
openssl x509 -in backend/certs/server.crt -text -noout

# Test HTTPS connection
curl --cacert backend/certs/server.crt https://localhost:8443/api/health

# Check expiration
openssl x509 -enddate -noout -in backend/certs/server.crt
```

## Security Best Practices

- ? Use Let's Encrypt for free SSL certificates
- ? Enable HSTS (HTTP Strict-Transport-Security)
- ? Use TLS 1.2 or higher
- ? Implement certificate auto-renewal
- ? Use strong cipher suites
- ? Redirect all HTTP to HTTPS

- ? Don't use self-signed certs in production
- ? Don't disable certificate validation
- ? Don't use weak cipher suites
- ? Don't leave expired certificates
