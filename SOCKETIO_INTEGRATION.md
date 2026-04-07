# Socket.IO Integration Guide - Real-Time Notifications

## ✅ What's Installed

1. **Backend** (Python)
   - \python-socketio\ - Socket.IO server
   - \python-engineio\ - Engine.IO transport
   - \ioredis\ / \edis\ - For pub/sub (optional)

2. **Frontend** (JavaScript)
   - \socket.io-client\ - Socket.IO client

3. **Services Created**
   - Backend: \ackend/app/services/socketio_service.py\
   - Frontend: \rontend/src/services/websocketService.js\
   - Hook: \rontend/src/hooks/useWebSocket.js\

## 🔌 Backend Integration

### Step 1: Update Routes to Emit Events

In \ackend/app/api/routes/auth.py\, add Socket.IO notifications:

\\\python
from app.services.socketio_service import SocketIOManager
import asyncio

# In the register endpoint - after user creation
async def register(...):
    user = register_user(db, user_data)
    # ... existing code ...
    
    # Emit notification to admins
    asyncio.create_task(SocketIOManager.notify_user_created({
        'id': user.id,
        'nom': user.nom,
        'email': user.email,
        'role_name': user.role.name,
        'is_pending': user.is_pending,
        'date_creation': user.date_creation,
    }))
    
    return {...}

# In the delete user endpoint
async def delete_user(...):
    email = user.email
    # ... delete user code ...
    
    # Emit notification
    asyncio.create_task(SocketIOManager.notify_user_deleted(str(user_id)))
    
    return {...}

# In the activate/deactivate endpoints
async def toggle_active(...):
    user.is_active = not user.is_active
    db.commit()
    
    # Emit notification
    asyncio.create_task(SocketIOManager.notify_user_status_changed(
        str(user.id), 
        user.is_active
    ))
    
    return {...}
\\\

## 🎯 Frontend Integration

### Step 1: Use the Hook in Your Component

Example in \AdminPage.jsx\:

\\\jsx
import { useWebSocket } from '../hooks/useWebSocket'

export default function AdminPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  
  // Initialize WebSocket and listen for notifications
  useWebSocket((notification) => {
    console.log('Notification received:', notification)
    
    const { type, user, user_id, is_active } = notification
    
    if (type === 'user_created') {
      // Add new user to list
      setUsers(prev => [user, ...prev])
    } else if (type === 'user_updated') {
      // Update user in list
      setUsers(prev => prev.map(u => u.id === user_id ? {...u, ...user} : u))
    } else if (type === 'user_deleted') {
      // Remove user from list
      setUsers(prev => prev.filter(u => u.id !== user_id))
    } else if (type === 'user_status_changed') {
      // Update user status
      setUsers(prev => prev.map(u => 
        u.id === user_id ? {...u, is_active} : u
      ))
    }
  })
  
  // ... rest of component ...
}
\\\

### Step 2: Display Toast Notifications

You can add toast notifications in the hook callback:

\\\jsx
useWebSocket((notification) => {
  const { type, user } = notification
  
  if (type === 'user_created') {
    showToast(\✨ New user: \\, 'success')
  } else if (type === 'user_deleted') {
    showToast(\🗑️ User deleted\, 'info')
  } else if (type === 'user_status_changed') {
    showToast(\🔄 User status updated\, 'info')
  }
})
\\\

## 🚀 Running the Application

### Backend
\\\ash
cd backend
# Install dependencies
pip install -r requirements.txt

# Run server
docker compose down
docker compose up -d --build
\\\

### Frontend
\\\ash
cd frontend
npm install  # if needed
npm run dev
\\\

## 📡 Socket.IO Events Reference

### Emitted by Backend → Frontend

| Event | Data | Purpose |
|-------|------|---------|
| notification | {type, user, user_id, changes} | Real-time update |
| connected | {status, message} | Confirmation of identification |

### Emitted by Frontend → Backend

| Event | Data | Purpose |
|-------|------|---------|
| identify | {user_id, email, role} | Identify user after connection |

## 🔧 SocketIOManager Methods

Available in backend for emitting notifications:

\\\python
# Notify when user is created
await SocketIOManager.notify_user_created(user_data)

# Notify when user is updated
await SocketIOManager.notify_user_updated(user_id, changes_dict)

# Notify when user is deleted
await SocketIOManager.notify_user_deleted(user_id)

# Notify when user status changes
await SocketIOManager.notify_user_status_changed(user_id, is_active)
\\\

## ✨ Example: Complete User Creation Flow

**Backend (auth.py):**
\\\python
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    user = register_user(db, user_data)
    
    # Emit WebSocket notification to admins
    asyncio.create_task(SocketIOManager.notify_user_created({
        'id': user.id,
        'nom': user.nom,
        'email': user.email,
        'role_name': 'Viewer',
        'is_pending': True,
        'date_creation': user.date_creation,
    }))
    
    return {\"status\": \"email_verification_required\", ...}
\\\

**Frontend (AdminPage.jsx):**
\\\jsx
useWebSocket((notification) => {
  if (notification.type === 'user_created') {
    setUsers(prev => [notification.user, ...prev])
    showToast(\✨ New user: \\, 'success')
  }
})
\\\

## 🐛 Troubleshooting

**Q: WebSocket not connecting?**
- Check that backend is running: \docker ps\
- Check browser console for errors
- Verify CORS settings in \socketio_service.py\

**Q: Notifications not appearing?**
- Verify admin is connected: check backend logs
- Ensure \syncio.create_task()\" is used for async operations
- Check browser Network tab for Socket.IO connections

**Q: How to test locally?**
\\\ash
# Terminal 1: Backend
cd backend && docker compose up

# Terminal 2: Frontend
cd frontend && npm run dev

# Open http://localhost:3000 in two browser tabs
# Register/create users in one tab
# Watch notifications in admin panel on other tab
\\\

## 📚 Next Steps

1. ✅ Update all CRUD endpoints to emit notifications
2. ✅ Add Toast notification component
3. ✅ Test with multiple admins
4. ✅ Add notification sound/badge
5. ✅ Store notification history in DB

---

**Files Modified/Created:**
- ✅ \ackend/requirements.txt\ - Added Socket.IO packages
- ✅ \ackend/app/main.py\ - Integrated Socket.IO with FastAPI
- ✅ \ackend/app/services/socketio_service.py\ - NEW: Socket.IO server
- ✅ \rontend/src/services/websocketService.js\ - NEW: Socket.IO client
- ✅ \rontend/src/hooks/useWebSocket.js\ - NEW: React hook

**Still Need To Do:**
- Update \ackend/app/api/routes/auth.py\ - Add socketio notifications
- Update \rontend/src/pages/AdminPage.jsx\ - Use useWebSocket hook
