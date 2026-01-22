# 🚀 ARENAHUB Setup Guide

## Prerequisites

Before starting, make sure you have installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **Redis** 6+ ([Download](https://redis.io/download))

## 📦 Installation Steps

### 1. Clone and Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

### 2. Database Setup

#### PostgreSQL

```sql
-- Create database
CREATE DATABASE arenahub;

-- The tables will be created automatically by TypeORM
```

#### Redis

Make sure Redis is running:

```bash
# Windows (if installed)
redis-server

# Linux/Mac
redis-server
```

### 3. Environment Configuration

#### Backend

Copy `backend/env.example` to `backend/.env` and configure:

```bash
cd backend
cp env.example .env
```

Edit `.env` with your settings:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=arenahub

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

GAME_TICK_RATE=60
GAME_ROOM_SIZE=4
```

#### Frontend

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

### 4. Run the Application

#### Start Backend

```bash
cd backend
npm run start:dev
```

Backend will run on `http://localhost:3000`

#### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:3001`

## 🎮 How to Play

1. **Register/Login**: Create an account or login
2. **Join Lobby**: View leaderboard and your stats
3. **Play**: Click "Play Now" to join matchmaking
4. **Game Controls**:
   - **Arrow Keys** or **WASD**: Move your character
   - **SPACE**: Attack nearest enemy (within range)

## 🏗️ Architecture

### Backend Structure

```
backend/
├── src/
│   ├── auth/          # Authentication (JWT, login, register)
│   ├── users/         # User management and stats
│   ├── game/          # Game logic, WebSocket, matchmaking
│   └── main.ts        # Application entry point
```

### Frontend Structure

```
frontend/
├── src/
│   ├── components/    # React components (Login, Lobby, Game)
│   ├── contexts/      # Auth context
│   └── App.tsx        # Main app component
```

## 🔧 Game Mechanics

### Server-Side Authority

- All game logic runs on the server
- Client sends input, server validates and processes
- Server broadcasts game state to all players
- Prevents cheating

### Game Loop

- **Tick Rate**: 60 TPS (Ticks Per Second)
- **Room Size**: 2-4 players
- **Win Condition**: Last player standing (health > 0)

### Matchmaking

- Players join queue
- When 4 players are ready, room is created
- 2-second countdown before game starts
- Game runs until one player remains

## 🐛 Troubleshooting

### Backend won't start

- Check PostgreSQL is running
- Check Redis is running
- Verify `.env` file exists and has correct values
- Check port 3000 is not in use

### Frontend won't connect

- Verify backend is running on port 3000
- Check `VITE_API_URL` in frontend `.env`
- Check browser console for errors

### Database errors

- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify database `arenahub` exists

### Redis errors

- Ensure Redis is running
- Check Redis connection in `.env`

## 📝 Development Notes

### Adding New Features

1. **Backend**: Add modules in `src/` following Nest.js patterns
2. **Frontend**: Add components in `src/components/`
3. **Game Logic**: Modify `game-room.service.ts` for game mechanics
4. **WebSocket Events**: Add handlers in `game.gateway.ts`

### Testing

```bash
# Backend tests
cd backend
npm test

# Frontend (manual testing)
# Open browser and test game flow
```

## 🚀 Production Deployment

1. Set `NODE_ENV=production` in backend `.env`
2. Build frontend: `cd frontend && npm run build`
3. Use a process manager (PM2) for backend
4. Configure reverse proxy (Nginx) for frontend
5. Use environment variables for secrets
6. Enable HTTPS
7. Configure CORS properly

## 📚 Tech Stack Details

- **Nest.js**: Backend framework
- **Socket.IO**: Real-time WebSocket communication
- **Phaser.js**: 2D game engine
- **React**: Frontend framework
- **TypeORM**: Database ORM
- **PostgreSQL**: Database
- **Redis**: Caching and state management

## 🎯 Next Steps

- Add more game modes
- Implement reconnection handling
- Add spectator mode
- Improve graphics and animations
- Add sound effects
- Implement power-ups
- Add different character classes
