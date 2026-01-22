import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Lobby.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface LeaderboardEntry {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
}

export default function Lobby() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/users/leaderboard`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  const handlePlay = () => {
    navigate('/game');
  };

  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <h1>🎮 ARENAHUB</h1>
        <div className="user-info">
          <div>
            <strong>{user?.username}</strong>
            <div className="stats">
              Rating: {user?.rating} | W: {user?.wins} | L: {user?.losses}
            </div>
          </div>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="lobby-content">
        <div className="play-section">
          <h2>Ready to Battle?</h2>
          <p>Join a match and compete against other players!</p>
          <button
            onClick={handlePlay}
            disabled={loading}
            className="play-button"
          >
            {loading ? 'Finding Match...' : '🎯 Play Now'}
          </button>
        </div>

        <div className="leaderboard-section">
          <h2>🏆 Leaderboard</h2>
          <div className="leaderboard">
            {leaderboard.map((entry, index) => (
              <div key={entry.id} className="leaderboard-entry">
                <span className="rank">#{index + 1}</span>
                <span className="username">{entry.username}</span>
                <span className="rating">{entry.rating}</span>
                <span className="record">
                  {entry.wins}W / {entry.losses}L
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
