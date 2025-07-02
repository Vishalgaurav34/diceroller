// Game State
let gameState = {
    player1Score: 0,
    player2Score: 0,
    roundCount: 0,
    gameStats: {
        player1Wins: 0,
        player2Wins: 0,
        draws: 0,
        totalGames: 0
    },
    isRolling: false
};

// DOM Elements
const elements = {
    dice1: document.getElementById('dice1'),
    dice2: document.getElementById('dice2'),
    score1: document.getElementById('score1'),
    score2: document.getElementById('score2'),
    lastRoll1: document.getElementById('lastRoll1'),
    lastRoll2: document.getElementById('lastRoll2'),
    statusMessage: document.getElementById('statusMessage'),
    roundCount: document.getElementById('roundCount'),
    rollBtn: document.getElementById('rollBtn'),
    resetBtn: document.getElementById('resetBtn'),
    crown1: document.getElementById('crown1'),
    crown2: document.getElementById('crown2'),
    player1Card: document.getElementById('player1'),
    player2Card: document.getElementById('player2'),
    p1Wins: document.getElementById('p1Wins'),
    p2Wins: document.getElementById('p2Wins'),
    draws: document.getElementById('draws'),
    totalGames: document.getElementById('totalGames')
};

// Initialize Game
function initGame() {
    loadGameStats();
    updateStatsDisplay();
    setupEventListeners();
    resetGame();
}

// Setup Event Listeners
function setupEventListeners() {
    elements.rollBtn.addEventListener('click', rollDice);
    elements.resetBtn.addEventListener('click', resetGame);
    
    // Add keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !gameState.isRolling) {
            e.preventDefault();
            rollDice();
        }
        if (e.code === 'KeyR') {
            resetGame();
        }
    });
}

// Roll Dice Function
async function rollDice() {
    if (gameState.isRolling) return;
    
    gameState.isRolling = true;
    elements.rollBtn.disabled = true;
    
    // Clear previous winner states
    clearWinnerEffects();
    
    // Add rolling animation
    elements.dice1.classList.add('rolling');
    elements.dice2.classList.add('rolling');
    
    // Update status
    elements.statusMessage.textContent = "Rolling dice...";
    
    // Simulate rolling animation with random dice changes
    await animateRolling();
    
    // Generate final random numbers
    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    
    // Set final dice images
    elements.dice1.src = `images/dice${roll1}.png`;
    elements.dice2.src = `images/dice${roll2}.png`;
    
    // Update last rolls
    elements.lastRoll1.textContent = roll1;
    elements.lastRoll2.textContent = roll2;
    
    // Remove rolling animation
    elements.dice1.classList.remove('rolling');
    elements.dice2.classList.remove('rolling');
    
    // Update scores
    updateScores(roll1, roll2);
    
    // Determine and announce winner
    determineWinner(roll1, roll2);
    
    // Update round count
    gameState.roundCount++;
    elements.roundCount.textContent = gameState.roundCount;
    
    // Re-enable roll button
    gameState.isRolling = false;
    elements.rollBtn.disabled = false;
}

// Animate Rolling Effect
function animateRolling() {
    return new Promise((resolve) => {
        let count = 0;
        const interval = setInterval(() => {
            const randomDice1 = Math.floor(Math.random() * 6) + 1;
            const randomDice2 = Math.floor(Math.random() * 6) + 1;
            
            elements.dice1.src = `images/dice${randomDice1}.png`;
            elements.dice2.src = `images/dice${randomDice2}.png`;
            
            count++;
            if (count >= 10) { // Roll for 1 second (10 * 100ms)
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
}

// Update Scores
function updateScores(roll1, roll2) {
    if (roll1 > roll2) {
        gameState.player1Score += roll1;
    } else if (roll2 > roll1) {
        gameState.player2Score += roll2;
    }
    // No score change for draws
    
    // Update display with animation
    animateScoreChange(elements.score1, gameState.player1Score);
    animateScoreChange(elements.score2, gameState.player2Score);
}

// Animate Score Change
function animateScoreChange(element, newScore) {
    element.style.transform = 'scale(1.2)';
    element.style.color = '#ffd700';
    
    setTimeout(() => {
        element.textContent = newScore;
        element.style.transform = 'scale(1)';
        element.style.color = '#ffffff';
    }, 200);
}

// Determine Winner
function determineWinner(roll1, roll2) {
    let message = '';
    let winner = null;
    
    if (roll1 > roll2) {
        message = `🏆 Player 1 wins this round! (${roll1} vs ${roll2})`;
        winner = 1;
        showWinnerEffects(1);
        // Update round wins in statistics
        gameState.gameStats.player1Wins++;
    } else if (roll2 > roll1) {
        message = `🏆 Player 2 wins this round! (${roll2} vs ${roll1})`;
        winner = 2;
        showWinnerEffects(2);
        // Update round wins in statistics
        gameState.gameStats.player2Wins++;
    } else {
        message = `🤝 It's a draw! Both rolled ${roll1}`;
        showDrawEffect();
        // Update draws in statistics
        gameState.gameStats.draws++;
    }
    
    // Update total games and display
    gameState.gameStats.totalGames++;
    updateStatsDisplay();
    saveGameStats();
    
    elements.statusMessage.textContent = message;
    
    // Check for game winner (first to reach 50 points)
    checkGameWinner();
}

// Show Winner Effects
function showWinnerEffects(player) {
    const playerCard = player === 1 ? elements.player1Card : elements.player2Card;
    const crown = player === 1 ? elements.crown1 : elements.crown2;
    
    playerCard.classList.add('winner');
    crown.classList.add('show');
    
    // Add particle effect
    createParticleEffect(playerCard);
    
    setTimeout(() => {
        playerCard.classList.remove('winner');
        crown.classList.remove('show');
    }, 2000);
}

// Show Draw Effect
function showDrawEffect() {
    elements.player1Card.style.transform = 'scale(1.02)';
    elements.player2Card.style.transform = 'scale(1.02)';
    
    setTimeout(() => {
        elements.player1Card.style.transform = 'scale(1)';
        elements.player2Card.style.transform = 'scale(1)';
    }, 500);
}

// Clear Winner Effects
function clearWinnerEffects() {
    elements.player1Card.classList.remove('winner');
    elements.player2Card.classList.remove('winner');
    elements.crown1.classList.remove('show');
    elements.crown2.classList.remove('show');
}

// Create Particle Effect
function createParticleEffect(container) {
    for (let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: #ffd700;
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            animation: confetti 1s ease-out forwards;
        `;
        
        const rect = container.getBoundingClientRect();
        particle.style.left = rect.left + rect.width / 2 + 'px';
        particle.style.top = rect.top + rect.height / 2 + 'px';
        
        document.body.appendChild(particle);
        
        // Remove particle after animation
        setTimeout(() => {
            particle.remove();
        }, 1000);
    }
}

// Check Game Winner
function checkGameWinner() {
    const winningScore = 50;
    let gameWinner = null;
    
    if (gameState.player1Score >= winningScore && gameState.player1Score > gameState.player2Score) {
        gameWinner = 1;
    } else if (gameState.player2Score >= winningScore && gameState.player2Score > gameState.player1Score) {
        gameWinner = 2;
    }
    
    if (gameWinner) {
        announceGameWinner(gameWinner);
        updateGameStats(gameWinner);
        setTimeout(() => {
            if (confirm(`Player ${gameWinner} wins the game! Play again?`)) {
                resetGame();
            }
        }, 2000);
    }
}

// Announce Game Winner
function announceGameWinner(winner) {
    const message = `🎉 GAME OVER! Player ${winner} wins! 🎉`;
    elements.statusMessage.textContent = message;
    elements.statusMessage.style.fontSize = '1.3rem';
    elements.statusMessage.style.color = '#ffd700';
    
    // Reset message style after 3 seconds
    setTimeout(() => {
        elements.statusMessage.style.fontSize = '1.1rem';
        elements.statusMessage.style.color = '#ffffff';
    }, 3000);
}

// Update Game Statistics (for full game wins - 50 points)
function updateGameStats(winner) {
    // This function is called when someone wins the full game (reaches 50 points)
    // Individual round wins are already tracked in determineWinner function
    updateStatsDisplay();
    saveGameStats();
}

// Update Stats Display
function updateStatsDisplay() {
    elements.p1Wins.textContent = gameState.gameStats.player1Wins;
    elements.p2Wins.textContent = gameState.gameStats.player2Wins;
    elements.draws.textContent = gameState.gameStats.draws;
    elements.totalGames.textContent = gameState.gameStats.totalGames;
}

// Reset Game
function resetGame() {
    gameState.player1Score = 0;
    gameState.player2Score = 0;
    gameState.roundCount = 0;
    gameState.isRolling = false;
    
    // Reset UI
    elements.score1.textContent = '0';
    elements.score2.textContent = '0';
    elements.lastRoll1.textContent = '-';
    elements.lastRoll2.textContent = '-';
    elements.roundCount.textContent = '0';
    elements.statusMessage.textContent = 'Click "Roll Dice" to start the battle!';
    elements.rollBtn.disabled = false;
    
    // Reset dice to default
    elements.dice1.src = 'images/dice1.png';
    elements.dice2.src = 'images/dice1.png';
    
    // Clear effects
    clearWinnerEffects();
}

// Save Game Stats to Local Storage
function saveGameStats() {
    localStorage.setItem('diceeGameStats', JSON.stringify(gameState.gameStats));
}

// Load Game Stats from Local Storage
function loadGameStats() {
    const savedStats = localStorage.getItem('diceeGameStats');
    if (savedStats) {
        gameState.gameStats = JSON.parse(savedStats);
    }
}

// Add Confetti CSS Animation
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confetti {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(-100px) translateX(${Math.random() * 200 - 100}px) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(confettiStyle);

// Authentication functions
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user');
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('welcomeUser').textContent = `Welcome, ${result.user.username}!`;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Setup logout button
function setupAuthListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    loadUserInfo();
    setupAuthListeners();
});

// Add some Easter eggs
let konamiCode = [];
const konamiSequence = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // Up Up Down Down Left Right Left Right B A

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.keyCode);
    if (konamiCode.length > konamiSequence.length) {
        konamiCode.shift();
    }
    
    if (konamiCode.join(',') === konamiSequence.join(',')) {
        // Easter egg: Rainbow dice mode
        document.body.style.filter = 'hue-rotate(0deg)';
        let hue = 0;
        const rainbowInterval = setInterval(() => {
            hue += 5;
            document.body.style.filter = `hue-rotate(${hue}deg)`;
            if (hue >= 360) {
                clearInterval(rainbowInterval);
                document.body.style.filter = 'none';
            }
        }, 50);
        konamiCode = [];
    }
});
