# Test User Credentials

## Default Users

These users are created automatically for testing purposes.

### Admin User
- **Email:** alice@invisithreat.dev
- **Password:** Admin@2024
- **Role:** Admin
- **Permissions:** Full system access

### Developer User
- **Email:** bob@invisithreat.dev  
- **Password:** Dev@2024
- **Role:** Developer
- **Permissions:** Analysis access

### Viewer User
- **Email:** charlie@invisithreat.dev
- **Password:** Viewer@2024
- **Role:** Viewer
- **Permissions:** Read-only access

## Security Implementation

All passwords are hashed using bcrypt with cost factor 12.

**Hashing Function:**
```python
from app.core.security import hash_password, verify_password

# Hash a password
hashed = hash_password("my_password")

# Verify a password
is_valid = verify_password("my_password", hashed)
```

## Important Notes

- Never store passwords in plain text
- All user creation must use hash_password()
- Passwords are verified with verify_password()
- Test passwords should be changed in production
