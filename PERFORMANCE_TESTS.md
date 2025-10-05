# Performance Testing Guide - Neptune Game

This document provides guidance for testing and validating the performance optimizations implemented in the Neptune game.

## Quick Performance Check

The game includes built-in FPS monitoring via the debug system. To enable:

1. Open the game in a browser (open `index.htm`)
2. Press the `[` key to enable debug mode
3. The FPS counter will appear in the top-left corner
4. Average FPS is calculated over 1-second intervals

## Performance Testing Methodology

### Test Scenarios

To properly measure optimization impact, test under these conditions:

#### 1. Light Load Scenario
- Start new game
- Minimal aliens on screen (~10-20)
- No active weather effects
- Expected FPS: 55-60 FPS

#### 2. Medium Load Scenario
- Mid-game with ~50-100 aliens
- 1-2 active weather effects
- Multiple wingmen deployed
- Expected FPS: 40-55 FPS

#### 3. Heavy Load Scenario
- Late game with 100+ aliens
- Multiple weather effects active (storm + rainbow rain + quantum storm)
- Multiple wingmen + walkers
- AlienWorm and Hunter enemies present
- Expected FPS: 30-45 FPS

#### 4. Extreme Load Scenario
- Boss fight (AlienKing or AlienQueen)
- Maximum alien count
- All weather effects active
- Multiple explosions and particles
- Expected FPS: 25-40 FPS

## Key Optimization Validations

### 1. Distance Calculation Optimizations

**Before optimization:** Using `.dist()` method (includes sqrt)
```javascript
if (this.pos.dist(target.pos) < threshold) { ... }
```

**After optimization:** Using squared distance
```javascript
const dx = this.pos.x - target.pos.x;
const dy = this.pos.y - target.pos.y;
if (dx * dx + dy * dy < threshold * threshold) { ... }
```

**How to test:**
- Enable debug mode with `[` key
- Spawn many aliens (they spawn continuously in-game)
- Observe FPS with 100+ entities performing collision checks
- sqrt elimination should provide 5-15% FPS improvement under heavy load

### 2. Graphics State Batching

**Affected systems:**
- Bullet rendering
- Cluster overlays  
- Wind lines
- Rainbow rain

**How to test:**
- Fire many bullets (hold space in ship mode)
- Trigger rainbow rain weather event
- Compare FPS before/after with 50+ bullets on screen
- Batched rendering should reduce CPU overhead

### 3. Redundant Function Call Elimination

**drawWindLinesOptimized optimization:**
- Before: ~1000+ `isInView()` calls per frame
- After: 0 `isInView()` calls per frame

**How to test:**
- Enable wind (happens automatically in-game)
- Check FPS impact when wind is strong (windForce high)
- Optimization most visible when wind visualization is active

## Browser Performance Tools

For detailed profiling, use browser DevTools:

### Chrome DevTools
1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record
4. Play game for 10-15 seconds
5. Stop recording
6. Look for:
   - Function call counts
   - Time spent in specific functions
   - Frame rendering time

### Key Functions to Monitor
- `drawGame()` - main render loop
- `updateGame()` - main update loop
- `Bullet.drawBullets()` - bullet rendering
- `Alien.updateAliens()` - alien AI updates
- `getCachedSurfaceYAtX()` - terrain queries
- `drawClusterOverlays()` - cluster rendering

## Expected Performance Gains

Based on optimization changes:

| Optimization | Impact | Expected FPS Gain |
|--------------|--------|-------------------|
| Squared distance (collision) | High | 5-15% under heavy load |
| Batched rendering (bullets) | High | 3-8% with 50+ bullets |
| Wind line isInView removal | Medium | 2-5% when wind active |
| Cluster overlay optimization | Medium | 2-4% with many clusters |
| Wingman/Hunter AI optimization | Medium | 3-6% with multiple wingmen/hunters |

**Combined impact:** 15-40% FPS improvement under heavy load scenarios

## Performance Regression Testing

After any code changes, verify:

1. **Syntax validation:**
   ```bash
   node -c sketch.js
   node -c classes.js
   node -c aliens.js
   node -c weather.js
   ```

2. **Visual output matches:**
   - Bullets render correctly (player = yellow/colored, enemy = green)
   - Wind lines animate smoothly
   - Cluster overlays have proper gradient
   - All collision detection works as expected

3. **FPS benchmarks:**
   - Light load: Should maintain 55-60 FPS
   - Heavy load: Should not drop below 25 FPS
   - Optimization should show improvement in heavy load scenarios

## Troubleshooting

### FPS Still Low?
- Check browser: Chrome/Edge perform best for p5.js
- Close other browser tabs
- Disable browser extensions
- Check system resources (CPU/GPU usage)

### Visual Glitches?
- Verify all syntax checks pass
- Check console for JavaScript errors
- Ensure squared distance optimizations use correct threshold calculations
- Verify batched rendering preserves draw order

## Automated Testing (Future Enhancement)

Consider adding:
- Automated FPS logging to file
- Performance regression test suite
- Benchmark comparison tools
- Memory usage profiling

## Notes

- p5.js performance is highly dependent on browser and GPU
- Mobile devices will have lower FPS than desktop
- The optimizations focus on reducing CPU overhead, not GPU rendering
- Most visible improvements are in complex scenarios (many entities, effects)
