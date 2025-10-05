# Quick Fix Guide: 1920x1080 Performance Issue

## The Issue
Game runs at only 56 FPS at 1920x1080 resolution, noticeably slower than on smaller screens.

## The Root Cause
On high-DPI/retina displays, p5.js defaults to `pixelDensity(2)`, which means:
- Your 1920x1080 window actually renders **3840x2160 pixels** (4K!)
- That's **4x more pixels** than expected
- Result: Significant FPS drop even with optimized code

## The Fix
Added one critical line to `setup()` in `sketch.js`:

```javascript
pixelDensity(1); // Force 1:1 pixel density for better performance
```

## Additional Optimizations
1. **Adaptive wind resolution** - Scales with screen width (37% fewer vertices at 1920x1080)
2. **Shooting star optimization** - Pre-calculated trig, eliminated map() calls
3. **Star rendering batching** - Added noStroke() batching

## Expected Results

| Display | Before | After |
|---------|--------|-------|
| Standard 1920x1080 | 50-58 FPS | 55-60 FPS |
| High-DPI 1920x1080 | **45-56 FPS** | **55-60 FPS** ⭐ |

## Testing
1. Open game at fullscreen (1920x1080)
2. Press `[` key to show FPS counter
3. Should see 55-60 FPS during gameplay

## Visual Impact
Minimal - game assets are not high-res enough to benefit from 2x pixel density. Performance gain far outweighs any theoretical quality loss.

---

For detailed technical information, see `RESOLUTION_FIX_SUMMARY.md`
