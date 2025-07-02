const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

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

  // Table to store password reset tokens
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Ensure each user has at most one active reset token
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id)');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('trust proxy', 1); // Trust the first proxy hop (Render, Heroku, etc.)

// Security & performance middlewares
app.use(helmet());
app.use(compression());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dicee-game-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
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

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.json({ success: false, message: 'Invalid email address' });
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

// =============================
// Forgot / Reset Password Flow
// =============================

// Create a reusable transporter if SMTP env variables are provided
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// Request password reset
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({ success: false, message: 'Email is required' });
  }

  // Validate email format quickly
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.json({ success: false, message: 'Invalid email format' });
  }

  db.get('SELECT id, username FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.json({ success: false, message: 'Database error' });
    }

    if (!user) {
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour expiry

    // Insert or update token for the user
    db.run(`INSERT INTO password_resets (user_id, token, expires_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at`,
      [user.id, token, expiresAt], (err2) => {
        if (err2) {
          return res.json({ success: false, message: 'Error generating reset link' });
        }

        const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;

        if (transporter) {
          const mailOptions = {
            from: process.env.FROM_EMAIL || 'no-reply@example.com',
            to: email,
            subject: 'Password Reset Request',
            text: `Hello ${user.username},\n\nYou requested a password reset for your Dicee Battle account. Click the link below to reset your password: \n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`,
            html: `<p>Hello <strong>${user.username}</strong>,</p><p>You requested a password reset for your Dicee Battle account.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>This link will expire in 1 hour.</p><p>If you did not request this, please ignore this email.</p>`
          };

          transporter.sendMail(mailOptions, (err3) => {
            if (err3) {
              console.error('Error sending email:', err3);
            }
          });
        } else {
          console.log('Password reset link (email not configured):', resetLink);
        }

        res.json({ success: true, message: 'If that email is registered, a reset link has been sent' });
      });
  });
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.json({ success: false, message: 'Token and new password are required' });
  }

  if (password.length < 6) {
    return res.json({ success: false, message: 'Password must be at least 6 characters' });
  }

  db.get('SELECT * FROM password_resets WHERE token = ?', [token], async (err, resetRow) => {
    if (err) {
      return res.json({ success: false, message: 'Database error' });
    }

    if (!resetRow) {
      return res.json({ success: false, message: 'Invalid or expired token' });
    }

    // Check expiry
    if (new Date(resetRow.expires_at) < new Date()) {
      // Delete expired token
      db.run('DELETE FROM password_resets WHERE id = ?', [resetRow.id]);
      return res.json({ success: false, message: 'Token has expired' });
    }

    // Hash new password
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetRow.user_id], function(err2) {
        if (err2) {
          return res.json({ success: false, message: 'Error updating password' });
        }

        // Delete token after successful reset
        db.run('DELETE FROM password_resets WHERE id = ?', [resetRow.id]);

        res.json({ success: true, message: 'Password updated successfully' });
      });
    } catch (error) {
      res.json({ success: false, message: 'Error updating password' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});