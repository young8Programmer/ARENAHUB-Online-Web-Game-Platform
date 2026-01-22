# 🎮 ARENAHUB — Online Web Game Platform

Professional real-time multiplayer arena game platform built with modern web technologies.

## 🚀 Features

- **Real-time Multiplayer**: 2-4 players in arena battles
- **Server-Side Game Logic**: All game calculations happen on server (anti-cheat)
- **Matchmaking System**: Automatic player matching
- **User Accounts**: Registration, authentication, stats tracking
- **Leaderboards**: Win/loss records and ratings

## 🏗️ Tech Stack

### Backend
- **Nest.js** - Node.js framework
- **Socket.IO** - WebSocket for real-time communication
- **Redis** - Room management and state caching
- **PostgreSQL** - User data and match history
- **JWT** - Authentication

### Frontend
- **React** - UI framework
- **Phaser.js** - Professional 2D game engine
- **TypeScript** - Type safety

## 📁 Project Structure

```
arenahub/
├── backend/          # Nest.js backend
├── frontend/         # React + Phaser.js frontend
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Quick Start

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables:**
   - Backend: Copy `backend/env.example` to `backend/.env` and configure
   - Frontend: Copy `frontend/env.example` to `frontend/.env`

3. **Start PostgreSQL and Redis**

4. **Run the application:**
   ```bash
   # Terminal 1 - Backend
   npm run dev:backend
   
   # Terminal 2 - Frontend
   npm run dev:frontend
   ```

5. **Open browser:** `http://localhost:3001`

📖 **For detailed setup instructions, see [SETUP.md](./SETUP.md)**

## 🎮 Game Mechanics

- **Player Movement**: Real-time position updates
- **Combat System**: Attack, defend, health management
- **Scoring**: Points for actions and eliminations
- **Collision Detection**: Server-side physics
- **Game Loop**: 60 TPS tick system

## 🔒 Security

- Server-authoritative game state
- Input validation
- Rate limiting
- JWT authentication
- Anti-cheat measures

## 📝 License

MIT
