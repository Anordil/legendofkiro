// Game constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;
const WORLD_WIDTH = 1200; // 2 screens wide
const WORLD_HEIGHT = 4800; // 8 screens tall
const PLAYER_SIZE = 45; // 50% bigger (was 30)
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
    gameStarted: false,
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
        this.image.src = 'kirolink.png';
        this.spriteLoaded = false;
        this.image.onload = () => {
            this.spriteLoaded = true;
            this.spriteWidth = this.image.width / 2;
            this.spriteHeight = this.image.height / 2;
        };
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.attacking = false;
        this.attackTime = 0;
        this.attackDuration = 15; // frames
        this.facingDirection = 'up'; // up, down, left, right
        
        // Weapon system
        this.weapon = 'sword'; // 'sword', 'bow', 'twohanded'
        this.weaponDamage = 2;
        this.weaponRange = 45;
        this.attackCooldown = 15; // frames between attacks (4 attacks per second at 60fps)
        this.lastAttackTime = 0;
        this.arrows = [];
        
        // Potion effects
        this.activePotion = null; // 'red', 'green', 'yellow', 'blue'
        this.potionTimer = 0;
        this.potionDuration = 300; // 5 seconds at 60fps
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

        // Update attack cooldown
        if (this.lastAttackTime > 0) {
            this.lastAttackTime--;
        }

        // Update potion effects
        if (this.activePotion) {
            this.potionTimer--;
            if (this.potionTimer <= 0) {
                this.activePotion = null;
                this.updateWeaponStats();
            }
        }

        // Update arrows
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const arrow = this.arrows[i];
            arrow.x += arrow.vx;
            arrow.y += arrow.vy;
            arrow.distance += Math.sqrt(arrow.vx * arrow.vx + arrow.vy * arrow.vy);
            
            // Remove arrows that are out of bounds or traveled too far
            if (arrow.distance > 300 || arrow.x < 0 || arrow.x > WORLD_WIDTH || arrow.y < 0 || arrow.y > WORLD_HEIGHT) {
                this.arrows.splice(i, 1);
            }
        }

        // Get current speed (affected by yellow potion)
        const currentSpeed = this.activePotion === 'yellow' ? PLAYER_SPEED * 2 : PLAYER_SPEED;

        // Movement with no diagonal
        let moving = false;
        
        if (game.keys['ArrowUp'] || game.keys['w']) {
            this.vy = -currentSpeed;
            this.facingDirection = 'up';
            moving = true;
        } else if (game.keys['ArrowDown'] || game.keys['s']) {
            this.vy = currentSpeed;
            this.facingDirection = 'down';
            moving = true;
        } else {
            this.vy = 0;
        }

        if (!moving) {
            if (game.keys['ArrowLeft'] || game.keys['a']) {
                this.vx = -currentSpeed;
                this.facingDirection = 'left';
            } else if (game.keys['ArrowRight'] || game.keys['d']) {
                this.vx = currentSpeed;
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

        // Check collision with enemies and push back
        for (let enemy of game.enemies) {
            if (!enemy.alive) continue;
            
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = (this.width / 2 + enemy.size / 2);
            
            if (distance < minDistance && distance > 0) {
                // Push player away from enemy
                const pushX = (dx / distance) * (minDistance - distance);
                const pushY = (dy / distance) * (minDistance - distance);
                
                const newX = this.x - pushX / 2;
                const newY = this.y - pushY / 2;
                
                // Only push if it doesn't cause collision with obstacles
                if (!this.checkCollision(newX, this.y)) {
                    this.x = newX;
                }
                if (!this.checkCollision(this.x, newY)) {
                    this.y = newY;
                }
            }
        }

        // Final bounds check and obstacle escape
        this.x = Math.max(this.width / 2, Math.min(WORLD_WIDTH - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(WORLD_HEIGHT - this.height / 2, this.y));
        
        // If somehow stuck in obstacle, try to push out
        if (this.checkCollision(this.x, this.y)) {
            // Try moving in each direction to escape
            const escapeDistance = 5;
            const directions = [
                {x: escapeDistance, y: 0},
                {x: -escapeDistance, y: 0},
                {x: 0, y: escapeDistance},
                {x: 0, y: -escapeDistance},
                {x: escapeDistance, y: escapeDistance},
                {x: -escapeDistance, y: escapeDistance},
                {x: escapeDistance, y: -escapeDistance},
                {x: -escapeDistance, y: -escapeDistance}
            ];
            
            for (let dir of directions) {
                const testX = this.x + dir.x;
                const testY = this.y + dir.y;
                if (!this.checkCollision(testX, testY)) {
                    this.x = testX;
                    this.y = testY;
                    break;
                }
            }
        }

        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerableTime--;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }
    }

    updateWeaponStats() {
        // Base weapon stats
        if (this.weapon === 'sword') {
            this.weaponDamage = 2;
            this.weaponRange = 45;
            this.attackCooldown = 15; // 4 attacks per second
        } else if (this.weapon === 'bow') {
            this.weaponDamage = 1;
            this.weaponRange = 300;
            this.attackCooldown = 15; // 4 arrows per second
        } else if (this.weapon === 'battleaxe') {
            this.weaponDamage = 6;
            this.weaponRange = 60;
            this.attackCooldown = 30; // 2 attacks per second
        }

        // Apply potion effects
        if (this.activePotion === 'red') {
            this.weaponDamage *= 2;
        } else if (this.activePotion === 'green') {
            this.attackCooldown = Math.floor(this.attackCooldown / 2);
        }
    }

    equipWeapon(weaponType) {
        this.weapon = weaponType;
        this.updateWeaponStats();
    }

    drinkPotion(potionType) {
        this.activePotion = potionType;
        this.potionTimer = this.potionDuration;
        
        // Blue potion gives invulnerability
        if (potionType === 'blue') {
            this.invulnerable = true;
            this.invulnerableTime = this.potionDuration;
        }
        
        this.updateWeaponStats();
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
        // Blue potion makes you immune to damage
        if (this.activePotion === 'blue') return;
        
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

    addHeartContainer() {
        this.maxHealth += 1;
        this.health = this.maxHealth; // Fully heal when getting container
        updateHearts();
    }

    draw(ctx) {
        const screenX = this.x - game.camera.x;
        const screenY = this.y - game.camera.y;
        
        // Draw potion aura
        if (this.activePotion) {
            this.drawAura(ctx, screenX, screenY);
        }
        
        // Flash when invulnerable
        if (!this.invulnerable || Math.floor(this.invulnerableTime / 5) % 2 === 0) {
            if (this.spriteLoaded) {
                // Determine which sprite to use based on facing direction
                let sx = 0, sy = 0;
                
                switch (this.facingDirection) {
                    case 'up':
                        sx = this.spriteWidth;
                        sy = 0;
                        break;
                    case 'down':
                        sx = 0;
                        sy = 0;
                        break;
                    case 'right':
                        sx = 0;
                        sy = this.spriteHeight;
                        break;
                    case 'left':
                        sx = this.spriteWidth;
                        sy = this.spriteHeight;
                        break;
                }
                
                ctx.drawImage(
                    this.image,
                    sx, sy, this.spriteWidth, this.spriteHeight,
                    screenX - this.width / 2,
                    screenY - this.height / 2,
                    this.width,
                    this.height
                );
            }
        }

        // Draw weapon
        if (this.weapon === 'bow') {
            this.drawBow(ctx, screenX, screenY);
        } else if (this.weapon === 'battleaxe') {
            this.drawBattleAxe(ctx, screenX, screenY);
        } else {
            this.drawSword(ctx, screenX, screenY);
        }

        // Draw arrows
        for (let arrow of this.arrows) {
            const arrowScreenX = arrow.x - game.camera.x;
            const arrowScreenY = arrow.y - game.camera.y;
            
            ctx.save();
            ctx.translate(arrowScreenX, arrowScreenY);
            ctx.rotate(Math.atan2(arrow.vy, arrow.vx));
            
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(-8, -2, 8, 4);
            ctx.fillStyle = '#c0c0c0';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(5, -3);
            ctx.lineTo(5, 3);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
    }

    drawAura(ctx, screenX, screenY) {
        let auraColor;
        if (this.activePotion === 'red') auraColor = 'rgba(255, 0, 0, 0.3)';
        else if (this.activePotion === 'green') auraColor = 'rgba(0, 255, 0, 0.3)';
        else if (this.activePotion === 'yellow') auraColor = 'rgba(255, 255, 0, 0.3)';
        else if (this.activePotion === 'blue') auraColor = 'rgba(0, 100, 255, 0.3)';
        
        const pulseSize = 5 + Math.sin(Date.now() / 100) * 3;
        
        ctx.fillStyle = auraColor;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.width / 2 + pulseSize, 0, Math.PI * 2);
        ctx.fill();
    }

    drawBow(ctx, screenX, screenY) {
        ctx.save();
        ctx.translate(screenX, screenY);

        let angle = 0;
        let offsetX = 0, offsetY = 0;
        
        switch (this.facingDirection) {
            case 'up': 
                angle = -Math.PI / 2; 
                offsetY = -5;
                break;
            case 'down': 
                angle = Math.PI / 2; 
                offsetY = 5;
                break;
            case 'left': 
                angle = Math.PI; 
                offsetX = -5;
                break;
            case 'right': 
                angle = 0; 
                offsetX = 5;
                break;
        }
        
        ctx.translate(offsetX, offsetY);
        ctx.rotate(angle);

        // Bow
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.width / 2 + 10, 0, 12, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        // String (pulled back when attacking)
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (this.attacking) {
            const pullBack = 5;
            ctx.moveTo(this.width / 2 + 10 - pullBack, -12);
            ctx.lineTo(this.width / 2 + 5, 0);
            ctx.lineTo(this.width / 2 + 10 - pullBack, 12);
        } else {
            ctx.moveTo(this.width / 2 + 10, -12);
            ctx.lineTo(this.width / 2 + 10, 12);
        }
        ctx.stroke();

        ctx.restore();
    }

    drawSword(ctx, screenX, screenY) {
        const progress = this.attacking ? this.attackTime / this.attackDuration : 0;
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

        // Apply swing animation when attacking, otherwise show at rest
        const currentAngle = this.attacking 
            ? baseAngle + (swingAngle - Math.PI / 2) * 0.8
            : baseAngle - Math.PI / 4; // Resting position
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

    drawBattleAxe(ctx, screenX, screenY) {
        const progress = this.attacking ? this.attackTime / this.attackDuration : 0;
        const swingAngle = progress * Math.PI; // 0 to 180 degrees

        ctx.save();
        ctx.translate(screenX, screenY);

        // Rotate based on facing direction
        let baseAngle = 0;

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

        // Apply swing animation when attacking, otherwise show at rest
        const currentAngle = this.attacking 
            ? baseAngle + (swingAngle - Math.PI / 2) * 1.2
            : baseAngle - Math.PI / 6; // Resting position
        ctx.rotate(currentAngle);

        const handleLength = 30;
        const handleWidth = 5;
        const axeHeadWidth = 20;
        const axeHeadHeight = 18;

        // Draw handle
        ctx.fillStyle = '#654321';
        ctx.fillRect(this.width / 2, -handleWidth / 2, handleLength, handleWidth);

        // Draw axe head (double-bladed)
        ctx.fillStyle = '#808080';
        
        // Top blade
        ctx.beginPath();
        ctx.moveTo(this.width / 2 + handleLength - 5, -handleWidth / 2);
        ctx.lineTo(this.width / 2 + handleLength + 5, -axeHeadHeight);
        ctx.lineTo(this.width / 2 + handleLength + axeHeadWidth, -axeHeadHeight / 2);
        ctx.lineTo(this.width / 2 + handleLength + 5, -handleWidth / 2);
        ctx.closePath();
        ctx.fill();

        // Bottom blade
        ctx.beginPath();
        ctx.moveTo(this.width / 2 + handleLength - 5, handleWidth / 2);
        ctx.lineTo(this.width / 2 + handleLength + 5, axeHeadHeight);
        ctx.lineTo(this.width / 2 + handleLength + axeHeadWidth, axeHeadHeight / 2);
        ctx.lineTo(this.width / 2 + handleLength + 5, handleWidth / 2);
        ctx.closePath();
        ctx.fill();

        // Blade edges (darker)
        ctx.strokeStyle = '#505050';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.width / 2 + handleLength + 5, -axeHeadHeight);
        ctx.lineTo(this.width / 2 + handleLength + axeHeadWidth, -axeHeadHeight / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.width / 2 + handleLength + 5, axeHeadHeight);
        ctx.lineTo(this.width / 2 + handleLength + axeHeadWidth, axeHeadHeight / 2);
        ctx.stroke();

        // Handle grip
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(this.width / 2 + 5, -handleWidth / 2 - 1, 3, handleWidth + 2);
        ctx.fillRect(this.width / 2 + 15, -handleWidth / 2 - 1, 3, handleWidth + 2);

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
        this.type = type; // 'heart', 'bow', 'twohanded', 'red_potion', 'green_potion', 'yellow_potion', 'blue_potion'
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
        } else if (this.type === 'heart_container') {
            // Blue rim
            ctx.fillStyle = '#0066ff';
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-this.size / 4 - 2, -this.size / 4 - 2, this.size / 2 + 4, this.size / 2 + 4);
            ctx.restore();
            
            ctx.beginPath();
            ctx.arc(screenX - this.size / 6, screenY - this.size / 6, this.size / 3 + 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + this.size / 6, screenY - this.size / 6, this.size / 3 + 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Red heart inside
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
        } else if (this.type === 'coin_pouch') {
            // Leather pouch
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, this.size / 2, this.size / 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Pouch opening/tie
            ctx.fillStyle = '#654321';
            ctx.fillRect(screenX - this.size / 6, screenY - this.size / 2, this.size / 3, this.size / 8);
            
            // Spilling gold coins
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(screenX + this.size / 3, screenY - this.size / 6, this.size / 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(screenX + this.size / 2, screenY + this.size / 8, this.size / 7, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(screenX + this.size / 4, screenY + this.size / 4, this.size / 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Coin details (shine)
            ctx.fillStyle = '#ffed4e';
            ctx.beginPath();
            ctx.arc(screenX + this.size / 3 - 2, screenY - this.size / 6 - 1, this.size / 12, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'bow') {
            // Draw bow weapon
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.size / 2, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - this.size / 2);
            ctx.lineTo(screenX, screenY + this.size / 2);
            ctx.stroke();
        } else if (this.type === 'battleaxe') {
            // Draw battle axe
            // Handle
            ctx.fillStyle = '#654321';
            ctx.fillRect(screenX - 2, screenY - this.size / 2, 4, this.size);
            
            // Axe head
            ctx.fillStyle = '#808080';
            ctx.beginPath();
            ctx.moveTo(screenX - 2, screenY - this.size / 3);
            ctx.lineTo(screenX - this.size / 3, screenY - this.size / 2);
            ctx.lineTo(screenX + this.size / 3, screenY - this.size / 2);
            ctx.lineTo(screenX + 2, screenY - this.size / 3);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(screenX - 2, screenY - this.size / 3 + 5);
            ctx.lineTo(screenX - this.size / 3, screenY - this.size / 2 + 10);
            ctx.lineTo(screenX + this.size / 3, screenY - this.size / 2 + 10);
            ctx.lineTo(screenX + 2, screenY - this.size / 3 + 5);
            ctx.closePath();
            ctx.fill();
            
            // Handle grips
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(screenX - 3, screenY, 6, 2);
            ctx.fillRect(screenX - 3, screenY + this.size / 4, 6, 2);
        } else if (this.type.includes('potion')) {
            this.drawPotion(ctx, screenX, screenY);
        }
    }

    drawPotion(ctx, screenX, screenY) {
        let color;
        if (this.type === 'red_potion') color = '#ff0000';
        else if (this.type === 'green_potion') color = '#00ff00';
        else if (this.type === 'yellow_potion') color = '#ffff00';
        else if (this.type === 'blue_potion') color = '#0066ff';
        
        // Bottle body
        ctx.fillStyle = color;
        ctx.fillRect(screenX - this.size / 4, screenY - this.size / 4, this.size / 2, this.size / 2);
        
        // Bottle neck
        ctx.fillStyle = color;
        ctx.fillRect(screenX - this.size / 6, screenY - this.size / 2, this.size / 3, this.size / 4);
        
        // Cork
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(screenX - this.size / 8, screenY - this.size / 1.8, this.size / 4, this.size / 8);
        
        // Shine effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(screenX - this.size / 6, screenY - this.size / 6, this.size / 8, this.size / 4);
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
            } else if (this.type === 'heart_container') {
                player.addHeartContainer();
            } else if (this.type === 'coin_pouch') {
                game.score += 500;
                updateScore();
            } else if (this.type === 'bow') {
                player.equipWeapon('bow');
            } else if (this.type === 'battleaxe') {
                player.equipWeapon('battleaxe');
            } else if (this.type === 'red_potion') {
                player.drinkPotion('red');
            } else if (this.type === 'green_potion') {
                player.drinkPotion('green');
            } else if (this.type === 'yellow_potion') {
                player.drinkPotion('yellow');
            } else if (this.type === 'blue_potion') {
                player.drinkPotion('blue');
            }
        }
    }
}

// Enemy class
class Enemy {
    constructor(x, y, type = 'blue') {
        this.x = x;
        this.y = y;
        this.type = type; // 'blue', 'red', 'white', 'blue_kobold', 'red_kobold', 'white_kobold', 'boss'
        this.isBoss = type === 'boss';
        this.isKobold = type.includes('kobold');
        this.size = this.isBoss ? BOSS_SIZE : ENEMY_SIZE;
        
        // Set health based on type
        if (this.isBoss) {
            this.health = 50;
            this.speed = 1;
        } else if (type === 'blue' || type === 'blue_kobold') {
            this.health = 2;
            this.speed = this.isKobold ? 0.75 : 1.5; // Kobolds move at half speed
        } else if (type === 'red' || type === 'red_kobold') {
            this.health = 4;
            this.speed = this.isKobold ? 0.65 : 1.3;
        } else if (type === 'white' || type === 'white_kobold') {
            this.health = 6;
            this.speed = this.isKobold ? 0.55 : 1.1;
        }
        
        this.maxHealth = this.health;
        this.damage = 0.5; // Half a heart
        this.alive = true;
        this.vx = 0;
        this.vy = 0;
        this.changeDirectionTimer = 0;
        this.attacking = false;
        this.attackTime = 0;
        this.attackDuration = 20;
        this.attackCooldown = this.isKobold ? 90 : 60; // Kobolds shoot every 1.5 seconds
        this.lastAttackTime = 0;
        this.bolts = []; // Crossbow bolts for kobolds
    }

    update(player) {
        if (!this.alive) return;

        // Update attack animation
        if (this.attacking) {
            this.attackTime++;
            if (this.attackTime >= this.attackDuration) {
                this.attacking = false;
                this.attackTime = 0;
            }
        }

        // Update attack cooldown
        if (this.lastAttackTime > 0) {
            this.lastAttackTime--;
        }

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

        // Collision with other enemies
        for (let other of game.enemies) {
            if (other === this || !other.alive) continue;
            
            const odx = other.x - this.x;
            const ody = other.y - this.y;
            const odist = Math.sqrt(odx * odx + ody * ody);
            const minDist = (this.size / 2 + other.size / 2);
            
            if (odist < minDist && odist > 0) {
                // Push enemies apart
                const pushX = (odx / odist) * (minDist - odist);
                const pushY = (ody / odist) * (minDist - odist);
                
                this.x -= pushX / 2;
                this.y -= pushY / 2;
                other.x += pushX / 2;
                other.y += pushY / 2;
            }
        }

        // Update bolts for kobolds
        if (this.isKobold) {
            for (let i = this.bolts.length - 1; i >= 0; i--) {
                const bolt = this.bolts[i];
                bolt.x += bolt.vx;
                bolt.y += bolt.vy;
                bolt.distance += Math.sqrt(bolt.vx * bolt.vx + bolt.vy * bolt.vy);
                
                // Check collision with player
                const boltDx = player.x - bolt.x;
                const boltDy = player.y - bolt.y;
                const boltDist = Math.sqrt(boltDx * boltDx + boltDy * boltDy);
                
                if (boltDist < player.width / 2) {
                    player.takeDamage(this.damage);
                    this.bolts.splice(i, 1);
                    continue;
                }
                
                // Remove bolts that traveled too far or out of bounds
                if (bolt.distance > 400 || bolt.x < 0 || bolt.x > WORLD_WIDTH || bolt.y < 0 || bolt.y > WORLD_HEIGHT) {
                    this.bolts.splice(i, 1);
                }
            }
        }

        // Check collision with player and attack
        const playerDx = player.x - this.x;
        const playerDy = player.y - this.y;
        const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);
        const minDistance = (player.width / 2 + this.size / 2);
        
        if (this.isKobold) {
            // Kobolds shoot from range
            if (playerDistance < 250 && playerDistance > 80 && this.lastAttackTime === 0) {
                this.attacking = true;
                this.attackTime = 0;
                this.lastAttackTime = this.attackCooldown;
                
                // Shoot crossbow bolt
                const boltSpeed = 5;
                const angle = Math.atan2(playerDy, playerDx);
                this.bolts.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle) * boltSpeed,
                    vy: Math.sin(angle) * boltSpeed,
                    distance: 0
                });
            }
        } else {
            // Melee enemies attack on contact
            if (playerDistance < minDistance) {
                // Push enemy away from player
                const pushX = (playerDx / playerDistance) * (minDistance - playerDistance);
                const pushY = (playerDy / playerDistance) * (minDistance - playerDistance);
                
                this.x -= pushX / 2;
                this.y -= pushY / 2;
                
                // Attack player if cooldown is ready
                if (this.lastAttackTime === 0) {
                    this.attacking = true;
                    this.attackTime = 0;
                    this.lastAttackTime = this.attackCooldown;
                    player.takeDamage(this.damage);
                }
            }
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
            this.drawBossClub(ctx, screenX, screenY);
        } else if (this.isKobold) {
            this.drawKobold(ctx, screenX, screenY);
            this.drawCrossbow(ctx, screenX, screenY);
        } else {
            this.drawGoblin(ctx, screenX, screenY);
            this.drawClub(ctx, screenX, screenY);
        }
        
        // Draw crossbow bolts
        if (this.isKobold) {
            for (let bolt of this.bolts) {
                const boltScreenX = bolt.x - game.camera.x;
                const boltScreenY = bolt.y - game.camera.y;
                
                ctx.save();
                ctx.translate(boltScreenX, boltScreenY);
                ctx.rotate(Math.atan2(bolt.vy, bolt.vx));
                
                ctx.fillStyle = '#654321';
                ctx.fillRect(-6, -1, 6, 2);
                ctx.fillStyle = '#808080';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(4, -2);
                ctx.lineTo(4, 2);
                ctx.closePath();
                ctx.fill();
                
                ctx.restore();
            }
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

    drawClub(ctx, screenX, screenY) {
        if (!this.attacking) return;

        const progress = this.attackTime / this.attackDuration;
        const swingAngle = progress * Math.PI;

        ctx.save();
        ctx.translate(screenX, screenY);

        // Determine direction to player
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const baseAngle = Math.atan2(dy, dx);

        const currentAngle = baseAngle + (swingAngle - Math.PI / 2) * 0.8;
        ctx.rotate(currentAngle);

        const clubLength = 18;
        const clubWidth = 5;

        // Club handle
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(this.size / 2, -clubWidth / 2, clubLength - 6, clubWidth);

        // Club head
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.arc(this.size / 2 + clubLength - 3, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawBossClub(ctx, screenX, screenY) {
        if (!this.attacking) return;

        const progress = this.attackTime / this.attackDuration;
        const swingAngle = progress * Math.PI;

        ctx.save();
        ctx.translate(screenX, screenY);

        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const baseAngle = Math.atan2(dy, dx);

        const currentAngle = baseAngle + (swingAngle - Math.PI / 2) * 0.8;
        ctx.rotate(currentAngle);

        const clubLength = 35;
        const clubWidth = 10;

        // Club handle
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(this.size / 2, -clubWidth / 2, clubLength - 10, clubWidth);

        // Club head (bigger)
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.arc(this.size / 2 + clubLength - 5, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
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

    drawKobold(ctx, screenX, screenY) {
        const s = this.size;
        
        // Body color based on type
        let bodyColor;
        if (this.type === 'blue_kobold') bodyColor = '#6495ed';
        else if (this.type === 'red_kobold') bodyColor = '#ff6347';
        else if (this.type === 'white_kobold') bodyColor = '#f5f5f5';
        
        // Body (more reptilian/scaly)
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX - s / 3, screenY - s / 8, s * 2 / 3, s * 3 / 4);
        
        // Head (more elongated/reptilian)
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY - s / 3, s / 3, s / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Snout
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(screenX + s / 6, screenY - s / 3, s / 6, s / 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Horns (small)
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.moveTo(screenX - s / 4, screenY - s / 2.5);
        ctx.lineTo(screenX - s / 3, screenY - s / 1.8);
        ctx.lineTo(screenX - s / 5, screenY - s / 2.3);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(screenX + s / 4, screenY - s / 2.5);
        ctx.lineTo(screenX + s / 3, screenY - s / 1.8);
        ctx.lineTo(screenX + s / 5, screenY - s / 2.3);
        ctx.closePath();
        ctx.fill();
        
        // Eyes (reptilian slits)
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.ellipse(screenX - s / 8, screenY - s / 3, s / 12, s / 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(screenX + s / 16, screenY - s / 3, s / 12, s / 16, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils (vertical slits)
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX - s / 8 - 1, screenY - s / 3 - s / 20, 2, s / 10);
        ctx.fillRect(screenX + s / 16 - 1, screenY - s / 3 - s / 20, 2, s / 10);
        
        // Tail
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY + s / 2);
        ctx.quadraticCurveTo(screenX - s / 3, screenY + s / 1.5, screenX - s / 2, screenY + s / 1.2);
        ctx.stroke();
        
        // Arms
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX - s / 2, screenY, s / 6, s / 3);
        ctx.fillRect(screenX + s / 3, screenY, s / 6, s / 3);
        
        // Legs
        ctx.fillRect(screenX - s / 6, screenY + s / 3, s / 8, s / 4);
        ctx.fillRect(screenX + s / 16, screenY + s / 3, s / 8, s / 4);
    }

    drawCrossbow(ctx, screenX, screenY) {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(angle);

        // Crossbow body
        ctx.fillStyle = '#654321';
        ctx.fillRect(this.size / 2, -2, 12, 4);

        // Bow arms
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.size / 2 + 12, -8);
        ctx.lineTo(this.size / 2 + 12, 8);
        ctx.stroke();

        // String
        if (this.attacking) {
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.size / 2 + 8, 0);
            ctx.lineTo(this.size / 2 + 12, -8);
            ctx.lineTo(this.size / 2 + 12, 8);
            ctx.lineTo(this.size / 2 + 8, 0);
            ctx.stroke();
        } else {
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.size / 2 + 12, -8);
            ctx.lineTo(this.size / 2 + 12, 8);
            ctx.stroke();
        }

        ctx.restore();
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
        
        // Start game on any key press from start screen
        if (!game.gameStarted) {
            game.gameStarted = true;
            return;
        }
        
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

    // Random obstacles throughout (more for bigger world)
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * (WORLD_WIDTH - 400) + 200;
        const y = Math.random() * (WORLD_HEIGHT - 800) + 400;
        const type = Math.random() > 0.5 ? 'tree' : 'mountain';
        game.obstacles.push(new Obstacle(x, y, 40, 40, type));
    }
}

function createCollectibles() {
    // Hearts (more for bigger world)
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * (WORLD_WIDTH - 400) + 200;
        const y = Math.random() * (WORLD_HEIGHT - 800) + 400;
        game.collectibles.push(new Collectible(x, y, 'heart'));
    }
    
    // Heart containers (increase max health)
    for (let i = 0; i < 3; i++) {
        const x = Math.random() * (WORLD_WIDTH - 400) + 200;
        const y = Math.random() * (WORLD_HEIGHT - 1200) + 600;
        game.collectibles.push(new Collectible(x, y, 'heart_container'));
    }
    
    // Coin pouches (bonus points)
    for (let i = 0; i < 3; i++) {
        const x = Math.random() * (WORLD_WIDTH - 400) + 200;
        const y = Math.random() * (WORLD_HEIGHT - 1200) + 600;
        game.collectibles.push(new Collectible(x, y, 'coin_pouch'));
    }
    
    // Weapons
    const weapons = ['bow', 'battleaxe'];
    for (let weapon of weapons) {
        const x = Math.random() * (WORLD_WIDTH - 400) + 200;
        const y = Math.random() * (WORLD_HEIGHT - 1200) + 600;
        game.collectibles.push(new Collectible(x, y, weapon));
    }
    
    // Potions (more for bigger world)
    const potions = ['red_potion', 'green_potion', 'yellow_potion', 'blue_potion', 'red_potion', 'green_potion'];
    for (let potion of potions) {
        const x = Math.random() * (WORLD_WIDTH - 400) + 200;
        const y = Math.random() * (WORLD_HEIGHT - 1200) + 600;
        game.collectibles.push(new Collectible(x, y, potion));
    }
}

function createEnemies() {
    // Create mix of goblin and kobold types
    const types = [
        'blue', 'blue', 'blue', 'red', 'red', 'red', 'white', 'white', 'white',
        'blue_kobold', 'blue_kobold', 'red_kobold', 'red_kobold', 'white_kobold', 'white_kobold'
    ];
    
    for (let i = 0; i < types.length; i++) {
        const x = Math.random() * (WORLD_WIDTH - 400) + 200;
        const y = Math.random() * (WORLD_HEIGHT - 1200) + 600;
        game.enemies.push(new Enemy(x, y, types[i]));
    }
}

function attack() {
    if (game.gameOver || game.player.lastAttackTime > 0) return;
    
    // Set attack cooldown
    game.player.lastAttackTime = game.player.attackCooldown;
    
    if (game.player.weapon === 'bow') {
        // Shoot arrow
        let vx = 0, vy = 0;
        const arrowSpeed = 8;
        
        switch (game.player.facingDirection) {
            case 'up': vy = -arrowSpeed; break;
            case 'down': vy = arrowSpeed; break;
            case 'left': vx = -arrowSpeed; break;
            case 'right': vx = arrowSpeed; break;
        }
        
        game.player.arrows.push({
            x: game.player.x,
            y: game.player.y,
            vx: vx,
            vy: vy,
            damage: game.player.weaponDamage,
            distance: 0
        });
        
        game.player.attacking = true;
        game.player.attackTime = 0;
        game.player.attackDuration = 10;
    } else {
        // Melee attack
        game.player.attacking = true;
        game.player.attackTime = 0;
        game.player.attackDuration = 15;
        
        const attackRange = game.player.weaponRange;
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
                    enemy.takeDamage(game.player.weaponDamage);
                }
            }
        }
    }
}

// Check arrow collisions with enemies
function updateArrows() {
    for (let i = game.player.arrows.length - 1; i >= 0; i--) {
        const arrow = game.player.arrows[i];
        
        for (let enemy of game.enemies) {
            if (!enemy.alive) continue;
            
            const dx = enemy.x - arrow.x;
            const dy = enemy.y - arrow.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < enemy.size / 2) {
                enemy.takeDamage(arrow.damage);
                game.player.arrows.splice(i, 1);
                break;
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
    game.gameStarted = false;
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

function drawStartScreen() {
    game.ctx.fillStyle = '#1a1a1a';
    game.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Title
    game.ctx.fillStyle = '#ffd700';
    game.ctx.font = 'bold 48px "Courier New"';
    game.ctx.textAlign = 'center';
    game.ctx.fillText('The Legend of Kiro', CANVAS_WIDTH / 2, 80);
    
    // Subtitle
    game.ctx.fillStyle = '#fff';
    game.ctx.font = '20px "Courier New"';
    game.ctx.fillText('Press any key to start', CANVAS_WIDTH / 2, 120);
    
    // Instructions section
    game.ctx.fillStyle = '#ffd700';
    game.ctx.font = 'bold 24px "Courier New"';
    game.ctx.textAlign = 'left';
    game.ctx.fillText('Weapons:', 50, 170);
    
    game.ctx.fillStyle = '#fff';
    game.ctx.font = '16px "Courier New"';
    game.ctx.fillText('Sword: 2 damage, 4 attacks/sec', 70, 195);
    game.ctx.fillText('Bow: 1 damage, shoots arrows', 70, 215);
    game.ctx.fillText('Battle Axe: 6 damage, 2 attacks/sec', 70, 235);
    
    // Collectibles section
    game.ctx.fillStyle = '#ffd700';
    game.ctx.font = 'bold 24px "Courier New"';
    game.ctx.fillText('Collectibles:', 50, 280);
    
    game.ctx.fillStyle = '#fff';
    game.ctx.font = '16px "Courier New"';
    game.ctx.fillText('Heart Container: +1 max health', 70, 305);
    game.ctx.fillText('Coin Pouch: +500 points', 70, 325);
    
    // Potions section
    game.ctx.fillStyle = '#ffd700';
    game.ctx.font = 'bold 24px "Courier New"';
    game.ctx.fillText('Potions (5 seconds):', 50, 365);
    
    game.ctx.fillStyle = '#ff0000';
    game.ctx.font = '16px "Courier New"';
    game.ctx.fillText('Red: Double damage', 70, 390);
    
    game.ctx.fillStyle = '#00ff00';
    game.ctx.fillText('Green: Attack 2x faster', 70, 410);
    
    game.ctx.fillStyle = '#ffff00';
    game.ctx.fillText('Yellow: Move 2x faster', 70, 430);
    
    game.ctx.fillStyle = '#0066ff';
    game.ctx.fillText('Blue: Invulnerable', 70, 450);
    
    // Enemies section
    game.ctx.fillStyle = '#ffd700';
    game.ctx.font = 'bold 24px "Courier New"';
    game.ctx.fillText('Enemies:', 50, 490);
    
    game.ctx.fillStyle = '#fff';
    game.ctx.font = '16px "Courier New"';
    game.ctx.fillText('Goblins: Melee with clubs', 70, 515);
    game.ctx.fillText('Kobolds: Ranged with crossbows', 70, 535);
    game.ctx.fillText('Ogre Boss: Defeat to win!', 70, 555);
    
    // Controls
    game.ctx.fillStyle = '#ffd700';
    game.ctx.font = 'bold 24px "Courier New"';
    game.ctx.fillText('Controls:', 50, 585);
    
    game.ctx.fillStyle = '#fff';
    game.ctx.font = '16px "Courier New"';
    game.ctx.fillText('WASD or Arrow Keys: Move', 70, 610);
    game.ctx.fillText('Spacebar: Attack', 70, 630);
}

function gameLoop() {
    if (!game.gameStarted) {
        drawStartScreen();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    if (!game.gameOver) {
        // Update
        game.player.update();
        
        for (let enemy of game.enemies) {
            enemy.update(game.player);
        }
        
        for (let collectible of game.collectibles) {
            collectible.checkCollection(game.player);
        }
        
        updateArrows();
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
