const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Add compression for better performance
const compression = require('compression');
app.use(compression());

// Database setup with better error handling
const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/users.db' : './users.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

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

// Enhanced session configuration for production
app.use(session({
  secret: process.env.SESSION_SECRET || 'dicee-game-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  },
  name: 'dicee.sid' // Custom session name
}));

// Serve static files with better caching
app.use(express.static(__dirname, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// Health check endpoint for render.com
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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

  // Enhanced validation
  if (!username || !email || !password) {
    return res.json({ success: false, message: 'All fields are required' });
  }

  if (username.length < 3) {
    return res.json({ success: false, message: 'Username must be at least 3 characters' });
  }

  if (password.length < 6) {
    return res.json({ success: false, message: 'Password must be at least 6 characters' });
  }

  // Enhanced email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.json({ success: false, message: 'Please enter a valid email address' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12); // Increased salt rounds
    
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
      [username.trim(), email.toLowerCase().trim(), hashedPassword], 
      function(err) {
        if (err) {
          console.error('Signup error:', err);
          if (err.message.includes('UNIQUE constraint failed: users.username')) {
            res.json({ success: false, message: 'Username already exists. Please choose a different one.' });
          } else if (err.message.includes('UNIQUE constraint failed: users.email')) {
            res.json({ success: false, message: 'Email already registered. Please use a different email or try logging in.' });
          } else {
            res.json({ success: false, message: 'Error creating account. Please try again.' });
          }
        } else {
          // Set session data
          req.session.userId = this.lastID;
          req.session.username = username.trim();
          
          // Save session before responding
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
              res.json({ success: false, message: 'Account created but login failed. Please try logging in.' });
            } else {
              res.json({ success: true, message: 'Account created successfully!' });
            }
          });
        }
      });
  } catch (error) {
    console.error('Signup hash error:', error);
    res.json({ success: false, message: 'Error creating account. Please try again.' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username.trim(), username.toLowerCase().trim()], async (err, user) => {
    if (err) {
      console.error('Login error:', err);
      res.json({ success: false, message: 'Error logging in. Please try again.' });
    } else if (!user) {
      res.json({ success: false, message: 'Invalid username/email or password' });
    } else {
      try {
        const validPassword = await bcrypt.compare(password, user.password);
        if (validPassword) {
          req.session.userId = user.id;
          req.session.username = user.username;
          
          // Save session before responding
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
              res.json({ success: false, message: 'Login failed. Please try again.' });
            } else {
              res.json({ success: true, message: 'Login successful!' });
            }
          });
        } else {
          res.json({ success: false, message: 'Invalid username/email or password' });
        }
      } catch (error) {
        console.error('Password comparison error:', error);
        res.json({ success: false, message: 'Error logging in. Please try again.' });
      }
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      res.json({ success: false, message: 'Error logging out' });
    } else {
      res.clearCookie('dicee.sid');
      res.json({ success: true, message: 'Logged out successfully' });
    }
  });
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
      console.error('Stats fetch error:', err);
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
        console.error('Stats save error:', err);
        res.json({ success: false, message: 'Error saving stats' });
      } else {
        res.json({ success: true, message: 'Stats saved successfully' });
      }
    });
});

// =============================
// Forgot / Reset Password Flow
// =============================

// Enhanced SMTP configuration with fallback
let transporter = null;

// Initialize email transporter
function initializeEmailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      // Verify connection
      transporter.verify((error, success) => {
        if (error) {
          console.error('Email configuration error:', error);
          transporter = null;
        } else {
          console.log('Email server is ready to send messages');
        }
      });
    } catch (error) {
      console.error('Error initializing email transporter:', error);
      transporter = null;
    }
  } else {
    console.warn('SMTP environment variables not set. Email functionality will not work.');
  }
}

// Initialize on startup
initializeEmailTransporter();

// Request password reset
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({ success: false, message: 'Email is required' });
  }

  // Validate email format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.json({ success: false, message: 'Please enter a valid email address' });
  }

  db.get('SELECT id, username FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, user) => {
    if (err) {
      console.error('Database error in forgot password:', err);
      return res.json({ success: false, message: 'Database error occurred' });
    }

    // Always return success message for security (don't reveal if email exists)
    const successMessage = 'If that email is registered, a reset link has been sent';

    if (!user) {
      return res.json({ success: true, message: successMessage });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour expiry

    // Insert or update token for the user
    db.run(`INSERT INTO password_resets (user_id, token, expires_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at`,
      [user.id, token, expiresAt], (err2) => {
        if (err2) {
          console.error('Error generating reset token:', err2);
          return res.json({ success: false, message: 'Error generating reset link' });
        }

        const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;

        if (transporter) {
          const mailOptions = {
            from: process.env.FROM_EMAIL || '"Dicee Battle" <no-reply@dicee-battle.com>',
            to: email,
            subject: 'Password Reset Request - Dicee Battle',
            text: `Hello ${user.username},\n\nYou requested a password reset for your Dicee Battle account.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nDicee Battle Team`,
            html: `
              <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 10px; text-align: center;">
                  <h1 style="color: #333; margin-bottom: 20px;">🎲 Dicee Battle</h1>
                  <h2 style="color: #667eea; margin-bottom: 20px;">Password Reset Request</h2>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    Hello <strong>${user.username}</strong>,
                  </p>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    You requested a password reset for your Dicee Battle account. Click the button below to reset your password:
                  </p>
                  <a href="${resetLink}" style="display: inline-block; background: linear-gradient(45deg, #ff6b6b, #ee5a24); color: white; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px;">Reset Password</a>
                  <p style="color: #999; font-size: 14px; margin-top: 30px; line-height: 1.6;">
                    This link will expire in 1 hour. If you did not request this, please ignore this email.
                  </p>
                  <p style="color: #999; font-size: 12px; margin-top: 20px;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <span style="word-break: break-all;">${resetLink}</span>
                  </p>
                </div>
              </div>
            `
          };

          transporter.sendMail(mailOptions, (err3, info) => {
            if (err3) {
              console.error('Error sending email:', err3);
              return res.json({ success: false, message: 'Error sending reset email. Please try again later.' });
            }
            console.log('Password reset email sent:', info.response);
            res.json({ success: true, message: successMessage });
          });
        } else {
          console.log('Password reset link (email not configured):', resetLink);
          res.json({ success: false, message: 'Email service is not configured. Please contact support.' });
        }
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
      console.error('Database error in reset password:', err);
      return res.json({ success: false, message: 'Database error occurred' });
    }

    if (!resetRow) {
      return res.json({ success: false, message: 'Invalid or expired reset token' });
    }

    // Check expiry
    if (new Date(resetRow.expires_at) < new Date()) {
      // Delete expired token
      db.run('DELETE FROM password_resets WHERE id = ?', [resetRow.id]);
      return res.json({ success: false, message: 'Reset token has expired. Please request a new one.' });
    }

    // Hash new password
    try {
      const hashedPassword = await bcrypt.hash(password, 12);

      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetRow.user_id], function(err2) {
        if (err2) {
          console.error('Error updating password:', err2);
          return res.json({ success: false, message: 'Error updating password' });
        }

        // Delete token after successful reset
        db.run('DELETE FROM password_resets WHERE id = ?', [resetRow.id]);

        res.json({ success: true, message: 'Password updated successfully! You can now log in with your new password.' });
      });
    } catch (error) {
      console.error('Error hashing new password:', error);
      res.json({ success: false, message: 'Error updating password' });
    }
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing database connection...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`🎲 Dicee Battle Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${dbPath}`);
});