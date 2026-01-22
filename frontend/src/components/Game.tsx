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
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState('Connecting...');
  const updateQueueRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading) {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        navigate('/login');
        return;
      }
      if (!user || !token) {
        navigate('/login');
        return;
      }
    }
  }, [user, token, loading, navigate]);

  useEffect(() => {
    if (!gameRef.current || !user || !token || loading) {
      if (loading) {
        setStatus('Loading...');
      } else if (!user || !token) {
        setStatus('Not authenticated');
      }
      return;
    }

    // Prevent double initialization
    if (phaserGameRef.current || socketRef.current) {
      return;
    }

    // Initialize Socket.IO
    let socketUrl = API_URL || 'http://localhost:3000';
    if (socketUrl.includes('/api')) {
      socketUrl = socketUrl.replace('/api', '');
    }
    
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Phaser Game Scene
    class GameScene extends Phaser.Scene {
      private players: Map<string, Phaser.GameObjects.Sprite> = new Map();
      private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      private myPlayerId: string;
      private loadingText?: Phaser.GameObjects.Text;
      private isReady: boolean = false;
      private socket: Socket;

      constructor(socket: Socket, userId: string) {
        super({ key: 'GameScene' });
        this.socket = socket;
        this.myPlayerId = userId;
      }

      create() {
        console.log('🎮 Phaser GameScene created');
        
        // Create game background
        this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
        this.add.rectangle(400, 300, 800, 600, 0x16213e, 0.5);
        
        // Add loading text
        this.loadingText = this.add.text(400, 300, 'Waiting for players...', {
          fontSize: '24px',
          color: '#fff',
        }).setOrigin(0.5);

        // Create cursors for movement
        this.cursors = this.input.keyboard!.createCursorKeys();
        const wasd = this.input.keyboard!.addKeys('W,S,A,D');

        // Movement handler
        const movePlayer = () => {
          if (!this.socket.connected) return;

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

              this.socket.emit('player_move', { x: newX, y: newY });
            }
          }
        };

        // Attack handler
        this.input.keyboard!.on('keydown-SPACE', () => {
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
            this.socket.emit('player_attack', { targetId: nearestPlayer.id });
          }
        });

        // Movement update loop
        this.time.addEvent({
          delay: 16,
          callback: movePlayer,
          loop: true,
        });

        // Mark scene as ready AFTER everything is initialized
        this.isReady = true;
        console.log('✅ Scene fully ready');
      }

      updatePlayers(players: GameState['players']) {
        // CRITICAL: Check scene readiness FIRST - check multiple times
        if (!this.isReady || !this.add || !this.sys || !this.scene) {
          return; // Silently skip if not ready
        }
        
        // Check add methods exist
        if (typeof this.add.circle !== 'function' || typeof this.add.text !== 'function') {
          return; // Silently skip if methods don't exist
        }
        
        if (!players || !Array.isArray(players)) {
          return;
        }
        
        // Remove loading text
        if (this.loadingText) {
          this.loadingText.destroy();
          this.loadingText = undefined;
        }
        
        players.forEach((playerData) => {
          if (!playerData || !playerData.id) return;
          
          let sprite = this.players.get(playerData.id);

          if (!sprite) {
            // Final check before creating sprite
            if (!this.add || typeof this.add.circle !== 'function') {
              return; // Silently skip
            }
            
            try {
              sprite = this.add.circle(
                playerData.position.x,
                playerData.position.y,
                16,
                playerData.id === this.myPlayerId ? 0x4ecdc4 : 0xff6b6b,
              );
              this.players.set(playerData.id, sprite);

              // Check again before creating label
              if (!this.add || typeof this.add.text !== 'function') {
                return;
              }

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
            } catch (error) {
              // Silently catch to prevent loop
              return;
            }
          }

          // Update position
          if (this.tweens) {
            this.tweens.add({
              targets: sprite,
              x: playerData.position.x,
              y: playerData.position.y,
              duration: 50,
              ease: 'Power2',
            });
          } else {
            sprite.setPosition(playerData.position.x, playerData.position.y);
          }

          // Update label
          const label = sprite.getData('label');
          if (label) {
            label.setPosition(playerData.position.x, playerData.position.y - 25);
            label.setText(`${playerData.username} (${playerData.health}HP)`);
          }

          // Update alpha based on health
          sprite.setAlpha(playerData.health <= 0 ? 0.5 : 1);
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
      scene: new GameScene(socket, user!.id),
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

    // Get scene reference
    const getScene = (): GameScene | null => {
      return phaserGame.scene.getScene('GameScene') as GameScene | null;
    };

    // Safe update function with debounce and retry
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE = 100; // Max once per 100ms
    
    const safeUpdatePlayers = (players: GameState['players']) => {
      const now = Date.now();
      if (now - lastUpdateTime < UPDATE_THROTTLE) {
        return; // Throttle updates
      }
      lastUpdateTime = now;
      
      if (isProcessingRef.current) {
        return; // Prevent concurrent updates
      }
      
      const scene = getScene();
      if (!scene) {
        return;
      }
      
      const sceneAny = scene as any;
      // CRITICAL: Check add property directly, not just isReady
      if (!sceneAny.isReady || !sceneAny.add || !sceneAny.sys || !sceneAny.scene) {
        return; // Silently skip if not ready
      }
      
      // Double check add is not null
      if (!sceneAny.add || typeof sceneAny.add.circle !== 'function') {
        return;
      }
      
      isProcessingRef.current = true;
      try {
        scene.updatePlayers(players);
      } catch (error) {
        // Silently catch errors to prevent loop
        console.error('Error in updatePlayers:', error);
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Socket event handlers
    socket.on('connect', () => {
      console.log('✅ Socket connected!');
      setStatus('Finding match...');
      socket.emit('join_matchmaking');
    });

    socket.on('game_started', (data: { roomId: string; players: any[] }) => {
      console.log('Game started!', data);
      setStatus('Game Started!');
      if (data.players) {
        // Wait a bit for scene to be fully ready
        setTimeout(() => {
          safeUpdatePlayers(data.players);
        }, 200);
      }
    });

    socket.on('game_state', (state: GameState) => {
      setGameState(state);
      if (state.players) {
        // Throttle game_state updates to prevent loop
        setTimeout(() => {
          safeUpdatePlayers(state.players);
        }, 50);
      }
    });

    socket.on('player_moved', () => {
      // Handled by game_state
    });

    socket.on('player_attacked', () => {
      // Visual feedback can be added here
    });

    socket.on('game_ended', (data: { winnerId: string; scores: Record<string, number>; duration: number }) => {
      setStatus(`Game Over! Winner: ${data.winnerId === user!.id ? 'You!' : 'Opponent'}`);
      setTimeout(() => {
        navigate('/lobby');
      }, 5000);
    });

    // Cleanup
    return () => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
      if (phaserGame && !phaserGame.destroyed) {
        phaserGame.destroy(true);
      }
      isProcessingRef.current = false;
      updateQueueRef.current = [];
      phaserGameRef.current = null;
      socketRef.current = null;
    };
  }, [user, token, loading, navigate]);

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-status">{status}</div>
        {gameState && gameState.players && (
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
