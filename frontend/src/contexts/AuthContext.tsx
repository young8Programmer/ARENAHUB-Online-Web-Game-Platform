import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface User {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token'),
  );
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    // Only verify token once on mount
    if (verified) return;

    const storedToken = localStorage.getItem('token');
    if (storedToken && !token) {
      // If token exists in localStorage but not in state, restore it
      setToken(storedToken);
      return;
    }

    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token and get user info (only once)
      setVerified(true);
      axios
        .get(`${API_URL}/users/profile`)
        .then((res) => {
          setUser(res.data);
        })
        .catch((error) => {
          // Only log and remove token if it's actually invalid (401), not network errors
          if (error.response?.status === 401) {
            // Silently remove invalid token
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
          }
          // Ignore network errors (ERR_CONNECTION_REFUSED, etc.)
        })
        .finally(() => setLoading(false));
    } else {
      setVerified(true);
      setLoading(false);
    }
  }, [token, verified]);

  const login = async (username: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      username,
      password,
    });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    setVerified(true); // Mark as verified after successful login
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
  };

  const register = async (username: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      username,
      password,
    });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    setVerified(true); // Mark as verified after successful registration
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
