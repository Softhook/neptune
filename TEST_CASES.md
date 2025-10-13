# Moonbase Positioning Test Cases

## Test Case 1: Base Drawing

### Before
```javascript
// Base drawn from left edge
rect(this.pos.x, this.pos.y, this.width, this.height);
// If base.pos.x = 100, base.width = 100
// Base spans from x=100 to x=200 (LEFT edge at 100)
```

### After
```javascript
// Base drawn centered
const baseLeft = this.pos.x - this.width / 2;
rect(baseLeft, this.pos.y, this.width, this.height);
// If base.pos.x = 150, base.width = 100
// Base spans from x=100 to x=200 (CENTER at 150)
```

✅ **Result**: Base is now centered around pos.x coordinate

---

## Test Case 2: Dropping a Base from Ship

### Before
```javascript
// Ship at x=150, needs to offset to center base
const basePos = this.pos.copy().sub((BASE_WIDTH / 2), 0);
// If ship.pos.x = 150, BASE_WIDTH = 100
// basePos.x = 150 - 50 = 100 (left edge)
```

### After
```javascript
// Ship at x=150, center aligns directly
const basePos = this.pos.copy();
// If ship.pos.x = 150
// basePos.x = 150 (center)
```

✅ **Result**: Base deploys centered directly under ship, no offset calculation needed

---

## Test Case 3: Collision Detection

### Before
```javascript
// Check if object at x=150 collides with base
if (object.x > base.pos.x && object.x < base.pos.x + base.width) {
  // If base.pos.x = 100, base.width = 100
  // Checks: 150 > 100 AND 150 < 200 → TRUE ✓
}
```

### After
```javascript
// Check if object at x=150 collides with base
if (object.x > base.pos.x - base.width/2 && object.x < base.pos.x + base.width/2) {
  // If base.pos.x = 150, base.width = 100
  // Checks: 150 > 100 AND 150 < 200 → TRUE ✓
}
```

✅ **Result**: Same collision behavior, but more intuitive (checking distance from center)

---

## Test Case 4: Finding Base Center

### Before
```javascript
// To get center, add half width
const baseCenter = base.pos.x + base.width / 2;
// If base.pos.x = 100, base.width = 100
// baseCenter = 100 + 50 = 150
```

### After
```javascript
// Center is already pos.x
const baseCenter = base.pos.x;
// If base.pos.x = 150
// baseCenter = 150
```

✅ **Result**: Simpler code, no calculation needed

---

## Test Case 5: Placing Base on Flat Terrain

### Before
```javascript
// Base placed at left edge of terrain segment
return createVector(start.x, avgY - this.height);
// If segment from x=100 to x=200, start.x = 100
// Base left edge at 100, extends to 200
```

### After
```javascript
// Base placed at center of terrain segment
const avgX = (start.x + end.x) / 2;
return createVector(avgX, avgY - this.height);
// If segment from x=100 to x=200
// avgX = 150, base spans from 100 to 200
```

✅ **Result**: Base naturally centers on terrain segment

---

## Test Case 6: Drone Patrol around Base

### Before
```javascript
// Calculate base center for patrol
let baseCenter = createVector(
  this.homeBase.pos.x + this.homeBase.width / 2,
  this.homeBase.pos.y
);
// If base.pos.x = 100, width = 100
// baseCenter.x = 150
```

### After
```javascript
// Base center is already pos.x
let baseCenter = createVector(
  this.homeBase.pos.x,
  this.homeBase.pos.y
);
// If base.pos.x = 150
// baseCenter.x = 150
```

✅ **Result**: Simpler patrol logic, drone orbits around actual base position

---

## Integration Test: Complete Base Lifecycle

1. **Ship drops base** at x=150 → Base created with pos.x = 150 (center)
2. **Base draws** from x=100 to x=200 (centered around 150)
3. **Ship lands** on base → Collision check succeeds (x=150 within 100-200)
4. **Drone patrols** → Orbits around x=150 (base center)
5. **Meteor hits** at x=160 → Collision check succeeds (160 within 100-200)
6. **Base destroyed** → RuinedBase created with pos.x = 150 (center preserved)

✅ **Result**: All systems work consistently with centered positioning
