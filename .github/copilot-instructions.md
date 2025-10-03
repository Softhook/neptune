# Neptune Game - AI Coding Guidelines

## Project Overview
Neptune is a space-based action game built with p5.js featuring ship and astronaut gameplay, alien ecosystem simulation, procedural missions, and dynamic weather systems. The game combines real-time physics, state management, and AI-driven narrative elements.

## Core Architecture

### File Structure & Responsibilities
- `sketch.js` - Main game loop, rendering, input handling, and game state management
- `classes.js` - Core entity classes (Ship, Astronaut, Aliens, Weapons, etc.) using class-based inheritance
- `aliens.js` - Alien ecosystem (AlienPlant → Nest conversion, various alien types)
- `gamestate.js` - Complete save/load system with serialization for all game entities
- `missions.js` - Dynamic mission system with timer-based objectives
- `weather.js` - Environmental effects (meteors, storms, magnetic anomalies)
- `narrative.js` - Story elements and announcements
- `boss.js` - Boss entity behaviors (AlienQueen, AlienKing)

### Entity System Patterns
All game entities inherit from `Entity` base class with `pos`, `vel`, `size` properties. Key patterns:
- **Static collections**: `Alien.aliens[]`, `MoonBase.moonBases[]`, `Bullet.activeObjects[]`
- **Object pooling**: `Bullet` and `Particle` classes use pools for performance
- **Factory methods**: `Alien.createAliens(count)`, `Zapper.spawnZapper()`

### Game State Architecture
- Global variables for core state: `energy`, `money`, `level`, `gameState`, `ship`, `astronaut`, `pod`
- Dual player modes: `isWalking` toggles between ship and astronaut control
- `GameStateManager` provides complete save/load with validation and error recovery

### Control System
**Ship mode**: WASD movement, Space=shoot, Down=bomb, D=deploy base, Q=wingman, W=missile
**Walking mode**: Arrow keys=movement, Z=jump, Space=hold bomb throw, T=turret, S=shield, R=drill rig
**Universal**: X=toggle ship/walking, U=upgrades, F5/F6=save/load

## Critical Development Workflows

### Entity Management
When adding entities:
1. Inherit from `Entity` class
2. Add to appropriate static collection (`EntityType.entities = []`)
3. Implement in `EntitySerializer` for save/load support
4. Add update/draw calls to main game loop
5. Handle cleanup in `resetGame()`

### Game Balance & Upgrades
Upgradeable properties use static defaults:
```javascript
// Pattern: static defaults + instance copying
Bullet.damageMultiplier = 1;  // Modified by upgrades
Bomb.defaultExplosionRadius = 30;  // Applied to new instances
```

### Performance Optimization
- **View culling**: Use `isInView(pos, size)` before expensive draw operations
- **Terrain caching**: Use `getCachedSurfaceYAtX()` instead of `getSurfaceYAtX()` for frequent surface queries
- **Timer management**: `GameTimer` class handles all delayed actions (healing, spawning, mission timeouts)

## Mission System Integration

### Mission Lifecycle
1. `MissionControl.startRandomMission()` triggers based on probability
2. Each mission class has `startMission()`, `update()`, `completeMission(success)` methods
3. Use `GameTimer` for time-limited objectives
4. Mission state persists through save/load via `MissionSerializer`

### Adding New Missions
```javascript
class MyMission {
  static isActive = false;
  static missionTimerKey = 'myMission';
  
  static startMission() {
    this.isActive = true;
    announcer.speak("Mission briefing...");
    GameTimer.create(this.missionTimerKey, () => this.completeMission(false), 300000);
  }
}
```

## Terrain & Physics Integration

### Surface Modification
Many entities modify `moonSurface[]` array (bombs, meteors). Always:
1. Call `clearTerrainCache()` after terrain changes
2. Update affected entity positions with `getCachedSurfaceYAtX()`
3. Use smooth crater edges to prevent visual artifacts

### Collision Patterns
- **Bullet collisions**: Check entity type, apply damage, handle destruction
- **Surface collisions**: Use `distToSegment()` helper for line-surface intersections  
- **Explosion damage**: Radius-based damage with falloff patterns

## Audio & Narrative Systems

### Sound Management
`SoundManager` handles all audio with preloading. Key patterns:
- `soundManager.play('eventName')` for one-shots
- `soundManager.loopIfNotPlaying('continuous')` for engine sounds
- Conditional audio based on game state (warnings, ambient)

### Dynamic Announcements
`announcer.speak(text, voice, pitch, delay)` provides contextual narration. Use for:
- Mission briefings and status updates
- Environmental changes (wind, storms)
- Player achievements and warnings

## Development Environment
Simple p5.js browser-based game - open `index.html` directly in browser. No build process required.

**Script loading order** (critical for dependencies):
```html
<script src="sketch.js"></script>     <!-- Main game loop -->
<script src="classes.js"></script>   <!-- Core entities -->
<script src="aliens.js"></script>    <!-- Alien ecosystem -->
<script src="gamestate.js"></script> <!-- Save/load system -->
<!-- Additional modules... -->
```

## Common Gotchas
- **Energy bounds**: Always check `energy = Math.min(energy, maxEnergy)` after modifications
- **Entity cleanup**: Remove from static arrays AND clear timers in `resetGame()`
- **Serialization**: New properties need explicit handling in EntitySerializer
- **P5.js vectors**: Use `.copy()` when storing references to avoid mutation bugs
- **Performance**: Large entity counts require view culling and object pooling
- **KeyCode constants**: Use specific keyCodes (90='z', 116=F5, 117=F6, 219='[', 221=']')

## Testing & Development Workflows

### Debug Commands & Keybindings
- **F5**: Save game (`keyIsDown(116)`)
- **F6**: Load game (`keyIsDown(117)`)
- **[ key (keyCode 219)**: Toggle debug mode (`debug.toggle()`)
- **] key (keyCode 221)**: Save debug logs to file (when debug enabled)
- **Mouse click**: Toggle fullscreen

### Debug System
```javascript
debug = Debug.getInstance();  // Singleton pattern
debug.log("message");         // Timestamped console logging
debug.error("error");         // Error tracking with history
debug.setVisualDebug(key, value);  // On-screen debug display
```

### Testing Utilities
- `TestUtility.testEnergyLevelAfterLoad()` validates save/load system
- `GameTimer.getActiveTimers()` debug timer leaks
- FPS monitoring appears when debug enabled
- Global error handler resets game on unhandled exceptions

### Critical Testing Patterns
- Always test save/load after entity changes (serialization is complex)
- Use `debug.measureExecutionTime(func, label)` for performance analysis
- Verify `energy = Math.min(energy, maxEnergy)` bounds after modifications