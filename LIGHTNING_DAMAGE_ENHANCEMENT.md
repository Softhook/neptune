# Lightning Strike Damage Enhancement

## Issue
Lightning strikes during lightning storms were not effectively destroying entities. The damage radius was too small (25px) compared to visual scorch marks (18-40px), and several entity types were not being checked for damage.

## Changes Made

### 1. Tiered Damage System
Replaced single-radius instant-kill system with three damage zones:

- **Lethal Zone (0-25px)**: 100% damage - instant death for most entities
- **Severe Zone (25-50px)**: 70% damage - heavy damage to entities
- **Moderate Zone (50-75px)**: 30% damage - minor damage to entities

This creates more realistic lightning strike behavior where entities farther from the strike point receive proportionally less damage.

### 2. Damage Scaling by Entity Type

#### Player Entities
- **Ship (landed)**: 1500 energy damage × distance multiplier
- **Astronaut**: 1000 energy damage × distance multiplier

#### Structures
- **Moon Bases**: 300 health damage × distance multiplier (increased from 200)
- **Turrets**: Proportional health damage × distance multiplier
- **Drill Rigs**: Proportional health damage × distance multiplier
- **Walker Robots**: Proportional health damage × distance multiplier

#### Alien Entities
- **Alien.aliens**: Proportional health damage × distance multiplier
- **Hunter.hunters**: Proportional health damage × distance multiplier
- **Zapper.zappers**: Proportional health damage × distance multiplier
- **Destroyer.destroyers**: Proportional health damage × distance multiplier
- **AlienPlant.plants**: Destroyed if within damage zone
- **Nest.nests**: Proportional health damage × distance multiplier
- **AlienFortress.fortresses**: Proportional health damage × distance multiplier

#### Previously Missing Entity Types (Now Covered)
- **AlienWorm.worms**: Checks all segments, applies max damage multiplier found
- **Shield.shields**: 100 damage × distance multiplier
- **Wingman.wingmen**: Proportional health damage × distance multiplier
- **alienQueen** (boss): 500 damage × distance multiplier
- **alienKing** (boss): 500 damage × distance multiplier

### 3. Visual Consistency
The maximum damage radius (75px) now better matches the visual appearance of lightning strikes and scorch marks, making the game feel more realistic and consistent.

## Technical Implementation

### Helper Functions
```javascript
getDamageMultiplier(px, py)  // Returns 1.0, 0.7, 0.3, or 0 based on distance
withinDamageZone(px, py)     // Quick check if entity is in any damage zone
```

### Performance Considerations
- Uses squared distance calculations for performance (no sqrt() calls)
- Only applies damage when multiplier > 0 (entities outside zones are skipped)
- Follows existing code patterns from bomb explosion damage system

## Testing Recommendations

1. **Start a game and trigger a lightning storm**
   - Lightning storms occur randomly during gameplay
   - Can be observed without interaction

2. **Verify damage at different ranges:**
   - Direct hits (0-25px) should kill most entities instantly
   - Near misses (25-50px) should severely damage entities (70% health loss)
   - Distant strikes (50-75px) should moderately damage entities (30% health loss)
   - Entities beyond 75px should be unaffected

3. **Test specific entity types:**
   - Place moon bases near lightning strikes
   - Deploy wingmen, turrets, and drill rigs in storm areas
   - Observe alien worms, shields, and boss entities during storms
   - Land ship during storm to test player damage

4. **Visual verification:**
   - Scorch marks should appear where lightning hits
   - Explosions should trigger for destroyed entities
   - Damage should feel proportional to strike proximity

## Files Modified
- `weather.js` - Updated `LightningStorm.applyStrikeDestruction()` method

## Lines Changed
- 157 insertions (+)
- 49 deletions (-)
- Net: +108 lines

## Backward Compatibility
All changes are backward compatible. Existing game saves and functionality are unaffected.
