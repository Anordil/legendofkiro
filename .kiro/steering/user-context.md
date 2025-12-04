---
inclusion: always
---

# User Game Preferences

## Project Structure
- Separate files (HTML, CSS, JavaScript)

## Game Specifications
- **Game Type**: Retro Legend of Zelda style, top-down 2D
- **Level Size**: 1 screen wide x 5 screens tall (vertical scrolling)
- **Starting Position**: Bottom of the level
- **Movement**: Up, left, down, right (no diagonal)

## Character & Sprites
- **Player Character**: kiro-logo.png (30px square)
- **Collectibles**: Hearts for health restoration (20px - 2/3 of character size)
- **Obstacles**: Trees, mountains on edges (impassable boundaries)
- **Art Style**: Simple pixel art

## Game Mechanics
- **Health**: 4 hearts starting
- **Scoring**: Points awarded for defeating enemies
- **Camera**: Smooth scrolling, player-centered
- **Movement**: Friction applied to horizontal movement
- **Collision**: Accurate detection for walls/obstacles and items

## Win/Lose Conditions
- **Win**: Defeat the final boss
- **Lose**: Run out of hearts
- **Level Completion**: Defeating final boss or game over

## Future Features to Consider
- More collectible types
- Additional enemy types
- Multiple levels
- Audio and visual effects
