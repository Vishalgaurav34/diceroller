const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Database setup
const db = new sqlite3.Database('./users.db');

// Create users table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Create game_stats table for user-specific statistics
  db.run(`CREATE TABLE IF NOT EXISTS game_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    player1_wins INTEGER DEFAULT 0,
    player2_wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id)
  )`);
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'dicee-game-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Serve static files
app.use(express.static(__dirname));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/game.html');
  } else {
    res.redirect('/login.html');
  }
});

app.get('/game.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
  if (req.session.userId) {
    res.redirect('/game.html');
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

app.get('/signup.html', (req, res) => {
  if (req.session.userId) {
    res.redirect('/game.html');
  } else {
    res.sendFile(path.join(__dirname, 'signup.html'));
  }
});

// API Routes
app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.json({ success: false, message: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.json({ success: false, message: 'Password must be at least 6 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
      [username, email, hashedPassword], 
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed: users.username')) {
            res.json({ success: false, message: 'Username already exists' });
          } else if (err.message.includes('UNIQUE constraint failed: users.email')) {
            res.json({ success: false, message: 'Email already exists' });
          } else {
            res.json({ success: false, message: 'Error creating account' });
          }
        } else {
          req.session.userId = this.lastID;
          req.session.username = username;
          res.json({ success: true, message: 'Account created successfully' });
        }
      });
  } catch (error) {
    res.json({ success: false, message: 'Error creating account' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      res.json({ success: false, message: 'Error logging in' });
    } else if (!user) {
      res.json({ success: false, message: 'Invalid username or password' });
    } else {
      const validPassword = await bcrypt.compare(password, user.password);
      if (validPassword) {
        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true, message: 'Login successful' });
      } else {
        res.json({ success: false, message: 'Invalid username or password' });
      }
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/user', requireAuth, (req, res) => {
  res.json({ 
    success: true, 
    user: { 
      id: req.session.userId, 
      username: req.session.username 
    } 
  });
});

// Get user's game statistics
app.get('/api/stats', requireAuth, (req, res) => {
  const userId = req.session.userId;
  
  db.get('SELECT * FROM game_stats WHERE user_id = ?', [userId], (err, stats) => {
    if (err) {
      res.json({ success: false, message: 'Error fetching stats' });
    } else if (!stats) {
      // Create default stats for new user
      res.json({ 
        success: true, 
        stats: {
          player1Wins: 0,
          player2Wins: 0,
          draws: 0,
          totalGames: 0
        }
      });
    } else {
      res.json({ 
        success: true, 
        stats: {
          player1Wins: stats.player1_wins,
          player2Wins: stats.player2_wins,
          draws: stats.draws,
          totalGames: stats.total_games
        }
      });
    }
  });
});

// Save user's game statistics
app.post('/api/stats', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { player1Wins, player2Wins, draws, totalGames } = req.body;
  
  if (typeof player1Wins !== 'number' || typeof player2Wins !== 'number' || 
      typeof draws !== 'number' || typeof totalGames !== 'number') {
    return res.json({ success: false, message: 'Invalid stats data' });
  }
  
  // Use INSERT OR REPLACE to handle both new and existing records
  db.run(`INSERT OR REPLACE INTO game_stats 
          (user_id, player1_wins, player2_wins, draws, total_games) 
          VALUES (?, ?, ?, ?, ?)`, 
    [userId, player1Wins, player2Wins, draws, totalGames], 
    function(err) {
      if (err) {
        res.json({ success: false, message: 'Error saving stats' });
      } else {
        res.json({ success: true, message: 'Stats saved successfully' });
      }
    });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});