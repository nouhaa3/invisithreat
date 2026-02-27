# Authentication API Documentation

## Overview

InvisiThreat uses JWT (JSON Web Tokens) for authentication with OAuth2 password flow.

## Endpoints

### POST /api/auth/register
Create new user account

### POST /api/auth/login
Login with email and password (OAuth2 form)

### POST /api/auth/refresh
Refresh access token using refresh token

### POST /api/auth/logout
Logout (client-side token deletion)

### GET /api/auth/me
Get current authenticated user info (protected route)

## JWT Token Structure

Access Token:
- sub: user_id
- role: Admin | Developer | Viewer
- exp: expiration timestamp
- type: access

Refresh Token:
- sub: user_id
- exp: expiration timestamp
- type: refresh

## Token Lifetime

- Access Token: 30 minutes
- Refresh Token: 7 days

## Test User

Email: testuser@invisithreat.dev
Password: SecurePass@2024
Role: Developer

## Swagger UI

http://localhost:8000/api/docs

1. Register or login to get token
2. Click Authorize button
3. Enter: Bearer YOUR_TOKEN
4. Access protected routes
