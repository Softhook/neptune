# Moonbase Positioning Change - Visual Diagram

## Before (Bottom-Left Corner Reference)

```
Moon Surface: ═══════════════════════════════════
                    
                ┌───────────────┐
                │   MoonBase    │ Tower
                │               │ |
                └───────────────┘ ┘
                ↑
            base.pos.x (LEFT edge)
            base.pos.y (TOP edge)
```

**Collision Detection (OLD):**
- Check if `object.x > base.pos.x AND object.x < base.pos.x + base.width`

## After (Middle-Bottom Reference)

```
Moon Surface: ═══════════════════════════════════
                    
                ┌───────────────┐
                │   MoonBase    │ Tower
                │               │ |
                └───────────────┘ ┘
                        ↑
                  base.pos.x (CENTER)
                  base.pos.y (TOP edge)
```

**Collision Detection (NEW):**
- Check if `object.x > base.pos.x - base.width/2 AND object.x < base.pos.x + base.width/2`

## Benefits

1. **More Intuitive**: Base position represents its center, matching how other game objects work
2. **Simpler Code**: No need to add `width/2` to calculate center position
3. **Better Alignment**: Bases naturally center on terrain segments
4. **Consistent**: Ship, astronaut, and other entities use center positioning

## Example: Dropping a Base

### Before:
```javascript
const basePos = this.pos.copy().sub((MoonBase.BASE_WIDTH / 2), 0);
basePos.y = getCachedSurfaceYAtX(basePos.x);
```
Ship had to offset left by half-width to center the base.

### After:
```javascript
const basePos = this.pos.copy();
basePos.y = getCachedSurfaceYAtX(basePos.x);
```
Ship position is already at center, no offset needed!

## Example: Finding Base Center

### Before:
```javascript
const baseCenter = base.pos.x + base.width / 2;
```
Had to add half-width to get center.

### After:
```javascript
const baseCenter = base.pos.x;
```
Position is already at center!
