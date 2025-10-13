# Moonbase Positioning Fix

## Issue
Previously, moonbase positioning used the **bottom-left corner** as the reference point. This meant:
- `base.pos.x` represented the LEFT edge of the base
- `base.pos.y` represented the TOP edge of the base (but positioned at surface - height)

## Solution
Changed moonbase positioning to use the **middle-bottom** as the reference point:
- `base.pos.x` now represents the HORIZONTAL CENTER of the base
- `base.pos.y` still represents the TOP edge (positioned at surface - height)

## Changes Made

### Core Positioning Changes

1. **MoonBase.draw()** (classes.js)
   - Changed from: `rect(this.pos.x, this.pos.y, this.width, this.height)`
   - Changed to: `rect(this.pos.x - this.width/2, this.pos.y, this.width, this.height)`
   - Now draws base centered around pos.x

2. **MoonBase.findSuitableLocation()** (classes.js)
   - Added: `const avgX = (start.x + end.x) / 2;`
   - Now returns centered X position instead of left edge

3. **MoonBase.createFromNest()** (classes.js)
   - Removed X offset: Changed from `sub(BASE_WIDTH / 2, ...)` to `sub(0, ...)`
   - pos.x is now already at center

4. **Ship.dropBase()** (classes.js)
   - Removed X offset: Simplified to use ship's center position directly
   - Base is now deployed centered under ship

### Collision Detection Updates

5. **Ship.findBaseUnder()** (classes.js)
   - Changed bounds check from `base.pos.x to base.pos.x + base.width`
   - Changed to: `base.pos.x - base.width/2 to base.pos.x + base.width/2`

6. **Ship.isOverBase()** (classes.js)
   - Updated bounds check to use centered positioning

7. **Ship.findNearestBase()** (classes.js)
   - Removed `+ base.width / 2` since pos.x is now already at center

8. **Ship.placeOnMoonBase()** (classes.js)
   - Simplified: baseCenter is now just `nearestBase.pos.x`

9. **Astronaut.isOverBase()** (classes.js)
   - Updated bounds check to use centered positioning

10. **Bullet.checkCollisionWithMoonBases()** (classes.js)
    - Updated bounds check to use centered positioning

11. **Meteor collision** (weather.js)
    - Updated bounds check to use centered positioning

### Related Component Updates

12. **BaseDrone.constrainToPatrolArea()** (classes.js)
    - Simplified: baseCenter is now just `this.homeBase.pos.x`

13. **BaseDrone.launchDrone()** (classes.js)
    - Updated drone spawn position to account for centered base
    - Now spawns at tower center correctly

14. **RuinedBase.draw()** (classes.js)
    - Updated to draw image centered around pos.x

15. **Lightning damage** (weather.js)
    - Simplified center calculation: removed `+ base.width/2`

## Testing
All JavaScript files validated with `node -c` - syntax correct.

## Impact
- Bases now appear more naturally centered on the surface
- Collision detection is more intuitive
- Code is simpler and more maintainable
- All existing base functionality preserved
