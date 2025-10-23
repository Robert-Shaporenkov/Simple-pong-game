// Simple Pong with adjustable AI difficulty, on-screen slider, and Pause/Resume button.
// Drop index.html, style.css, script.js in the same folder and open index.html

const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Paddle settings
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 90;
const PADDLE_MARGIN = 20;
const PLAYER_COLOR = "#00eaff";
const AI_COLOR = "#ff006e";

// Ball settings
const BALL_SIZE = 16;
const BALL_COLOR = "#ffffff";
const BALL_SPEED = 5;

// Game state
let playerY = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
let aiY = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
let ballX = CANVAS_WIDTH / 2 - BALL_SIZE / 2;
let ballY = CANVAS_HEIGHT / 2 - BALL_SIZE / 2;
let ballSpeedX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
let ballSpeedY = BALL_SPEED * (Math.random() * 2 - 1);

let playerScore = 0;
let aiScore = 0;

// UI elements
const difficultySlider = document.getElementById('difficulty');
const difficultyLabel = document.getElementById('difficultyLabel');
const showTargetCheckbox = document.getElementById('showTarget');
const resetBtn = document.getElementById('resetBtn');
const pauseBtn = document.getElementById('pauseBtn');
const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl = document.getElementById('aiScore');

// AI difficulty normalized 0..1 (slider 0..100)
let aiDifficulty = Number(difficultySlider.value) / 100;

// AI state
let aiTargetY = aiY + PADDLE_HEIGHT / 2;
let framesSinceLastTarget = 0;
let aiIgnoreUntil = 0; // timestamp while AI "misses"

// Pause state
let isPaused = false;

// Utility: clamp
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Mouse and touch control for player's paddle
function setPlayerFromPointer(clientY) {
  const rect = canvas.getBoundingClientRect();
  const y = clientY - rect.top;
  playerY = y - PADDLE_HEIGHT / 2;
  playerY = clamp(playerY, 0, CANVAS_HEIGHT - PADDLE_HEIGHT);
}

canvas.addEventListener('mousemove', (e) => setPlayerFromPointer(e.clientY));
canvas.addEventListener('touchmove', (e) => {
  if (e.touches && e.touches.length) {
    setPlayerFromPointer(e.touches[0].clientY);
    e.preventDefault();
  }
}, { passive: false });

// Collision helper
function rectsCollide(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 &&
         x1 + w1 > x2 &&
         y1 < y2 + h2 &&
         y1 + h1 > y2;
}

// Compute AI parameters derived from aiDifficulty (0 = easy, 1 = hard)
function computeAiParams() {
  // aiMaxSpeed: how many px per frame AI can move (lower = worse)
  const aiMaxSpeed = 1 + aiDifficulty * 6; // ~1..7 px/frame

  // reactionUpdateInterval: how often AI re-targets the ball (frames)
  const reactionUpdateInterval = Math.max(1, Math.round(1 + (1 - aiDifficulty) * 20)); // easier -> longer delay

  // trackingError: px of offset when targeting (higher = worse)
  const trackingError = (1 - aiDifficulty) * 60; // easier -> bigger error

  // missChancePerFrame: small chance each frame AI will "miss" (ignore ball) for a short time
  const missChancePerFrame = (1 - aiDifficulty) * 0.004; // ~0..0.004

  // missDuration range in ms
  const missDuration = 300 + (1 - aiDifficulty) * 800; // easier -> longer misses

  return { aiMaxSpeed, reactionUpdateInterval, trackingError, missChancePerFrame, missDuration };
}

function update() {
  // Move ball
  ballX += ballSpeedX;
  ballY += ballSpeedY;

  // Top & bottom walls
  if (ballY <= 0) {
    ballY = 0;
    ballSpeedY *= -1;
  }
  if (ballY + BALL_SIZE >= CANVAS_HEIGHT) {
    ballY = CANVAS_HEIGHT - BALL_SIZE;
    ballSpeedY *= -1;
  }

  // Player paddle collision
  if (rectsCollide(
      ballX, ballY, BALL_SIZE, BALL_SIZE,
      PADDLE_MARGIN, playerY, PADDLE_WIDTH, PADDLE_HEIGHT
  )) {
    ballX = PADDLE_MARGIN + PADDLE_WIDTH;
    ballSpeedX = Math.abs(ballSpeedX); // ensure going right
    // Add spin based on where it hits
    let collidePoint = (ballY + BALL_SIZE/2) - (playerY + PADDLE_HEIGHT/2);
    collidePoint = collidePoint / (PADDLE_HEIGHT/2);
    ballSpeedY = BALL_SPEED * collidePoint;
    // Slightly increase speed so rallies progress
    ballSpeedX *= 1.02;
  }

  // AI paddle collision
  const aiPaddleX = CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH;
  if (rectsCollide(
      ballX, ballY, BALL_SIZE, BALL_SIZE,
      aiPaddleX, aiY, PADDLE_WIDTH, PADDLE_HEIGHT
  )) {
    ballX = aiPaddleX - BALL_SIZE;
    ballSpeedX = -Math.abs(ballSpeedX); // ensure going left
    let collidePoint = (ballY + BALL_SIZE/2) - (aiY + PADDLE_HEIGHT/2);
    collidePoint = collidePoint / (PADDLE_HEIGHT/2);
    ballSpeedY = BALL_SPEED * collidePoint;
    ballSpeedX *= 1.02;
  }

  // Left & right walls (score)
  if (ballX < 0) {
    aiScore++;
    updateScoreUI();
    resetBall();
  }
  if (ballX + BALL_SIZE > CANVAS_WIDTH) {
    playerScore++;
    updateScoreUI();
    resetBall();
  }

  // AI movement
  const { aiMaxSpeed, reactionUpdateInterval, trackingError, missChancePerFrame, missDuration } = computeAiParams();

  // Chance to start a "miss" (only if not already missing)
  if (Date.now() > aiIgnoreUntil && Math.random() < missChancePerFrame) {
    aiIgnoreUntil = Date.now() + (missDuration * (0.5 + Math.random() * 0.5));
  }

  if (Date.now() < aiIgnoreUntil) {
    // during miss, AI may drift slowly or stand still
    if (Math.random() < 0.5) {
      aiY += (Math.random() < 0.5 ? -0.25 : 0.25) * aiMaxSpeed;
    }
    aiY = clamp(aiY, 0, CANVAS_HEIGHT - PADDLE_HEIGHT);
  } else {
    // Normal tracking with reaction delay and error
    framesSinceLastTarget++;
    if (framesSinceLastTarget >= reactionUpdateInterval) {
      const ballCenter = ballY + BALL_SIZE / 2;
      const error = (Math.random() - 0.5) * 2 * trackingError; // centered +/- trackingError
      aiTargetY = ballCenter + error;
      framesSinceLastTarget = 0;
    }

    const aiCenter = aiY + PADDLE_HEIGHT / 2;
    const diff = aiTargetY - aiCenter;
    const move = Math.sign(diff) * Math.min(Math.abs(diff), aiMaxSpeed);
    aiY += move;
    aiY = clamp(aiY, 0, CANVAS_HEIGHT - PADDLE_HEIGHT);
  }
}

function resetBall() {
  ballX = CANVAS_WIDTH / 2 - BALL_SIZE / 2;
  ballY = CANVAS_HEIGHT / 2 - BALL_SIZE / 2;
  // Start toward the player or AI randomly, with slight vertical variance
  ballSpeedX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
  ballSpeedY = BALL_SPEED * (Math.random() * 2 - 1);
  // small chance AI will be distracted after score
  if (Math.random() < 0.4) {
    aiIgnoreUntil = Date.now() + 300 + Math.random() * 700;
  }
}

function draw() {
  // Clear
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Center dashed line
  ctx.setLineDash([8, 12]);
  ctx.strokeStyle = "#666";
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH / 2, 0);
  ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  // Scores
  ctx.fillStyle = "#ffffff";
  ctx.font = "48px Arial";
  ctx.textAlign = "center";
  ctx.fillText(playerScore, CANVAS_WIDTH / 4, 60);
  ctx.fillText(aiScore, CANVAS_WIDTH * 3 / 4, 60);

  // Paddles
  ctx.fillStyle = PLAYER_COLOR;
  ctx.fillRect(PADDLE_MARGIN, playerY, PADDLE_WIDTH, PADDLE_HEIGHT);

  ctx.fillStyle = AI_COLOR;
  ctx.fillRect(CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH, aiY, PADDLE_WIDTH, PADDLE_HEIGHT);

  // Ball
  ctx.fillStyle = BALL_COLOR;
  ctx.fillRect(ballX, ballY, BALL_SIZE, BALL_SIZE);

  // Optional: draw AI target
  if (showTargetCheckbox.checked) {
    ctx.strokeStyle = "rgba(255,0,110,0.5)";
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH - 8, aiTargetY);
    ctx.lineTo(CANVAS_WIDTH, aiTargetY);
    ctx.stroke();

    // small circle at target
    ctx.fillStyle = "rgba(255,0,110,0.6)";
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH - 14, aiTargetY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // If paused, draw overlay
  if (isPaused) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Paused", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);

    ctx.font = "16px Arial";
    ctx.fillText("Press Space or the Resume button to continue", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 24);
  }
}

// Animation loop
function gameLoop() {
  if (!isPaused) {
    update();
  }
  draw();
  requestAnimationFrame(gameLoop);
}

// UI helpers
function updateDifficultyUI() {
  difficultyLabel.textContent = Math.round(aiDifficulty * 100) + "%";
  difficultySlider.value = Math.round(aiDifficulty * 100);
}

function updateScoreUI() {
  playerScoreEl.textContent = playerScore.toString();
  aiScoreEl.textContent = aiScore.toString();
}

difficultySlider.addEventListener('input', (e) => {
  aiDifficulty = clamp(Number(e.target.value) / 100, 0, 1);
  updateDifficultyUI();
});

// reset button
resetBtn.addEventListener('click', () => {
  playerScore = 0;
  aiScore = 0;
  updateScoreUI();
  resetBall();
});

// pause button behavior
function setPaused(p) {
  isPaused = !!p;
  pauseBtn.setAttribute('aria-pressed', String(isPaused));
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
}

pauseBtn.addEventListener('click', () => {
  setPaused(!isPaused);
});

// spacebar toggles pause
window.addEventListener('keydown', (e) => {
  // ignore if typing in an input (rare here)
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

  if (e.code === 'Space') {
    e.preventDefault();
    setPaused(!isPaused);
  }
});

// expose runtime setter
window.setAiDifficulty = function(value) {
  aiDifficulty = clamp(Number(value) || 0, 0, 1);
  updateDifficultyUI();
};

// initialize
updateDifficultyUI();
updateScoreUI();
gameLoop();