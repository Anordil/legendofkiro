// Game constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;
const WORLD_WIDTH = 600;
const WORLD_HEIGHT = 3000; // 5 screens tall
const PLAYER_SIZE = 30;
const COLLECTIBLE_SIZE = 20;
const PLAYER_SPEED = 3;
const FRICTION = 0.85;
const ENEMY_SIZE = 30;
const BOSS_SIZE = 60;

// Game state
const game = {
    canvas: null,
    ctx: null,
    player: null,
    camera: { x: 0, y: 0 },
    keys: {},
    score: 0,
    gameOver: false,
    won: false,
    obstacles: [],
    collectibles: [],
    enemies: [],
    boss: null
};

// Player class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.vx = 0;
        this.vy = 0;
        this.health = 4;
        this.maxHealth = 4;
        this.image = new Image();
        this.image.src = 'kiro-logo.png';
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.attacking = false;
        this.attackTime = 0;
        this.attackDuration = 15; // frames
        this.facingDirection = 'up'; // up, down, left, right
        this.swordDamage = 2;
    }

    update() {
        // Update attack animation
        if (this.attacking) {
            this.attackTime++;
            if (this.attackTime >= this.attackDuration) {
                this.attacking = false;
                this.attackTime = 0;
            }
        }

        // Movement with no diagonal
        let moving = false;
        
        if (game.keys['ArrowUp'] || game.keys['w']) {
            this.vy = -PLAYER_SPEED;
            this.facingDirection = 'up';
            moving = true;
        } else if (game.keys['ArrowDown'] || game.keys['s']) {
            this.vy = PLAYER_SPEED;
            this.facingDirection = 'down';
            moving = true;
        } else {
            this.vy = 0;
        }

        if (!moving) {
            if (game.keys['ArrowLeft'] || game.keys['a']) {
                this.vx = -PLAYER_SPEED;
                this.facingDirection = 'left';
            } else if (game.keys['ArrowRight'] || game.keys['d']) {
                this.vx = PLAYER_SPEED;
                this.facingDirection = 'right';
            }
        }

        // Apply friction to horizontal movement
        this.vx *= FRICTION;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;

        // Update position
        const newX = this.x + this.vx;
        const newY = this.y + this.vy;

        // Check collisions before moving
        if (!this.checkCollision(newX, this.y)) {
            this.x = newX;
        } else {
            this.vx = 0;
        }

        if (!this.checkCollision(this.x, newY)) {
            this.y = newY;
        } else {
            this.vy = 0;
        }

        // Keep player in bounds
        this.x = Math.max(this.width / 2, Math.min(WORLD_WIDTH - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(WORLD_HEIGHT - this.height / 2, this.y));

        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerableTime--;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }
    }

    checkCollision(x, y) {
        for (let obstacle of game.obstacles) {
            if (this.rectCollision(
                x - this.width / 2, y - this.height / 2, this.width, this.height,
                obstacle.x, obstacle.y, obstacle.width, obstacle.height
            )) {
                return true;
            }
        }
        return false;
    }

    rectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }

    takeDamage(amount) {
        if (!this.invulnerable) {
            this.health -= amount;
            this.invulnerable = true;
            this.invulnerableTime = 60; // 1 second at 60fps
            updateHearts();
            
            if (this.health <= 0) {
                gameOver(false);
            }
        }
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        updateHearts();
    }

    draw(ctx) {
        const screenX = this.x - game.camera.x;
        const screenY = this.y - game.camera.y;
        
        // Flash when invulnerable
        if (!this.invulnerable || Math.floor(this.invulnerableTime / 5) % 2 === 0) {
            ctx.drawImage(
                this.image,
                screenX - this.width / 2,
                screenY - this.height / 2,
                this.width,
                this.height
            );
        }

        // Draw sword
        this.drawSword(ctx, screenX, screenY);
    }

    drawSword(ctx, screenX, screenY) {
        if (!this.attacking) return;

        const progress = this.attackTime / this.attackDuration;
        const swingAngle = progress * Math.PI; // 0 to 180 degrees

        ctx.save();
        ctx.translate(screenX, screenY);

        // Rotate based on facing direction
        let baseAngle = 0;
        let swordLength = 25;
        let swordWidth = 6;

        switch (this.facingDirection) {
            case 'up':
                baseAngle = -Math.PI / 2;
                break;
            case 'down':
                baseAngle = Math.PI / 2;
                break;
            case 'left':
                baseAngle = Math.PI;
                break;
            case 'right':
                baseAngle = 0;
                break;
        }

        // Apply swing animation
        const currentAngle = baseAngle + (swingAngle - Math.PI / 2) * 0.8;
        ctx.rotate(currentAngle);

        // Draw sword blade
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(this.width / 2, -swordWidth / 2, swordLength, swordWidth);

        // Draw sword tip
        ctx.beginPath();
        ctx.moveTo(this.width / 2 + swordLength, -swordWidth / 2);
        ctx.lineTo(this.width / 2 + swordLength + 5, 0);
        ctx.lineTo(this.width / 2 + swordLength, swordWidth / 2);
        ctx.closePath();
        ctx.fill();

        // Draw sword hilt
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(this.width / 2 - 5, -swordWidth / 2, 8, swordWidth);

        // Draw sword guard
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(this.width / 2 - 2, -swordWidth / 2 - 3, 3, swordWidth + 6);

        ctx.restore();
    }
}

// Obstacle class
class Obstacle {
    constructor(x, y, width, height, type = 'tree') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }

    draw(ctx) {
        const screenX = this.x - game.camera.x;
        const screenY = this.y - game.camera.y;
        
        if (this.type === 'tree') {
            // Tree trunk
            ctx.fillStyle = '#4a2511';
            ctx.fillRect(screenX + this.width / 3, screenY + this.height / 2, this.width / 3, this.height / 2);
            // Tree top
            ctx.fillStyle = '#1a4d1a';
            ctx.beginPath();
            ctx.arc(screenX + this.width / 2, screenY + this.height / 3, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'mountain') {
            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + this.height);
            ctx.lineTo(screenX + this.width / 2, screenY);
            ctx.lineTo(screenX + this.width, screenY + this.height);
            ctx.closePath();
            ctx.fill();
            // Snow cap
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(screenX + this.width / 2, screenY);
            ctx.lineTo(screenX + this.width / 2 - 10, screenY + 15);
            ctx.lineTo(screenX + this.width / 2 + 10, screenY + 15);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// Collectible class
class Collectible {
    constructor(x, y, type = 'heart') {
        this.x = x;
        this.y = y;
        this.size = COLLECTIBLE_SIZE;
        this.type = type;
        this.collected = false;
    }

    draw(ctx) {
        if (this.collected) return;
        
        const screenX = this.x - game.camera.x;
        const screenY = this.y - game.camera.y;
        
        if (this.type === 'heart') {
            ctx.fillStyle = '#ff0066';
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-this.size / 4, -this.size / 4, this.size / 2, this.size / 2);
            ctx.restore();
            
            ctx.beginPath();
            ctx.arc(screenX - this.size / 6, screenY - this.size / 6, this.size / 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + this.size / 6, screenY - this.size / 6, this.size / 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    checkCollection(player) {
        if (this.collected) return;
        
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < (player.width / 2 + this.size / 2)) {
            this.collected = true;
            if (this.type === 'heart') {
                player.heal(1);
            }
        }
    }
}

// Enemy class
class Enemy {
    constructor(x, y, type = 'blue') {
        this.x = x;
        this.y = y;
        this.type = type; // 'blue', 'red', 'white', 'boss'
        this.isBoss = type === 'boss';
        this.size = this.isBoss ? BOSS_SIZE : ENEMY_SIZE;
        
        // Set health based on type
        if (this.isBoss) {
            this.health = 50;
            this.speed = 1;
        } else if (type === 'blue') {
            this.health = 2;
            this.speed = 1.5;
        } else if (type === 'red') {
            this.health = 4;
            this.speed = 1.3;
        } else if (type === 'white') {
            this.health = 6;
            this.speed = 1.1;
        }
        
        this.maxHealth = this.health;
        this.damage = 0.5; // Half a heart
        this.alive = true;
        this.vx = 0;
        this.vy = 0;
        this.changeDirectionTimer = 0;
    }

    update(player) {
        if (!this.alive) return;

        // Simple AI: move towards player when close
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 200) {
            this.vx = (dx / distance) * this.speed;
            this.vy = (dy / distance) * this.speed;
        } else {
            // Random movement
            this.changeDirectionTimer--;
            if (this.changeDirectionTimer <= 0) {
                this.vx = (Math.random() - 0.5) * this.speed * 2;
                this.vy = (Math.random() - 0.5) * this.speed * 2;
                this.changeDirectionTimer = 60;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        // Keep in bounds
        this.x = Math.max(this.size / 2, Math.min(WORLD_WIDTH - this.size / 2, this.x));
        this.y = Math.max(this.size / 2, Math.min(WORLD_HEIGHT - this.size / 2, this.y));

        // Check collision with player
        const playerDx = player.x - this.x;
        const playerDy = player.y - this.y;
        const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);
        
        if (playerDistance < (player.width / 2 + this.size / 2)) {
            player.takeDamage(this.damage);
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.alive = false;
            game.score += this.isBoss ? 1000 : 100;
            updateScore();
            
            if (this.isBoss) {
                gameOver(true);
            }
        }
    }

    draw(ctx) {
        if (!this.alive) return;
        
        const screenX = this.x - game.camera.x;
        const screenY = this.y - game.camera.y;
        
        if (this.isBoss) {
            this.drawOgre(ctx, screenX, screenY);
        } else {
            this.drawGoblin(ctx, screenX, screenY);
        }
        
        // Health bar
        if (this.health < this.maxHealth) {
            const barWidth = this.size;
            const barHeight = 4;
            ctx.fillStyle = '#000';
            ctx.fillRect(screenX - barWidth / 2, screenY - this.size / 2 - 10, barWidth, barHeight);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(screenX - barWidth / 2, screenY - this.size / 2 - 10, barWidth * (this.health / this.maxHealth), barHeight);
        }
    }

    drawGoblin(ctx, screenX, screenY) {
        const s = this.size;
        
        // Body color based on type
        let bodyColor;
        if (this.type === 'blue') bodyColor = '#4169e1';
        else if (this.type === 'red') bodyColor = '#dc143c';
        else if (this.type === 'white') bodyColor = '#e0e0e0';
        
        // Body
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX - s / 3, screenY - s / 6, s * 2 / 3, s * 2 / 3);
        
        // Head
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(screenX, screenY - s / 3, s / 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Ears
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(screenX - s / 3, screenY - s / 3);
        ctx.lineTo(screenX - s / 2, screenY - s / 2);
        ctx.lineTo(screenX - s / 4, screenY - s / 2.5);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(screenX + s / 3, screenY - s / 3);
        ctx.lineTo(screenX + s / 2, screenY - s / 2);
        ctx.lineTo(screenX + s / 4, screenY - s / 2.5);
        ctx.closePath();
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(screenX - s / 6, screenY - s / 3, s / 8, s / 8);
        ctx.fillRect(screenX + s / 16, screenY - s / 3, s / 8, s / 8);
        
        // Pupils
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX - s / 8, screenY - s / 3.5, s / 16, s / 12);
        ctx.fillRect(screenX + s / 12, screenY - s / 3.5, s / 16, s / 12);
        
        // Mouth
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX - s / 8, screenY - s / 6, s / 4, s / 16);
        
        // Arms
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX - s / 2, screenY, s / 6, s / 3);
        ctx.fillRect(screenX + s / 3, screenY, s / 6, s / 3);
        
        // Legs
        ctx.fillRect(screenX - s / 6, screenY + s / 3, s / 8, s / 4);
        ctx.fillRect(screenX + s / 16, screenY + s / 3, s / 8, s / 4);
    }

    drawOgre(ctx, screenX, screenY) {
        const s = this.size;
        
        // Body
        ctx.fillStyle = '#556b2f';
        ctx.fillRect(screenX - s / 2.5, screenY - s / 4, s * 4 / 5, s * 3 / 4);
        
        // Head
        ctx.fillStyle = '#6b8e23';
        ctx.beginPath();
        ctx.arc(screenX, screenY - s / 2.5, s / 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Horns
        ctx.fillStyle = '#4a4a4a';
        ctx.beginPath();
        ctx.moveTo(screenX - s / 3, screenY - s / 2);
        ctx.lineTo(screenX - s / 2.5, screenY - s / 1.5);
        ctx.lineTo(screenX - s / 4, screenY - s / 2.2);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(screenX + s / 3, screenY - s / 2);
        ctx.lineTo(screenX + s / 2.5, screenY - s / 1.5);
        ctx.lineTo(screenX + s / 4, screenY - s / 2.2);
        ctx.closePath();
        ctx.fill();
        
        // Eyes (angry)
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(screenX - s / 6, screenY - s / 2.5, s / 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(screenX + s / 6, screenY - s / 2.5, s / 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX - s / 6, screenY - s / 2.5, s / 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(screenX + s / 6, screenY - s / 2.5, s / 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Mouth (angry)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX, screenY - s / 4, s / 6, 0, Math.PI);
        ctx.fill();
        
        // Tusks
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(screenX - s / 8, screenY - s / 4);
        ctx.lineTo(screenX - s / 10, screenY - s / 8);
        ctx.lineTo(screenX - s / 12, screenY - s / 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(screenX + s / 8, screenY - s / 4);
        ctx.lineTo(screenX + s / 10, screenY - s / 8);
        ctx.lineTo(screenX + s / 12, screenY - s / 4);
        ctx.closePath();
        ctx.fill();
        
        // Arms (thick)
        ctx.fillStyle = '#556b2f';
        ctx.fillRect(screenX - s / 1.8, screenY - s / 8, s / 5, s / 2);
        ctx.fillRect(screenX + s / 2.2, screenY - s / 8, s / 5, s / 2);
        
        // Legs
        ctx.fillRect(screenX - s / 4, screenY + s / 3, s / 6, s / 3);
        ctx.fillRect(screenX + s / 12, screenY + s / 3, s / 6, s / 3);
    }
}

// Initialize game
function init() {
    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');
    game.canvas.width = CANVAS_WIDTH;
    game.canvas.height = CANVAS_HEIGHT;

    // Create player at bottom center
    game.player = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT - 100);

    // Create obstacles (boundaries)
    createObstacles();

    // Create collectibles
    createCollectibles();

    // Create enemies
    createEnemies();

    // Create boss at top
    game.boss = new Enemy(WORLD_WIDTH / 2, 150, 'boss');
    game.enemies.push(game.boss);

    // Initialize hearts display
    updateHearts();
    updateScore();

    // Event listeners
    document.addEventListener('keydown', (e) => {
        game.keys[e.key] = true;
        if (e.key === ' ') {
            e.preventDefault();
            attack();
        }
    });

    document.addEventListener('keyup', (e) => {
        game.keys[e.key] = false;
    });

    document.getElementById('restart-btn').addEventListener('click', restart);

    // Start game loop
    gameLoop();
}

function createObstacles() {
    // Left and right walls
    for (let y = 0; y < WORLD_HEIGHT; y += 60) {
        game.obstacles.push(new Obstacle(0, y, 40, 50, 'tree'));
        game.obstacles.push(new Obstacle(WORLD_WIDTH - 40, y, 40, 50, 'tree'));
    }

    // Top and bottom walls
    for (let x = 40; x < WORLD_WIDTH - 40; x += 60) {
        game.obstacles.push(new Obstacle(x, 0, 50, 40, 'mountain'));
        game.obstacles.push(new Obstacle(x, WORLD_HEIGHT - 40, 50, 40, 'mountain'));
    }

    // Random obstacles throughout
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * (WORLD_WIDTH - 200) + 100;
        const y = Math.random() * (WORLD_HEIGHT - 400) + 200;
        const type = Math.random() > 0.5 ? 'tree' : 'mountain';
        game.obstacles.push(new Obstacle(x, y, 40, 40, type));
    }
}

function createCollectibles() {
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * (WORLD_WIDTH - 200) + 100;
        const y = Math.random() * (WORLD_HEIGHT - 400) + 200;
        game.collectibles.push(new Collectible(x, y, 'heart'));
    }
}

function createEnemies() {
    // Create mix of goblin types
    const types = ['blue', 'blue', 'blue', 'red', 'red', 'red', 'white', 'white'];
    
    for (let i = 0; i < types.length; i++) {
        const x = Math.random() * (WORLD_WIDTH - 200) + 100;
        const y = Math.random() * (WORLD_HEIGHT - 800) + 400;
        game.enemies.push(new Enemy(x, y, types[i]));
    }
}

function attack() {
    if (game.gameOver || game.player.attacking) return;
    
    // Start attack animation
    game.player.attacking = true;
    game.player.attackTime = 0;
    
    // Damage enemies in front of player based on facing direction
    const attackRange = 45;
    const attackArc = Math.PI / 3; // 60 degree arc
    
    for (let enemy of game.enemies) {
        if (!enemy.alive) continue;
        
        const dx = enemy.x - game.player.x;
        const dy = enemy.y - game.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < attackRange) {
            // Check if enemy is in the direction player is facing
            let angleToEnemy = Math.atan2(dy, dx);
            let facingAngle = 0;
            
            switch (game.player.facingDirection) {
                case 'right':
                    facingAngle = 0;
                    break;
                case 'down':
                    facingAngle = Math.PI / 2;
                    break;
                case 'left':
                    facingAngle = Math.PI;
                    break;
                case 'up':
                    facingAngle = -Math.PI / 2;
                    break;
            }
            
            let angleDiff = Math.abs(angleToEnemy - facingAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            
            if (angleDiff < attackArc) {
                enemy.takeDamage(game.player.swordDamage);
            }
        }
    }
}

function updateCamera() {
    // Center camera on player
    game.camera.x = game.player.x - CANVAS_WIDTH / 2;
    game.camera.y = game.player.y - CANVAS_HEIGHT / 2;

    // Keep camera in bounds
    game.camera.x = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, game.camera.x));
    game.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, game.camera.y));
}

function updateHearts() {
    const heartsContainer = document.getElementById('hearts');
    heartsContainer.innerHTML = '';
    
    for (let i = 0; i < game.player.maxHealth; i++) {
        const heart = document.createElement('div');
        heart.className = i < game.player.health ? 'heart' : 'heart empty';
        heartsContainer.appendChild(heart);
    }
}

function updateScore() {
    document.getElementById('score').textContent = `Score: ${game.score}`;
}

function gameOver(won) {
    game.gameOver = true;
    game.won = won;
    
    const gameOverDiv = document.getElementById('game-over');
    const gameOverText = document.getElementById('game-over-text');
    
    gameOverText.textContent = won ? 'Victory!' : 'Game Over';
    gameOverDiv.classList.remove('hidden');
}

function restart() {
    // Reset game state
    game.score = 0;
    game.gameOver = false;
    game.won = false;
    game.obstacles = [];
    game.collectibles = [];
    game.enemies = [];
    game.boss = null;
    
    document.getElementById('game-over').classList.add('hidden');
    
    // Reinitialize
    game.player = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT - 100);
    createObstacles();
    createCollectibles();
    createEnemies();
    game.boss = new Enemy(WORLD_WIDTH / 2, 150, 'boss');
    game.enemies.push(game.boss);
    
    updateHearts();
    updateScore();
}

function gameLoop() {
    if (!game.gameOver) {
        // Update
        game.player.update();
        
        for (let enemy of game.enemies) {
            enemy.update(game.player);
        }
        
        for (let collectible of game.collectibles) {
            collectible.checkCollection(game.player);
        }
        
        updateCamera();
    }

    // Draw
    game.ctx.fillStyle = '#2d5016';
    game.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw game objects
    for (let obstacle of game.obstacles) {
        obstacle.draw(game.ctx);
    }
    
    for (let collectible of game.collectibles) {
        collectible.draw(game.ctx);
    }
    
    for (let enemy of game.enemies) {
        enemy.draw(game.ctx);
    }
    
    game.player.draw(game.ctx);

    requestAnimationFrame(gameLoop);
}

// Start game when page loads
window.addEventListener('load', init);
