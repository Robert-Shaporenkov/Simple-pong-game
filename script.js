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
const BALL_COLOR = "#fff";
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

// Mouse movement
canvas.addEventListener("mousemove", (e) => {
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    playerY = mouseY - PADDLE_HEIGHT / 2;
    // Clamp paddle inside canvas
    playerY = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, playerY));
});

// Collision helpers
function rectsCollide(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 &&
           x1 + w1 > x2 &&
           y1 < y2 + h2 &&
           y1 + h1 > y2;
}

// Game logic
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
        ballSpeedX *= -1;
        // Add some "spin" based on where it hits
        let collidePoint = (ballY + BALL_SIZE/2) - (playerY + PADDLE_HEIGHT/2);
        collidePoint = collidePoint / (PADDLE_HEIGHT/2);
        ballSpeedY = BALL_SPEED * collidePoint;
    }

    // AI paddle collision
    if (rectsCollide(
        ballX, ballY, BALL_SIZE, BALL_SIZE,
        CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH, aiY, PADDLE_WIDTH, PADDLE_HEIGHT
    )) {
        ballX = CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE;
        ballSpeedX *= -1;
        // Add some "spin"
        let collidePoint = (ballY + BALL_SIZE/2) - (aiY + PADDLE_HEIGHT/2);
        collidePoint = collidePoint / (PADDLE_HEIGHT/2);
        ballSpeedY = BALL_SPEED * collidePoint;
    }

    // Left & right walls (score)
    if (ballX < 0) {
        aiScore++;
        resetBall();
    }
    if (ballX + BALL_SIZE > CANVAS_WIDTH) {
        playerScore++;
        resetBall();
    }

    // AI movement (simple follow)
    let aiCenter = aiY + PADDLE_HEIGHT / 2;
    let ballCenter = ballY + BALL_SIZE / 2;
    if (aiCenter < ballCenter - 10) {
        aiY += 5;
    } else if (aiCenter > ballCenter + 10) {
        aiY -= 5;
    }
    // Clamp AI paddle
    aiY = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, aiY));
}

function resetBall() {
    ballX = CANVAS_WIDTH / 2 - BALL_SIZE / 2;
    ballY = CANVAS_HEIGHT / 2 - BALL_SIZE / 2;
    ballSpeedX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    ballSpeedY = BALL_SPEED * (Math.random() * 2 - 1);
}

// Drawing
function draw() {
    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Center line
    ctx.setLineDash([8, 12]);
    ctx.strokeStyle = "#666";
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH/2, 0);
    ctx.lineTo(CANVAS_WIDTH/2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scores
    ctx.fillStyle = "#fff";
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
}

// Main loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();