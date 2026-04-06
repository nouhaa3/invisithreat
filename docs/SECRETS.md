# Secrets Management Guide ??

## Development Environment

### 1. .env File
- Copy `backend/.env.example` to `backend/.env`
- Use weak credentials for development only
- File is gitignored - safe to commit project

```bash
cp backend/.env.example backend/.env
```

## Production Environment

### 1. GitHub Secrets
Set in **Settings > Secrets and variables > Actions**:

- PROD_DATABASE_URL
- PROD_SECRET_KEY
- PROD_POSTGRES_PASSWORD
- PROD_GITHUB_CLIENT_SECRET
- PROD_GITHUB_WEBHOOK_SECRET
- PROD_BREVO_API_KEY
- PROD_SMTP_PASSWORD

### 2. Update docker-compose.yml
Use secret references in production deployments.

## Best Practices ?

- Generate secrets with 32+ random characters
- Rotate secrets quarterly minimum
- Never commit .env to git
- Never hardcode secrets in source code
- Use HTTPS/TLS for all connections
- Separate secrets by environment

## Rotating Secrets

1. Generate new: `python -c "from secrets import token_urlsafe; print(token_urlsafe(32))"`
2. Update GitHub Secrets
3. Restart services: `docker-compose restart`

## Security Checklist

- [ ] .env is in .gitignore
- [ ] PROD_SECRET_KEY is 32+ characters
- [ ] Database passwords are strong (16+ chars)
- [ ] GitHub Client Secret is configured
- [ ] HTTPS enabled for production
- [ ] Secrets rotated < 90 days ago
