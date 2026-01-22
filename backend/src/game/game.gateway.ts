import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GameRoomService } from './game-room.service';
import { GameService } from './game.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  roomId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private gameLoopIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private gameRoomService: GameRoomService,
    private gameService: GameService,
    private jwtService: JwtService,
  ) {
    // Start game loop
    setInterval(() => this.processAllRooms(), 1000 / 60); // 60 TPS
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || 
                    client.handshake.headers.authorization?.replace('Bearer ', '') ||
                    client.handshake.query?.token as string;
      if (!token) {
        console.log('No token provided, disconnecting');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.userId;
      client.username = payload.username;
      console.log(`User connected: ${client.username} (${client.userId})`);
    } catch (error) {
      console.log('Authentication failed:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.roomId) {
      this.leaveRoom(client);
    }
    this.gameRoomService.leaveMatchmaking(client.userId);
  }

  @SubscribeMessage('join_matchmaking')
  async handleJoinMatchmaking(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId || !client.username) {
      return { error: 'Not authenticated' };
    }

    const roomId = await this.gameRoomService.joinMatchmaking(
      client.userId,
      client.username,
    );

    if (roomId) {
      client.roomId = roomId;
      client.join(roomId);

      // Get all players in the room to send their socket IDs
      const room = this.gameRoomService.getRoom(roomId);
      if (room) {
        // Update socket IDs for all players in room
        const sockets = await this.server.in(roomId).fetchSockets();
        sockets.forEach((socket) => {
          const authSocket = socket as AuthenticatedSocket;
          const player = room.players.get(authSocket.userId);
          if (player) {
            player.socketId = authSocket.id;
          }
        });
      }

      // Start game after short delay
      setTimeout(() => {
        this.gameRoomService.startRoom(roomId);
        const roomState = this.gameRoomService.getRoomState(roomId);
        if (roomState) {
          this.server.to(roomId).emit('game_started', {
            roomId,
            players: roomState.players,
          });
          this.startGameLoop(roomId);
        }
      }, 2000);
    }

    return { status: roomId ? 'matched' : 'queued', roomId };
  }

  @SubscribeMessage('leave_matchmaking')
  handleLeaveMatchmaking(@ConnectedSocket() client: AuthenticatedSocket) {
    this.gameRoomService.leaveMatchmaking(client.userId);
    return { status: 'left' };
  }

  @SubscribeMessage('player_move')
  handlePlayerMove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { x: number; y: number },
  ) {
    if (!client.roomId || !client.userId) return;

    const success = this.gameRoomService.updatePlayerPosition(
      client.roomId,
      client.userId,
      { x: data.x, y: data.y },
    );

    if (success) {
      // Broadcast to other players in room
      client.to(client.roomId).emit('player_moved', {
        playerId: client.userId,
        position: { x: data.x, y: data.y },
      });
    }
  }

  @SubscribeMessage('player_attack')
  handlePlayerAttack(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { targetId: string },
  ) {
    if (!client.roomId || !client.userId) return;

    const success = this.gameRoomService.attackPlayer(
      client.roomId,
      client.userId,
      data.targetId,
    );

    if (success) {
      // Broadcast attack to all players
      this.server.to(client.roomId).emit('player_attacked', {
        attackerId: client.userId,
        targetId: data.targetId,
      });
    }
  }

  private startGameLoop(roomId: string) {
    if (this.gameLoopIntervals.has(roomId)) return;

    const interval = setInterval(() => {
      const state = this.gameRoomService.processGameTick(roomId);
      if (state) {
        this.server.to(roomId).emit('game_state', state);

        if (state.finished) {
          this.endGame(roomId, state.winner, state.scores);
          clearInterval(interval);
          this.gameLoopIntervals.delete(roomId);
        }
      }
    }, 1000 / 60); // 60 TPS

    this.gameLoopIntervals.set(roomId, interval);
  }

  private async endGame(
    roomId: string,
    winnerId: string,
    scores: Record<string, number>,
  ) {
    const room = this.gameRoomService.getRoom(roomId);
    if (!room) return;

    const duration = Math.floor((Date.now() - room.startedAt) / 1000);
    const playerIds = Array.from(room.players.keys());

    // Save match to database
    await this.gameService.endMatch(roomId, winnerId, scores, duration);

    // Notify players
    this.server.to(roomId).emit('game_ended', {
      winnerId,
      scores,
      duration,
    });

    // Cleanup after delay
    setTimeout(() => {
      this.gameRoomService.removeRoom(roomId);
      const sockets = await this.server.in(roomId).fetchSockets();
      sockets.forEach((socket) => {
        (socket as AuthenticatedSocket).roomId = undefined;
      });
    }, 10000);
  }

  private processAllRooms() {
    // This runs at 60 TPS for all active rooms
    // Individual room loops handle their own state updates
  }

  private leaveRoom(client: AuthenticatedSocket) {
    if (client.roomId) {
      client.leave(client.roomId);
      client.roomId = undefined;
    }
  }
}
