# 🎲 Dicee Battle - Multiplayer Dice Game with Authentication

A modern, interactive dice game with user authentication, beautiful UI, and SQLite database integration.

## ✨ Features

- **User Authentication**: Secure login and signup system
- **SQLite Database**: Stores user information securely with bcrypt password hashing
- **Modern UI**: Beautiful, responsive design with animations and particle effects
- **Real-time Game**: Interactive dice rolling with sound effects and animations
- **Session Management**: Secure session handling with Express sessions
- **Game Statistics**: Track wins, losses, and draws
- **Responsive Design**: Works perfectly on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone or download the project files**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

### For Development

To run the server with auto-restart on file changes:
```bash
npm run dev
```

## 🎮 How to Play

1. **Sign Up**: Create a new account with username, email, and password
2. **Login**: Use your credentials to access the game
3. **Roll Dice**: Click the "Roll Dice" button to play
4. **Win Rounds**: Higher dice roll wins the round and earns points
5. **Game Victory**: First player to reach 50 points wins the game
6. **Track Stats**: View your game statistics and performance

## 🛠 Technology Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **SQLite3**: Database for user storage
- **bcryptjs**: Password hashing
- **express-session**: Session management
- **body-parser**: Request parsing

### Frontend
- **HTML5**: Structure and semantics
- **CSS3**: Modern styling with animations
- **JavaScript (ES6+)**: Interactive gameplay
- **Font Awesome**: Icons
- **Google Fonts**: Typography (Poppins, Fredoka One)

## 📁 Project Structure

```
dicee-game-auth/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── users.db          # SQLite database (auto-created)
├── index.html        # Game page (protected)
├── login.html        # Login page
├── signup.html       # Signup page
├── index.js          # Game logic
├── styles.css        # Game styles
├── images/           # Dice images
│   ├── dice1.png
│   ├── dice2.png
│   ├── dice3.png
│   ├── dice4.png
│   ├── dice5.png
│   └── dice6.png
└── README.md         # This file
```

## 🔐 Security Features

- **Password Hashing**: Uses bcrypt with salt rounds for secure password storage
- **Session Management**: Secure session handling with Express sessions
- **SQL Injection Protection**: Parameterized queries prevent SQL injection
- **Input Validation**: Server-side validation for all user inputs
- **Authentication Middleware**: Protects game routes from unauthorized access

## 🎨 Customization

### Changing Game Rules
Edit the `checkGameWinner()` function in `index.js` to modify the winning score (default: 50 points).

### Styling
Modify `styles.css` to customize colors, animations, and layout.

### Database
The SQLite database is automatically created with the following schema:
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🌐 API Endpoints

- `POST /api/signup` - Create new user account
- `POST /api/login` - Authenticate user
- `POST /api/logout` - End user session
- `GET /api/user` - Get current user info
- `GET /` - Redirect to appropriate page
- `GET /game.html` - Protected game page
- `GET /login.html` - Login page
- `GET /signup.html` - Signup page

## 🔧 Troubleshooting

### Port Already in Use
If port 3000 is busy, modify the `PORT` variable in `server.js`:
```javascript
const PORT = 3001; // Change to available port
```

### Database Issues
Delete `users.db` file and restart the server to recreate the database.

### Dependencies Not Installing
Try:
```bash
npm cache clean --force
npm install
```

## 📱 Mobile Support

The game is fully responsive and optimized for mobile devices with:
- Touch-friendly buttons
- Responsive grid layout
- Optimized animations for mobile performance
- Adaptive text sizing

## 🎯 Future Enhancements

- [ ] Multiplayer support with WebSockets
- [ ] User profiles and avatars
- [ ] Tournament mode
- [ ] Sound effects
- [ ] Leaderboards
- [ ] Social sharing
- [ ] Progressive Web App (PWA) features

## 📄 License

MIT License - Feel free to use and modify for your projects.

## 👨‍💻 Author

**Vishal Gowrav** - Enhanced with modern UI and authentication system

---

Enjoy playing Dicee Battle! 🎲✨