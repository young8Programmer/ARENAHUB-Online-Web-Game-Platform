import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

export interface Player {
  id: string;
  username: string;
  socketId: string;
  position: { x: number; y: number };
  health: number;
  score: number;
  lastUpdate: number;
}

export interface GameRoom {
  id: string;
  players: Map<string, Player>;
  state: 'waiting' | 'playing' | 'finished';
  startedAt: number;
  tick: number;
}

interface QueuedPlayer {
  userId: string;
  username: string;
}

@Injectable()
export class GameRoomService {
  private rooms = new Map<string, GameRoom>();
  private matchmakingQueue: Map<string, QueuedPlayer> = new Map();
  private readonly TICK_RATE = parseInt(process.env.GAME_TICK_RATE) || 60;
  private readonly ROOM_SIZE = parseInt(process.env.GAME_ROOM_SIZE) || 4;
  private readonly GAME_WIDTH = 800;
  private readonly GAME_HEIGHT = 600;

  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}

  // Matchmaking
  async joinMatchmaking(userId: string, username: string): Promise<string | null> {
    this.matchmakingQueue.set(userId, { userId, username });

    // Check if we can form a room
    if (this.matchmakingQueue.size >= this.ROOM_SIZE) {
      const queuedPlayers = Array.from(this.matchmakingQueue.values()).slice(0, this.ROOM_SIZE);
      const playerIds = queuedPlayers.map(p => p.userId);
      const usernames = queuedPlayers.map(p => p.username);
      
      // Remove from queue
      queuedPlayers.forEach(p => this.matchmakingQueue.delete(p.userId));
      
      return this.createRoom(playerIds, usernames);
    }

    return null;
  }

  leaveMatchmaking(userId: string) {
    this.matchmakingQueue.delete(userId);
  }

  getMatchmakingQueueSize(): number {
    return this.matchmakingQueue.size;
  }

  // Room Management
  createRoom(playerIds: string[], usernames: string[]): string {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const room: GameRoom = {
      id: roomId,
      players: new Map(),
      state: 'waiting',
      startedAt: 0,
      tick: 0,
    };

    // Initialize players
    playerIds.forEach((id, index) => {
      room.players.set(id, {
        id,
        username: usernames[index] || `Player${index + 1}`,
        socketId: '',
        position: {
          x: 100 + (index % 2) * 300,
          y: 100 + Math.floor(index / 2) * 300,
        },
        health: 100,
        score: 0,
        lastUpdate: Date.now(),
      });
    });

    this.rooms.set(roomId, room);
    return roomId;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  startRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.state = 'playing';
      room.startedAt = Date.now();
      room.tick = 0;
    }
  }

  // Player Actions
  updatePlayerPosition(
    roomId: string,
    userId: string,
    position: { x: number; y: number },
  ) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'playing') return false;

    const player = room.players.get(userId);
    if (!player) return false;

    // Server-side validation: clamp position to game bounds
    player.position.x = Math.max(0, Math.min(this.GAME_WIDTH - 32, position.x));
    player.position.y = Math.max(0, Math.min(this.GAME_HEIGHT - 32, position.y));
    player.lastUpdate = Date.now();

    return true;
  }

  attackPlayer(roomId: string, attackerId: string, targetId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'playing') return false;

    const attacker = room.players.get(attackerId);
    const target = room.players.get(targetId);

    if (!attacker || !target || target.health <= 0) return false;

    // Calculate distance for attack range
    const dx = attacker.position.x - target.position.x;
    const dy = attacker.position.y - target.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 50) return false; // Attack range

    // Deal damage
    const damage = 10;
    target.health = Math.max(0, target.health - damage);
    attacker.score += 5;

    if (target.health <= 0) {
      attacker.score += 20; // Bonus for elimination
    }

    return true;
  }

  // Game Loop
  processGameTick(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'playing') return null;

    room.tick++;

    // Check for winner
    const alivePlayers = Array.from(room.players.values()).filter(
      (p) => p.health > 0,
    );

    if (alivePlayers.length <= 1) {
      room.state = 'finished';
      return {
        finished: true,
        winner: alivePlayers[0]?.id || null,
        scores: Object.fromEntries(
          Array.from(room.players.entries()).map(([id, p]) => [id, p.score]),
        ),
      };
    }

    // Return game state
    return {
      tick: room.tick,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        username: p.username,
        position: p.position,
        health: p.health,
        score: p.score,
      })),
    };
  }

  // Cleanup
  removeRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  getRoomState(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      state: room.state,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        username: p.username,
        position: p.position,
        health: p.health,
        score: p.score,
      })),
    };
  }
}
