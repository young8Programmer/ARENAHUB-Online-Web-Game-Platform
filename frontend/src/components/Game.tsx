import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import './Game.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface GameState {
  players: Array<{
    id: string;
    username: string;
    position: { x: number; y: number };
    health: number;
    score: number;
  }>;
  tick?: number;
  finished?: boolean;
  winner?: string;
  scores?: Record<string, number>;
}

export default function Game() {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    if (!gameRef.current || !user || !token) return;

    // Initialize Socket.IO
    const socketUrl = API_URL.includes('http') 
      ? API_URL.replace('/api', '')
      : 'http://localhost:3000';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Phaser Game Scene
    class GameScene extends Phaser.Scene {
      private players: Map<string, Phaser.GameObjects.Sprite> = new Map();
      private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      private lastUpdate = 0;
      private myPlayerId: string;

      constructor() {
        super({ key: 'GameScene' });
        this.myPlayerId = user!.id;
      }

      create() {
        // Create game background
        this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
        this.add.rectangle(400, 300, 800, 600, 0x16213e, 0.5);

        // Create cursors for movement
        this.cursors = this.input.keyboard!.createCursorKeys();

        // Add WASD keys
        const wasd = this.input.keyboard!.addKeys('W,S,A,D');

        // Movement handler
        const movePlayer = () => {
          if (!socket.connected) return;

          const speed = 200;
          let dx = 0;
          let dy = 0;

          if (this.cursors.left.isDown || wasd.A.isDown) dx = -1;
          if (this.cursors.right.isDown || wasd.D.isDown) dx = 1;
          if (this.cursors.up.isDown || wasd.W.isDown) dy = -1;
          if (this.cursors.down.isDown || wasd.S.isDown) dy = 1;

          if (dx !== 0 || dy !== 0) {
            const player = this.players.get(this.myPlayerId);
            if (player) {
              const newX = Phaser.Math.Clamp(
                player.x + dx * speed * 0.016,
                16,
                784,
              );
              const newY = Phaser.Math.Clamp(
                player.y + dy * speed * 0.016,
                16,
                584,
              );

              socket.emit('player_move', { x: newX, y: newY });
            }
          }
        };

        // Update loop
        this.input.keyboard!.on('keydown-SPACE', () => {
          // Attack nearest player
          const myPlayer = this.players.get(this.myPlayerId);
          if (!myPlayer) return;

          let nearestPlayer: { id: string; distance: number } | null = null;
          this.players.forEach((sprite, id) => {
            if (id === this.myPlayerId) return;
            const dx = sprite.x - myPlayer.x;
            const dy = sprite.y - myPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (!nearestPlayer || distance < nearestPlayer.distance) {
              nearestPlayer = { id, distance };
            }
          });

          if (nearestPlayer && nearestPlayer.distance < 50) {
            socket.emit('player_attack', { targetId: nearestPlayer.id });
          }
        });

        // Movement update - use Phaser's update loop
        this.time.addEvent({
          delay: 16, // ~60 FPS
          callback: movePlayer,
          loop: true,
        });
      }

      updatePlayers(players: GameState['players']) {
        players.forEach((playerData) => {
          let sprite = this.players.get(playerData.id);

          if (!sprite) {
            // Create new player sprite
            sprite = this.add.circle(
              playerData.position.x,
              playerData.position.y,
              16,
              playerData.id === this.myPlayerId ? 0x4ecdc4 : 0xff6b6b,
            );
            this.players.set(playerData.id, sprite);

            // Add username label
            const label = this.add.text(
              playerData.position.x,
              playerData.position.y - 25,
              playerData.username,
              {
                fontSize: '12px',
                color: '#fff',
                backgroundColor: '#000',
                padding: { x: 4, y: 2 },
              },
            );
            label.setOrigin(0.5);
            sprite.setData('label', label);
          }

          // Update position (interpolate for smooth movement)
          this.tweens.add({
            targets: sprite,
            x: playerData.position.x,
            y: playerData.position.y,
            duration: 50,
            ease: 'Power2',
          });

          // Update label
          const label = sprite.getData('label');
          if (label) {
            label.setPosition(playerData.position.x, playerData.position.y - 25);
            label.setText(
              `${playerData.username} (${playerData.health}HP)`,
            );
          }

          // Update color based on health
          if (playerData.health <= 0) {
            sprite.setAlpha(0.5);
          } else {
            sprite.setAlpha(1);
          }
        });
      }
    }

    // Initialize Phaser game
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameRef.current,
      backgroundColor: '#0f0f23',
      scene: GameScene,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
    };

    const phaserGame = new Phaser.Game(config);
    phaserGameRef.current = phaserGame;

    const scene = phaserGame.scene.getScene('GameScene') as GameScene;

    // Socket event handlers
    socket.on('connect', () => {
      setStatus('Finding match...');
      socket.emit('join_matchmaking');
    });

    socket.on('game_started', (data: { roomId: string; players: any[] }) => {
      setStatus('Game Started!');
      scene.updatePlayers(data.players);
    });

    socket.on('game_state', (state: GameState) => {
      setGameState(state);
      if (state.players) {
        scene.updatePlayers(state.players);
      }
    });

    socket.on('player_moved', (data: { playerId: string; position: any }) => {
      // Handle other player movements
    });

    socket.on('player_attacked', (data: { attackerId: string; targetId: string }) => {
      // Visual feedback for attacks
    });

    socket.on('game_ended', (data: { winnerId: string; scores: Record<string, number>; duration: number }) => {
      setStatus(`Game Over! Winner: ${data.winnerId === user!.id ? 'You!' : 'Opponent'}`);
      setTimeout(() => {
        navigate('/lobby');
      }, 5000);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      phaserGame.destroy(true);
    };
  }, [user, token, navigate]);

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-status">{status}</div>
        {gameState && (
          <div className="game-info">
            {gameState.players
              .filter((p) => p.id === user?.id)
              .map((p) => (
                <div key={p.id}>
                  Health: {p.health} | Score: {p.score}
                </div>
              ))}
          </div>
        )}
        <button onClick={() => navigate('/lobby')} className="leave-btn">
          Leave Game
        </button>
      </div>
      <div ref={gameRef} className="game-canvas"></div>
      <div className="game-controls">
        <p>🎮 Controls: Arrow Keys / WASD to move, SPACE to attack</p>
      </div>
    </div>
  );
}
