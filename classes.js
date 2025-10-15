
class Entity {
  constructor(pos, vel, size) {
    this.pos = pos.copy();  // Use copy() to ensure we have a new p5.Vector
    this.vel = vel.copy();
    this.size = size;
  }

  update() {
    this.pos.add(this.vel);
    this.pos.x = (this.pos.x + worldWidth) % worldWidth;
  }

  draw() {
    // To be implemented by child classes
  }
}

// Lightweight world label entity + manager
class MapLabel {
  // Static collection of labels
  static labels = [];
  static MAX_TERRAIN_LABELS_PER_TYPE = 3;
  static MAX_CLUSTER_LABELS = 6;
  static MAX_FAUNA_LABELS = 6;
  static MAX_ABOVE_LABELS = 6;
  static DETECTION_RADIUS_X = 300; // for de-duplication and proximity
  static ACTIVE_RADIUS_X = 500; // when camera center is within this, show label
  static SCAN_INTERVAL_MS = 15000; // periodic scan
  static scanTimerKey = 'mapLabelsScan';
  static _tmpBottom = [];
  static _tmpAbove = [];
  static _lastTextSize = 14;
  static _labelsVersion = 0;
  static _layoutCache = {
    camOffset: null,
    width: null,
    height: null,
    labelsVersion: -1,
    textSize: 14,
    placedBottom: [],
    placedAbove: [],
  };

  constructor(pos, type, name) {
    this.pos = pos.copy();
    this.type = type; // 'base' | 'peak' | 'valley' | 'cluster' | 'fauna'
    this.name = name || MapLabel.generateName(pos.x, type);
    MapLabel.labels.push(this);
    // Cached metrics for overlay drawing
    this._textWidth = null; // measured at MapLabel._lastTextSize
    this._boxWidth = null;  // includes padding
    MapLabel._labelsVersion++;
  }

  static reset() {
    MapLabel.labels = [];
    MapLabel._labelsVersion = 0;
    MapLabel._layoutCache.placedBottom.length = 0;
    MapLabel._layoutCache.placedAbove.length = 0;
    MapLabel._layoutCache.labelsVersion = -1;
    if (typeof GameTimer !== 'undefined') {
      GameTimer.clearTimer(MapLabel.scanTimerKey);
    }
  }

  static initialize() {
    // kick off periodic scans once timers exist
    if (typeof GameTimer !== 'undefined' && !GameTimer.exists(MapLabel.scanTimerKey)) {
      GameTimer.create(MapLabel.scanTimerKey, () => {
        try { MapLabel.scanWorld(); } catch (e) { if (debug) debug.error('MapLabel scan error', e); }
      }, MapLabel.SCAN_INTERVAL_MS, true);
    }
    // Run an initial scan quickly to seed first labels
    try { MapLabel.scanWorld(); } catch(e) { /* ignore */ }
  }

  // Deterministic name generator (uses featureNames JSON if available)
  static generateName(x, type) {
    // Fallback seed lists if JSON isn't loaded yet
    const fallback = {
      adjectivesHigh: ['Towering', 'Lofty', 'Soaring', 'Elevated', 'Rising', 'Crowned', 'Summit', 'Apex'],
      adjectivesLow: ['Sunken', 'Deep', 'Plunging', 'Hollow', 'Subterranean', 'Abyssal', 'Buried', 'Descending'],
      terrainHigh: ['Peak', 'Ridge', 'Spire', 'Crest', 'Crown', 'Summit', 'Pinnacle', 'Height'],
      terrainLow: ['Basin', 'Hollow', 'Trench', 'Vale', 'Valley', 'Trough', 'Chasm', 'Abyss', 'Depth'],
      adjectivesNeutral: ['Craggy', 'Vast', 'Silent', 'Stormy', 'Frozen', 'Shifting', 'Shattered', 'Blue', 'Hidden', 'Luminous'],
      bio: ['Grove', 'Thicket', 'Bloom', 'Nest', 'Warren'],
      fauna: ['Huntgrounds', 'Feeding Grounds', 'Warren', 'Hatch'],
      base: ['Forward Base', 'Outpost One', 'Pioneer Site', 'Founders Base'],
      templates: ['{adjective} {terrain}']
    };

    // Pull from loaded JSON if available
    const pools = (typeof featureNames === 'object' && featureNames) ? featureNames : null;
    const h = MapLabel._hash(`${Math.floor(x)}|${type}`);

    // Helper to pick deterministically from array using an offset
    const pick = (arr, off = 0) => {
      if (!arr || !arr.length) return '';
      return arr[(Math.abs(h + off)) % arr.length];
    };

    // Build context pools per type
    let adjectivePool, terrainPool, bioPool, techPool, anomalyPool, mythicPool, colorMatPool, templates;
    let adjectiveHighPool, adjectiveLowPool, terrainHighPool, terrainLowPool;
    
    if (pools) {
      // Use explicit high/low word lists from JSON
      adjectiveHighPool = pools.adjectivesHigh || fallback.adjectivesHigh;
      adjectiveLowPool = pools.adjectivesLow || fallback.adjectivesLow;
      terrainHighPool = pools.terrainNounsHigh || fallback.terrainHigh;
      terrainLowPool = pools.terrainNounsLow || fallback.terrainLow;
      
      adjectivePool = [
        ...(pools.adjectivesEnvironmental || []),
        ...(pools.adjectivesEnergetic || []),
        ...(pools.adjectivesEmotive || [])
      ];
      terrainPool = pools.terrainNouns || [];
      bioPool = pools.bioNouns || [];
      techPool = pools.techNouns || [];
      anomalyPool = pools.anomalyNouns || [];
      mythicPool = pools.mythicSeeds || [];
      colorMatPool = pools.colorsMaterials || [];
      templates = pools.templates || fallback.templates;
    } else {
      adjectiveHighPool = fallback.adjectivesHigh;
      adjectiveLowPool = fallback.adjectivesLow;
      terrainHighPool = fallback.terrainHigh;
      terrainLowPool = fallback.terrainLow;
      adjectivePool = fallback.adjectivesNeutral;
      terrainPool = [...fallback.terrainHigh, ...fallback.terrainLow];
      bioPool = fallback.bio;
      techPool = fallback.base;
      anomalyPool = ['Anomaly', 'Rift', 'Gate'];
      mythicPool = ['Warden', 'Pioneer', 'Sovereign'];
      colorMatPool = ['Cobalt', 'Basalt', 'Obsidian'];
      templates = fallback.templates;
    }

    // Select a template based on type
    let template;
    switch (type) {
      case 'peak':
        template = '{adjectiveHigh} {terrainHigh}';
        break;
      case 'valley':
        template = '{adjectiveLow} {terrainLow}';
        break;
      case 'cluster':
        template = '{bio} {terrain}';
        break;
      case 'fauna':
        template = '{bio} {terrain}';
        break;
      case 'base':
        // Prefer a curated human military name if provided, else narrative + tech fallback
        if (pools && Array.isArray(pools.humanMilitaryNames) && pools.humanMilitaryNames.length) {
          return pick(pools.humanMilitaryNames, 11);
        }
        if (pools) {
          const nar = pick(pools.narrativeNouns || [], 5);
          const tech = pick(techPool, 7);
          return nar ? `${nar} ${tech}` : tech;
        }
        return pick(fallback.base, 7);
      default:
        template = pick(templates, 3);
    }

    // Populate template deterministically
    const mapping = {
      '{adjective}': pick(adjectivePool, 1),
      '{terrain}': pick(terrainPool, 2),
      '{adjectiveHigh}': pick(adjectiveHighPool, 13),
      '{adjectiveLow}': pick(adjectiveLowPool, 14),
      '{terrainHigh}': pick(terrainHighPool, 15),
      '{terrainLow}': pick(terrainLowPool, 16),
      '{bio}': pick(bioPool, 3),
      '{phenomenon}': pick((pools && pools.weatherNouns) || ['Storm', 'Vortex', 'Gale'], 4),
      '{anomaly}': pick(anomalyPool, 5),
      '{narrative}': pick((pools && pools.narrativeNouns) || ['Pioneer', 'Sentinel', 'Founder'], 6),
      '{mythic}': pick(mythicPool, 7),
      '{colorMaterial}': pick(colorMatPool, 8)
    };

    let result = template;
    for (const key in mapping) {
      result = result.replace(key, mapping[key]);
    }
    return result.trim().replace(/\s+/g, ' ');
  }

  static _hash(str) {
    let h = 2166136261 >>> 0; // FNV-1a 32-bit
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Primary world scan: bases, terrain features, plant clusters, fauna clusters
  static scanWorld() {
    if (typeof worldWidth === 'undefined' || !Array.isArray(moonSurface) || moonSurface.length === 0) return;
    
    // Cleanup: remove labels for bases that no longer exist
    if (Array.isArray(MoonBase?.moonBases)) {
      const baseNames = new Set(MoonBase.moonBases.map(b => b.name));
      MapLabel.labels = MapLabel.labels.filter(l => {
        if (l.type === 'base' && !baseNames.has(l.name)) {
          MapLabel._labelsVersion++;
          return false; // remove this label
        }
        return true; // keep this label
      });
    }
    
    // 1) Bases: ensure each base has a label with its unique name
    if (Array.isArray(MoonBase?.moonBases) && MoonBase.moonBases.length > 0) {
      for (const base of MoonBase.moonBases) {
        const p = createVector(base.pos.x, getCachedSurfaceYAtX(base.pos.x) - 10);
        if (!MapLabel._hasNearbyOfType(p, 'base', 80)) {
          new MapLabel(p, 'base', base.name || MoonBase.generateNameForBase(base.pos.x, base.id || 1));
        }
      }
    }

    // 2) Terrain features (peaks/valleys) - limit per type
    MapLabel._scanTerrainFeatures();

    // 3) Alien plant clusters -> label at cluster center (cap total)
    if (Array.isArray(AlienPlant?.clusterCenters)) {
      let clusterCount = MapLabel._countType('cluster');
      for (const c of AlienPlant.clusterCenters) {
        if (clusterCount >= MapLabel.MAX_CLUSTER_LABELS) break;
        const p = createVector(c.x, getCachedSurfaceYAtX(c.x) - 10);
        if (!MapLabel._hasNearbyOfType(p, 'cluster', 120)) {
          new MapLabel(p, 'cluster');
          clusterCount++;
        }
      }
    }

    // 4) Alien fauna clusters (aliens grouped by x bins) - cap total
    if (Array.isArray(Alien?.aliens) && Alien.aliens.length >= 6) {
      const binSize = 200;
      const bins = new Map();
      for (const a of Alien.aliens) {
        const key = Math.floor(a.pos.x / binSize) * binSize;
        const arr = bins.get(key) || [];
        arr.push(a);
        bins.set(key, arr);
      }
      let faunaCount = MapLabel._countType('fauna');
      for (const [key, arr] of bins.entries()) {
        if (faunaCount >= MapLabel.MAX_FAUNA_LABELS) break;
        if (arr.length >= 6) {
          const avgX = arr.reduce((s, a) => s + a.pos.x, 0) / arr.length;
          const avgY = arr.reduce((s, a) => s + a.pos.y, 0) / arr.length;
          const pos = createVector(avgX, Math.min(avgY, getCachedSurfaceYAtX(avgX) - 10));
          if (!MapLabel._hasNearbyOfType(pos, 'fauna', 150)) {
            new MapLabel(pos, 'fauna');
            faunaCount++;
          }
        }
      }
    }
  }

  static _scanTerrainFeatures() {
    let peakCount = MapLabel._countType('peak');
    let valleyCount = MapLabel._countType('valley');
    if (peakCount >= MapLabel.MAX_TERRAIN_LABELS_PER_TYPE && valleyCount >= MapLabel.MAX_TERRAIN_LABELS_PER_TYPE) return;

    const step = 30; // index step across moonSurface (points are ~10px apart)
    const win = 5; // window size left/right
    for (let i = win; i < moonSurface.length - win; i += step) {
      const y = moonSurface[i].y;
      let isPeak = true;
      let isValley = true;
      for (let w = 1; w <= win; w++) {
        // Peak: center y must be less than neighbors (higher elevation visually)
        if (moonSurface[i - w].y <= y || moonSurface[i + w].y <= y) isPeak = false;
        // Valley: center y must be greater than neighbors (lower visually)
        if (moonSurface[i - w].y >= y || moonSurface[i + w].y >= y) isValley = false;
        if (!isPeak && !isValley) break;
      }
      if (isPeak && peakCount < MapLabel.MAX_TERRAIN_LABELS_PER_TYPE) {
        const pos = moonSurface[i].copy();
        if (!MapLabel._hasNearbyOfType(pos, 'peak', 200)) {
          new MapLabel(pos, 'peak');
          peakCount++;
        }
      }
      if (isValley && valleyCount < MapLabel.MAX_TERRAIN_LABELS_PER_TYPE) {
        const pos = moonSurface[i].copy();
        if (!MapLabel._hasNearbyOfType(pos, 'valley', 200)) {
          new MapLabel(pos, 'valley');
          valleyCount++;
        }
      }
    }
  }

  static _countType(type) {
    return MapLabel.labels.reduce((c, l) => c + (l.type === type ? 1 : 0), 0);
  }

  static _wrapDx(ax, bx) {
    const dx = Math.abs(ax - bx);
    if (typeof worldWidth !== 'number') return dx;
    return Math.min(dx, worldWidth - dx);
  }

  // Helper to clamp label bounds within screen with edge padding
  static _clampBounds(x, w, screenWidth, edgePad = 4) {
    let left = Math.round(x - w / 2);
    let right = Math.round(x + w / 2);
    if (left < edgePad) { right += (edgePad - left); left = edgePad; }
    if (right > screenWidth - edgePad) { left -= (right - (screenWidth - edgePad)); right = screenWidth - edgePad; }
    // Ensure left doesn't go negative after double-clamping (when label is too wide)
    if (left < edgePad) left = edgePad;
    return { left, right, center: Math.round((left + right) / 2) };
  }

  // Check if bounds overlap with any placed labels
  static _checkOverlap(left, right, placedLabels, gap = 6) {
    for (let i = 0; i < placedLabels.length; i++) {
      const p = placedLabels[i];
      if (!(right + gap < p.left || left - gap > p.right)) return true;
    }
    return false;
  }

  static _hasNearbyOfType(pos, type, radiusX) {
    const r = radiusX || MapLabel.DETECTION_RADIUS_X;
    for (const l of MapLabel.labels) {
      if (l.type !== type) continue;
      const dx = MapLabel._wrapDx(l.pos.x, pos.x);
      if (dx < r) return true;
    }
    return false;
  }

  // Legacy methods removed - now using drawBottomOverlay() exclusively

  // Draw labels projected to the bottom of the screen, centered under their feature X
  static drawBottomOverlay() {
    if (!MapLabel.labels.length) return;
    if (typeof cameraOffset === 'undefined') return;
    // Ensure cached layout exists and is current
    MapLabel._ensureLayout();

    push();
    textAlign(CENTER, BOTTOM);
    textSize(MapLabel._lastTextSize);
    fill(255);

    const baselineY = height - 18;
    // Draw bottom labels
    const placedBottom = MapLabel._layoutCache.placedBottom;
    for (let i = 0; i < placedBottom.length; i++) {
      const p = placedBottom[i];
      text(p.text, p.center, baselineY);
    }

    // Draw above-feature labels, adding current camera shake Y to cached baseY
    const placedAbove = MapLabel._layoutCache.placedAbove;
    const cameraShakeY = (typeof window !== 'undefined' && typeof window.lastCameraShakeY === 'number') ? window.lastCameraShakeY : 0;
    for (let i = 0; i < placedAbove.length; i++) {
      const p = placedAbove[i];
      text(p.text, p.center, p.baseY + cameraShakeY);
    }

    pop();
  }

  static _ensureLayout() {
    const cam = cameraOffset | 0; // integer snap for stability
    const w = width | 0, h = height | 0;
    const needRecalc = (
      MapLabel._layoutCache.camOffset !== cam ||
      MapLabel._layoutCache.width !== w ||
      MapLabel._layoutCache.height !== h ||
      MapLabel._layoutCache.labelsVersion !== MapLabel._labelsVersion ||
      MapLabel._layoutCache.textSize !== MapLabel._lastTextSize
    );
    if (!needRecalc) return;
  MapLabel._layoutCache.camOffset = cam;
  MapLabel._layoutCache.width = w;
  MapLabel._layoutCache.height = h;
  MapLabel._layoutCache.labelsVersion = MapLabel._labelsVersion;

  // Recompute placement (this will invalidate per-label widths if text size changed)
  MapLabel._computeLayout();
  MapLabel._layoutCache.textSize = MapLabel._lastTextSize;
  }

  static _computeLayout() {
    // Reuse scratch arrays
    const bottomCandidates = MapLabel._tmpBottom; bottomCandidates.length = 0;
    const aboveCandidates = MapLabel._tmpAbove; aboveCandidates.length = 0;
    const padX = 10;
    const bottomThreshold = 50; // if feature is within this many px of bottom, draw above feature

    // Text settings and width cache invalidation if size changed
    const textSz = MapLabel._lastTextSize;
    const prevTextSize = MapLabel._layoutCache.textSize;
    textSize(textSz);
    if (prevTextSize !== textSz) {
      for (let i = 0; i < MapLabel.labels.length; i++) {
        MapLabel.labels[i]._textWidth = null;
        MapLabel.labels[i]._boxWidth = null;
      }
    }

    // Collect candidates (classify using surface Y without shake to avoid jitter)
    for (let i = 0; i < MapLabel.labels.length; i++) {
      const l = MapLabel.labels[i];
      const screenX = l.pos.x - cameraOffset;
      if (screenX < 0 || screenX > width) continue;
      const surfY = (typeof getCachedSurfaceYAtX === 'function') ? getCachedSurfaceYAtX(l.pos.x) : height;

      if (l._textWidth == null) {
        const tw = (typeof textWidth === 'function') ? textWidth(l.name) : (l.name?.length || 5) * 8;
        l._textWidth = Math.max(1, tw);
        l._boxWidth = Math.max(40, l._textWidth + padX * 2);
      }
      const w = l._boxWidth;
      const data = { x: screenX, w, text: l.name, type: l.type, surfY };
      // Base labels must always be at the bottom overlay (never above-feature)
      if (l.type === 'base') {
        bottomCandidates.push(data);
      } else if (surfY > height - bottomThreshold) {
        aboveCandidates.push(data);
      } else {
        bottomCandidates.push(data);
      }
    }

  // Sort left-to-right. We'll place base labels first to give them priority.
  bottomCandidates.sort((a, b) => a.x - b.x);
    aboveCandidates.sort((a, b) => a.x - b.x);

    // Bottom row placement - partition bases vs non-bases in single pass
    const placedBottom = MapLabel._layoutCache.placedBottom; placedBottom.length = 0;
    const gap = 6;
    const maxBottom = 10;
    // Single-pass partition: bases first, then others
    const orderedBottom = [];
    for (let i = 0; i < bottomCandidates.length; i++) {
      if (bottomCandidates[i].type === 'base') orderedBottom.push(bottomCandidates[i]);
    }
    for (let i = 0; i < bottomCandidates.length; i++) {
      if (bottomCandidates[i].type !== 'base') orderedBottom.push(bottomCandidates[i]);
    }
    for (let i = 0; i < orderedBottom.length; i++) {
      if (placedBottom.length >= maxBottom) break;
      const c = orderedBottom[i];
      const bounds = MapLabel._clampBounds(c.x, c.w, width);
      if (MapLabel._checkOverlap(bounds.left, bounds.right, placedBottom, gap)) continue;
      placedBottom.push({ left: bounds.left, right: bounds.right, center: bounds.center, text: c.text });
    }

    // Above-feature placement (cap count). Avoid overlap with already placed bottom labels and enforce vertical separation.
    const placedAbove = MapLabel._layoutCache.placedAbove; placedAbove.length = 0;
    const baselineY = height - 18;
    const minVerticalSeparation = 28; // px above bottom baseline to avoid near-overlap
    for (let i = 0; i < aboveCandidates.length; i++) {
      if (placedAbove.length >= MapLabel.MAX_ABOVE_LABELS) break;
      const c = aboveCandidates[i];
      const tw = Math.max(1, c.w - padX * 2);
      const bounds = MapLabel._clampBounds(c.x, tw, width);
      // Check overlap with both above and bottom labels
      if (MapLabel._checkOverlap(bounds.left, bounds.right, placedAbove, gap) ||
          MapLabel._checkOverlap(bounds.left, bounds.right, placedBottom, gap)) {
        continue;
      }
      // Clamp Y so it sits clearly above the bottom baseline
      const unclampedY = Math.round(c.surfY - 22);
      const baseY = Math.max(16, Math.min(unclampedY, baselineY - minVerticalSeparation));
      placedAbove.push({ left: bounds.left, right: bounds.right, center: bounds.center, text: c.text, baseY });
    }
  }
}

class MoonBase {
  static BASE_HEIGHT = 20;
  static BASE_WIDTH = 100;
  static moonBases = [];
  static maxBalloons = 0;
  static generateNameForBase(x, id) {
    try {
      // Use MapLabel generator with slight id offset to ensure uniqueness
      const baseName = MapLabel.generateName(x + id * 31, 'base');
      return baseName && baseName.trim() ? baseName : `Base ${id}`;
    } catch (e) {
      return `Base ${id}`;
    }
  }

  constructor(width, height, pos) {
    this.width = width;
    this.height = height;
    this.towerWidth = 10;
    this.towerHeight = 30;
    this.radarDishRadius = 15;
    this.radarAngle = 0;
    this.pos = pos || this.findSuitableLocation();
    this.health = 100;
    this.maxHealth = 100;
    this.healRate = 1;
    this.balloons = [];
    
    // Drone defense properties
  this.drone = null;
  this.droneRespawnTime = 1200; // 20 seconds at 60fps
  this.droneRespawnCooldown = this.droneRespawnTime; // New bases wait for first drone
    this.dronePatrolRadius = 300; // How far drone can move from base

    MoonBase.moonBases.push(this);
    this.id = MoonBase.moonBases.length;
    // Assign deterministic, individual base name
    this.name = MoonBase.generateNameForBase(this.pos.x, this.id);
    // Ensure uniqueness if a duplicate occurs (append roman numerals)
    let duplicateCount = 1;
    while (MoonBase.moonBases.some(b => b !== this && b.name === this.name)) {
      duplicateCount++;
      this.name = `${MoonBase.generateNameForBase(this.pos.x + duplicateCount * 17, this.id)} ${'I'.repeat(duplicateCount)}`;
      if (duplicateCount > 5) break; // safety cap
    }

    GameTimer.create(`moonbase_heal_${this.id}`, () => this.heal(), 3000, true);
    GameTimer.create(`moonbase_balloon_${this.id}`, () => this.launchBarrageBalloon(), 10000, true);
  }

static updateAll() {
  for (let i = MoonBase.moonBases.length - 1; i >= 0; i--) {
    const base = MoonBase.moonBases[i];
    base.update();
    if (base.health <= 0) {
      soundManager.play('moonBaseDestruction');
      RuinedBase.createFromMoonBase(base);
      GameTimer.clearTimer(`moonbase_heal_${base.id}`);
      GameTimer.clearTimer(`moonbase_balloon_${base.id}`);
      if (base.drone) {
        base.drone.destroy();
      }
      MoonBase.moonBases.splice(i, 1);
    }
  }
}

  static drawAll() {
    for (const base of MoonBase.moonBases) {
      if (isInView(base.pos, Math.max(base.width, base.height))) {
        for (const balloon of base.balloons) {
          isInView(balloon.pos, balloon.size) && balloon.draw();
        }
        if (base.drone && base.drone.active) {
          base.drone.draw();
        }
        base.draw();
      }
    }
  }

  static createFromNest(nest) {
    if (!nest || !nest.pos) return;
    // pos.x should be at center, pos.y should be at bottom (adjusted for height)
    const newBasePos = nest.pos.copy().sub(0, (MoonBase.BASE_HEIGHT / 2) - 10);
    new MoonBase(MoonBase.BASE_WIDTH, MoonBase.BASE_HEIGHT, newBasePos);
  }

  static resetBases() {
    MoonBase.moonBases = [];
  }

findSuitableLocation() {
  const flattestSegment = this.findFlattestSegment();
  if (flattestSegment !== null) {
    const start = moonSurface[flattestSegment];
    const end = moonSurface[flattestSegment + 1];
    const avgX = (start.x + end.x) / 2; // Center horizontally
    const avgY = (start.y + end.y) / 2;
    return createVector(avgX, avgY - this.height);
  }

  const baseSegmentIndex = floor(random(moonSurface.length - 1));
  const start = moonSurface[baseSegmentIndex];
  const end = moonSurface[baseSegmentIndex + 1];
  const avgX = (start.x + end.x) / 2; // Center horizontally
  return createVector(avgX, (start.y + end.y) / 2 - this.height);
}


  findFlattestSegment() {
    let flattestSegment = null;
    let lowestSlope = Infinity;
    const baseWidth = this.width || MoonBase.BASE_WIDTH; // Use the base width for evaluation
    
    // Evaluate regions that can accommodate the full base width
    for (let i = 0; i < moonSurface.length - 1; i++) {
      const startPoint = moonSurface[i];
      
      // Find the end of the region that spans at least the base width
      let endIndex = i + 1;
      let regionWidth = moonSurface[endIndex].x - startPoint.x;
      
      // Extend the region until it spans at least the base width
      while (endIndex < moonSurface.length - 1 && regionWidth < baseWidth) {
        endIndex++;
        regionWidth = moonSurface[endIndex].x - startPoint.x;
      }
      
      // Skip if we couldn't find a wide enough region
      if (regionWidth < baseWidth) continue;
      
      const endPoint = moonSurface[endIndex];
      
      // Calculate the average slope across all segments in this region
      let totalSlope = 0;
      let segmentCount = 0;
      for (let j = i; j < endIndex; j++) {
        const segStart = moonSurface[j];
        const segEnd = moonSurface[j + 1];
        const segWidth = segEnd.x - segStart.x;
        if (segWidth > 0) {
          totalSlope += Math.abs((segEnd.y - segStart.y) / segWidth);
          segmentCount++;
        }
      }
      
      const avgSlope = segmentCount > 0 ? totalSlope / segmentCount : Infinity;
      
      // Track the flattest region
      if (avgSlope < lowestSlope) {
        flattestSegment = i;
        lowestSlope = avgSlope;
      }
    }
    
    return flattestSegment;
  }


  draw() {
    push();
    fill(100, 100, 255);
    // Draw base centered around pos.x (middle bottom)
    const baseLeft = this.pos.x - this.width / 2;
    rect(baseLeft, this.pos.y, this.width, this.height);
    fill(150, 150, 255);
    const towerX = baseLeft + this.width - this.towerWidth;
    const towerY = this.pos.y - this.towerHeight;
    rect(towerX, towerY, this.towerWidth, this.towerHeight);

    push();
    translate(towerX + this.towerWidth / 2, towerY);
    rotate(this.radarAngle);
    fill(200, 200, 255);
    arc(0, 4, this.radarDishRadius * 2, this.radarDishRadius * 2, PI, TWO_PI);
    pop();

    //fill(255, 0, 0);
    //rect(baseLeft, this.pos.y, 100 - this.health, 5);

     const healthBarWidth = this.width; // Full base width
     const healthBarHeight = 5;
     const damagePercentage = 1 - (this.health / this.maxHealth); // How much damage has been taken

     // Draw damage bar (red, grows as damage increases)
    fill(255, 0, 0);
    rect(baseLeft, this.pos.y, healthBarWidth * damagePercentage, healthBarHeight);
    pop();

  }


  update() {
    this.radarAngle = (this.radarAngle + 0.02) % TWO_PI;

    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const balloon = this.balloons[i];
      if (balloon.update() || balloon.health <= 0) {
        balloon.health <= 0 && balloon.explode();
        this.balloons.splice(i, 1);
      }
    }
    // Launch balloons only if needed
    this.balloons.length < MoonBase.maxBalloons && this.launchBarrageBalloon();

    // Manage drone
    if (this.drone && !this.drone.active) {
      this.drone = null;
    }
    
    if (!this.drone && this.droneRespawnCooldown <= 0) {
      this.launchDrone();
    }
    
    if (this.droneRespawnCooldown > 0) {
      this.droneRespawnCooldown--;
    }
    
    if (this.drone) {
      this.drone.update();
    }
  }

  heal() {
    this.health < this.maxHealth && (this.health = Math.min(this.health + this.healRate, this.maxHealth));
  }

  launchBarrageBalloon() {
      for (let i = this.balloons.length; i < MoonBase.maxBalloons; i++) {
        const launchPos = createVector(this.pos.x + random(-this.width / 2, this.width / 2), this.pos.y);
        this.balloons.push(new BarrageBalloon(launchPos));
      }
  }
  
  launchDrone() {
    if (this.drone) return; // Already has a drone
    
    // Tower is at right edge: pos.x (center) + width/2 (right edge) - towerWidth/2 (tower center)
    const dronePos = createVector(
      this.pos.x + this.width / 2 - this.towerWidth / 2,
      this.pos.y - this.towerHeight - 20
    );
    this.drone = new BaseDrone(dronePos, createVector(0, 0), 12, this);
    this.drone.active = true;
  }
  
  onDroneDestroyed() {
    this.drone = null;
    this.droneRespawnCooldown = this.droneRespawnTime;
  }
}

class RuinedBase {
  static ruinedBases = [];

  constructor(pos, width, height) {
    this.pos = pos.copy();
    this.width = width;
    this.height = height;
    this.towerWidth = 10;
    this.towerHeight = 30;
    this.radarDishRadius = 15;
    
    // Randomize destruction details
    this.towerAngle = random(-PI/3, PI/3);
    this.radarDishBreakPoint = random(0, TWO_PI);
    this.holePositions = this.generateHoles();
    this.crackPositions = this.generateCracks();
    this.debrisPositions = this.generateDebris();
    
    // Create the final rendered image
    this.renderedImage = this.createRenderedImage();
  }

  generateHoles() {
    let holes = [];
    let holeCount = floor(random(3, 7));
    for (let i = 0; i < holeCount; i++) {
      holes.push({
        x: random(this.width),
        y: random(this.height),
        size: random(5, 20)
      });
    }
    return holes;
  }

  generateCracks() {
    let cracks = [];
    let crackCount = floor(random(4, 8));
    for (let i = 0; i < crackCount; i++) {
      let startX = random(this.width);
      let startY = random(this.height);
      let points = [{x: startX, y: startY}];
      let length = random(20, 50);
      let angle = random(TWO_PI);
      for (let j = 0; j < length; j += 5) {
        angle += random(-PI/4, PI/4);
        points.push({
          x: startX + cos(angle) * j,
          y: startY + sin(angle) * j
        });
      }
      cracks.push(points);
    }
    return cracks;
  }

  generateDebris() {
    let debris = [];
    let debrisCount = floor(random(10, 20));
    for (let i = 0; i < debrisCount; i++) {
      debris.push({
        x: random(this.width),
        y: random(this.height),
        size: random(2, 8),
        angle: random(TWO_PI)
      });
    }
    return debris;
  }

  createRenderedImage() {
    let finalGraphics = createGraphics(this.width, this.height + this.towerHeight);

    // Draw holes
    finalGraphics.fill(30);
    for (let hole of this.holePositions) {
      finalGraphics.ellipse(hole.x, hole.y + this.towerHeight, hole.size);
    }

    // Draw cracks
    finalGraphics.stroke(30);
    finalGraphics.strokeWeight(2);
    for (let crack of this.crackPositions) {
      finalGraphics.beginShape();
      for (let point of crack) {
        finalGraphics.vertex(point.x, point.y + this.towerHeight);
      }
      finalGraphics.endShape();
    }

    // Draw debris
    finalGraphics.noStroke();
    finalGraphics.fill(80);
    for (let debris of this.debrisPositions) {
      finalGraphics.push();
      finalGraphics.translate(debris.x, debris.y + this.towerHeight);
      finalGraphics.rotate(debris.angle);
      finalGraphics.rect(-debris.size/2, -debris.size/2, debris.size, debris.size);
      finalGraphics.pop();
    }

    // Draw tilted control tower
    finalGraphics.push();
    finalGraphics.translate(this.width - this.towerWidth, this.towerHeight);
    finalGraphics.rotate(this.towerAngle);
    finalGraphics.fill(150, 150, 150);
    finalGraphics.rect(0, -this.towerHeight, this.towerWidth, this.towerHeight);
    finalGraphics.pop();

    // Draw broken radar dish
    finalGraphics.push();
    finalGraphics.translate(this.width - this.towerWidth / 2, this.towerHeight);
    finalGraphics.fill(200, 200, 200);
    finalGraphics.arc(0, 0, this.radarDishRadius * 2, this.radarDishRadius * 2, PI, PI + this.radarDishBreakPoint);
    finalGraphics.pop();

    return finalGraphics;
  }

  draw() {
    // Draw the pre-rendered image centered around pos.x
    image(this.renderedImage, this.pos.x - this.width / 2, this.pos.y - this.towerHeight);
  }

  static createFromMoonBase(moonBase) {
    const ruinedBase = new RuinedBase(moonBase.pos, moonBase.width, moonBase.height);
    RuinedBase.ruinedBases.push(ruinedBase);
  }

  static updatePositions() {
    for (let base of RuinedBase.ruinedBases) {
  base.pos.y = getCachedSurfaceYAtX(base.pos.x);
    }
  }

  static drawAll() {
    for (let base of RuinedBase.ruinedBases) {
      if (isInView(base.pos, Math.max(base.width, base.height + base.towerHeight))) {
        base.draw();
      }
    }
  }
}

class RuinedShip {
  static ruinedShips = [];

  constructor(pos, size) {
    this.pos = pos.copy();
    this.size = size;
    this.angle = random(-PI/4, PI/4);
    this.debrisPositions = this.generateDebris();
    this.crackPositions = this.generateCracks();
    this.renderedImage = this.createRenderedImage();
    this.dropOntoSurface();
  }

  generateDebris() {
    let debris = [];
    let debrisCount = floor(random(15, 25)); // Reduced debris count
    for (let i = 0; i < debrisCount; i++) {
      debris.push({
        x: random(-this.size, this.size),
        y: random(-this.size, this.size),
        size: random(2, 6),
        angle: random(TWO_PI)
      });
    }
    return debris;
  }

  generateCracks() {
    let cracks = [];
    let crackCount = floor(random(9, 25)); // Reduced crack count
    for (let i = 0; i < crackCount; i++) {
      let startX = random(-this.size/2, this.size/2);
      let startY = random(-this.size/2, this.size/2);
      let points = [{x: startX, y: startY}];
      let length = random(4, 12);
      let angle = random(TWO_PI);
      for (let j = 0; j < length; j += 5) {
        angle += random(-PI/4, PI/4);
        points.push({
          x: startX + cos(angle) * j,
          y: startY + sin(angle) * j
        });
      }
      cracks.push(points);
    }
    return cracks;
  }

  createRenderedImage() {
    let graphics = createGraphics(this.size * 2, this.size * 2);
    graphics.translate(this.size, this.size);
    graphics.rotate(this.angle);

    // Draw ship outline
    graphics.strokeWeight(2);
    graphics.stroke(200);
    //graphics.noFill();
    graphics.triangle(-this.size / 2, -this.size / 2, this.size, 0, -this.size / 2, this.size / 2);

    // Draw cracks
    graphics.stroke(100);
    graphics.strokeWeight(1);
    for (let crack of this.crackPositions) {
      graphics.beginShape();
      for (let point of crack) {
        graphics.vertex(point.x, point.y);
      }
      graphics.endShape();
    }

    // Draw debris
    graphics.noStroke();
    graphics.fill(150);
    for (let debris of this.debrisPositions) {
      graphics.push();
      graphics.translate(debris.x, debris.y);
      graphics.rotate(debris.angle);
      graphics.rect(-debris.size/2, -debris.size/2, debris.size, debris.size);
      graphics.pop();
    }

    return graphics;
  }



  dropOntoSurface() {
    const surfaceY = getCachedSurfaceYAtX(this.pos.x);
    this.pos.y = surfaceY - this.size / 2;
  }

  static createFromShip(ship) {
    const ruinedShip = new RuinedShip(ship.pos, ship.size);
    RuinedShip.ruinedShips.push(ruinedShip);
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    image(this.renderedImage, -this.size, -this.size);
    pop();
  }

  static drawAll() {
    for (let ship of RuinedShip.ruinedShips) {
      if (isInView(ship.pos, ship.size * 2)) {
        ship.draw();
      }
    }
  }

  static updatePositions() {
    for (let ship of RuinedShip.ruinedShips) {
      ship.dropOntoSurface();
    }
  }
}

class Astronaut extends Entity {

  constructor(pos, size) {
    super(pos, createVector(0, 0), size);
    this.uniqueId = 'astronaut-main'; // Unique identifier for serialization
    this.walkSpeed = 2;
    this.sprite = this.createSprite(color(255));
    this.hasGrabbedPod = false;
    this.isInShip = true;
    this.facing = 1; // 1 for right, -1 for left
    this.targetAngle = 0;
    this.targetLineLength = 15; // Shorter targeting line
    this.targetLineOffset = 15; // Offset from astronaut's body
    
    // Jump-related properties
    this.jumpForce = -2.5; // Negative because y-axis is inverted
    this.isJumping = false;
    this.jumpCooldown = 0;
    this.jumpCooldownTime = 30; // 0.5 seconds at 60 fps
    this.horizontalJumpSpeed = 4; // Horizontal speed during jump
    
    //Throwing
    this.bombThrowCooldown = 0;
    this.bombThrowCooldownTime = 20;
    this.bombThrowStartTime = 0;
    this.maxThrowStrength = 10; // Maximum throw strength
    this.minThrowStrength = 1;  // Minimum throw strength
    this.maxHoldTime = 800;    // Time in milliseconds to reach max strength
    this.isHoldingBombThrow = false;
    
    this.ridingWalker = null;
  }


  createSprite(spriteColor) {
    let sprite = createGraphics(20, 30);
    sprite.fill(spriteColor);
    sprite.noStroke();
    sprite.ellipse(10, 8, 16, 16); // Head
    sprite.rect(6, 16, 8, 12); // Body
    sprite.rect(2, 16, 4, 8); // Left arm
    sprite.rect(14, 16, 4, 8); // Right arm
    sprite.rect(6, 28, 3, 6); // Left leg
    sprite.rect(11, 28, 3, 6); // Right leg
    return sprite;
  }

  updateSpriteColor() {
    let spriteColor;
    if (this.walkSpeed < 2) {
      spriteColor = color(0, 255, 0); // Slow
    } 
    if (this.walkSpeed == 2) {
      spriteColor = color(255); // White normal
    } 
    if (this.walkSpeed == 3) {
      spriteColor = color(255, 255, 200);
    }
    if (this.walkSpeed == 4) {
      spriteColor = color(255, 200, 200);
    }

    this.sprite = this.createSprite(spriteColor);
  }

  update() {
    this.constrainToWorld();

    // Apply gravity if jumping
    if (this.isJumping) {
      this.vel.y += gravity.y;
    } else {
      // If not jumping, follow the moon surface
  let surfaceY = getCachedSurfaceYAtX(this.pos.x + this.vel.x);
      this.vel.y = surfaceY - (this.pos.y + this.size / 2);
    }
      
 super.update();
    this.pos.x = (this.pos.x + worldWidth) % worldWidth; // Wrap around the world
    
    // Check for landing
  let surfaceY = getCachedSurfaceYAtX(this.pos.x);
    if (this.pos.y + this.size / 2 >= surfaceY) {
      this.pos.y = surfaceY - this.size / 2;
      this.vel.y = 0;
      this.isJumping = false;
    }

    // Constrain to world bounds after position updates to prevent drifting out of bounds
    this.constrainToWorld();

    if (cameraFollowsMissile || cameraFollowsDrone) return; // Disable controls if missile or drone active
    
    if (this.ridingWalker) {
      // Update position based on the walker's position
      this.pos.x = this.ridingWalker.pos.x;
      this.pos.y = this.ridingWalker.pos.y - this.ridingWalker.bodyHeight - this.size / 2;
      
      
      if (keyIsDown(LEFT_ARROW)) {
      this.facing = -1;
    } else if (keyIsDown(RIGHT_ARROW)) {
      this.facing = 1;
    }
      
    } else {
      
    // Handle horizontal movement
    if (keyIsDown(LEFT_ARROW)) {
      this.vel.x = -this.walkSpeed;
      this.facing = -1;
    } else if (keyIsDown(RIGHT_ARROW)) {
      this.vel.x = this.walkSpeed;
      this.facing = 1;
    } else {
      this.vel.x = 0;
    }
      
    
          // Handle jumping
    if (this.jumpCooldown > 0) {
      this.jumpCooldown--;
    }
    
    if (keyIsDown(90) && !this.isJumping && this.jumpCooldown === 0) { // 90 is the keyCode for 'z'
      this.jump();
    }
    

      
      
      
    }

    // Adjust target angle - only if camera is not following missile/drone
    if (!cameraFollowsMissile && !cameraFollowsDrone) {
      if (keyIsDown(UP_ARROW)) {
        this.targetAngle = max(this.targetAngle - 0.05, -PI / 2);
      } else if (keyIsDown(DOWN_ARROW)) {
        this.targetAngle = min(this.targetAngle + 0.05, PI / 2);
      }
    }
    

    
    // Check for bomb throw release
    if (this.isHoldingBombThrow && !keyIsDown(32)) { // 32 is spacebar
      this.releaseBombThrow();
    }
    
   
    
    if (this.hasGrabbedPod && pod) {
      pod.pos = this.pos.copy();
      pod.pos.y -= this.size / 2 + 5; // Position pod above astronaut's head
    }
    
    this.checkPodInteraction();
    this.checkBaseInteraction();
    
    if (this.bombThrowCooldown > 0) {
      this.bombThrowCooldown--;
    }
  }

  constrainToWorld() {
    // Constrain horizontal position (wrapping is handled elsewhere)
    this.pos.x = constrain(this.pos.x, 0, worldWidth);
    
    // Constrain vertical position and reset velocity when hitting boundaries
    if (this.pos.y < this.size / 2) {
      this.pos.y = this.size / 2;
      this.vel.y = 0; // Stop upward movement when hitting top boundary
    }
    if (this.pos.y > height - this.size / 2) {
      this.pos.y = height - this.size / 2;
      this.vel.y = 0; // Stop downward movement when hitting bottom boundary
    }
  }

  checkWalkerInteraction() {
    if (this.ridingWalker) {
      this.dismountWalker();
    } else {
      let nearestWalker = this.findNearestWalker();
      if (nearestWalker && this.isCloseToWalker(nearestWalker)) {
        this.mountWalker(nearestWalker);
      }
    }
  }

  findNearestWalker() {
    let nearestWalker = null;
    let minDistance = Infinity;
    
    for (let walker of WalkerRobot.walkers) {
      // Use squared distance to avoid sqrt
      const dx = this.pos.x - walker.pos.x;
      const dy = this.pos.y - walker.pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistance * minDistance) {
        minDistance = Math.sqrt(distSq); // Only calculate sqrt when we find a new minimum
        nearestWalker = walker;
      }
    }
    
    return nearestWalker;
  }

  isCloseToWalker(walker) {
    const dx = this.pos.x - walker.pos.x;
    const dy = this.pos.y - walker.pos.y;
    const distSq = dx * dx + dy * dy;
    const threshold = this.size + walker.size;
    return distSq < threshold * threshold;
  }

  mountWalker(walker) {
    this.ridingWalker = walker;
    this.isRidingWalker = true;
    walker.rider = this;
    walker.hasRider = true;
  }

  dismountWalker() {
    if (this.ridingWalker) {
      this.ridingWalker.rider = null;
      this.ridingWalker.hasRider = false;
      this.ridingWalker = null;
      this.isRidingWalker = false;
      // Smoothly settle onto surface after dismount
      const targetY = getCachedSurfaceYAtX(this.pos.x) - this.size / 2;
      this.pos.y = lerp(this.pos.y, targetY, 0.6);
    }
  }

  draw() {
    if (this.isInShip) return; // Skip drawing if in ship
    
      push();
      translate(this.pos.x, this.pos.y);
      scale(this.facing, 1); // Flip the sprite based on facing
      image(this.sprite, -this.size / 2, -this.size / 2);
      pop();
      
      // Draw targeting line
      stroke(255); // White color
      strokeWeight(1);
      let lineStart = createVector(
        this.pos.x + this.facing * this.targetLineOffset * cos(this.targetAngle),
        this.pos.y + this.targetLineOffset * sin(this.targetAngle)
      );
      let lineEnd = createVector(
        lineStart.x + this.facing * this.targetLineLength * cos(this.targetAngle),
        lineStart.y + this.targetLineLength * sin(this.targetAngle)
      );
      line(lineStart.x, lineStart.y, lineEnd.x, lineEnd.y);
      noStroke();

      // Draw pod if astronaut is carrying it
      if (this.hasGrabbedPod && pod) {
        fill(255, 0, 0);
        ellipse(this.pos.x, this.pos.y - this.size / 2 - 5, pod.size / 2, pod.size / 2);
      }
  }
  
  placeDrillRig() {
  if (energy >= 100) {
  let rigPos = createVector(this.pos.x, getCachedSurfaceYAtX(this.pos.x) - 15);
    if (DrillRig.placeRig(rigPos)) {
      energy -= 100;
    }
}
}
  
  
  

  jump() {
    this.vel.y = this.jumpForce;
    this.isJumping = true;
    this.jumpCooldown = this.jumpCooldownTime;
    
    // Preserve horizontal momentum when jumping
    if (keyIsDown(LEFT_ARROW)) {
      this.vel.x = -this.horizontalJumpSpeed;
    } else if (keyIsDown(RIGHT_ARROW)) {
      this.vel.x = this.horizontalJumpSpeed;
    }
    
    soundManager.play('astronautJump');
  }
  
    dropBase() {
      let basePos = this.pos.copy();
  basePos.y = getCachedSurfaceYAtX(basePos.x);
      new MoonBase(MoonBase.BASE_WIDTH, MoonBase.BASE_HEIGHT, basePos);
      soundManager.play('shipDropOffPod');
      announcer.speak("Base deployed",0, 1,1000);
  }
  
  startBombThrow() {
    if (this.bombThrowCooldown <= 0 && energy >= 50) {
      this.bombThrowStartTime = millis();
      this.isHoldingBombThrow = true;
    }
  }

  releaseBombThrow() {
    if (this.bombThrowCooldown <= 0 && energy >= 50) {
      let holdTime = millis() - this.bombThrowStartTime;
      let throwStrength = map(
        holdTime,
        0,
        this.maxHoldTime,
        this.minThrowStrength,
        this.maxThrowStrength
      );
      throwStrength = constrain(throwStrength, this.minThrowStrength, this.maxThrowStrength);

      let bombStartPos = createVector(
        this.pos.x + this.facing * this.targetLineOffset * cos(this.targetAngle),
        this.pos.y + this.targetLineOffset * sin(this.targetAngle)
      );

      let bombVel = createVector(
        throwStrength * this.facing * cos(this.targetAngle),
        throwStrength * sin(this.targetAngle)
      );

      bombs.push(new Bomb(bombStartPos, bombVel, 10));
      
      energy -= 50;
      this.bombThrowCooldown = this.bombThrowCooldownTime;
      //soundManager.play('shipBomb');
    }
    this.isHoldingBombThrow = false;
  }
  
  
  leaveShip() {
    this.isInShip = false;
    this.facing = random() < 0.5 ? -1 : 1; // Random initial facing
    this.targetAngle = -PI / 2; // Reset target angle to straight up when leaving ship
  }

  checkPodInteraction() {
    if (!pod || !this.hasGrabbedPod && !pod.isPickedUp() && this.isNearPod()) {
      this.grabPod();
    }
  }

  isNearPod() {
    if (!pod) return false;
    return dist(this.pos.x, this.pos.y, pod.pos.x, pod.pos.y) < this.size / 2 + pod.size / 2;
  }

  grabPod() {
    if (!pod) return;
    this.hasGrabbedPod = true;
    pod.updatePickupState('astronaut');
    money += 50;
  }

  checkBaseInteraction() {
    if (this.hasGrabbedPod) {
      for (let base of MoonBase.moonBases) {
        if (this.isOverBase(base)) {
          this.dropOffPod(base);
          break;
        }
      }
    }
  }

  isOverBase(base) {
    // base.pos.x is now at center, so check if within half width on each side
    return this.pos.x > base.pos.x - base.width / 2 && 
           this.pos.x < base.pos.x + base.width / 2 &&
           Math.abs(this.pos.y - (base.pos.y - this.size / 2)) < 20;
  }

  dropOffPod(base) {
    if (!pod || !this.hasGrabbedPod) return; // Safety check
    
    this.hasGrabbedPod = false;
    pod.updatePickupState(null); // Reset the pod's pickup state
    money += 500; // Bonus for delivering pod to base
    energy += 5000; // Energy bonus for pod delivery
    
    if (energy >= maxEnergy){
      energy = maxEnergy;
    }
    soundManager.play('shipDropOffPod');
    
    // Immediately place the pod on the surface
    placePodOnSurface();
  }
  
  placeShield() {
    energy -= 50;
  let shieldPos = createVector(this.pos.x, getCachedSurfaceYAtX(this.pos.x));
    Shield.createShield(shieldPos);
  }

  placeTurret() {
    const MAX_TURRETS = 5; // Maximum number of turrets allowed
  let turretPos = createVector(this.pos.x, getCachedSurfaceYAtX(this.pos.x) - 15);
    
    if (turrets.length < MAX_TURRETS) {
      turrets.push(new Turret(turretPos));
    } else {
      turrets.shift(); // Remove the oldest turret
      turrets.push(new Turret(turretPos));
    }
  }
  
  isCloseToShip() {
    return dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y) < this.size + ship.size;
  }
}

class Ship extends Entity {
  // Static flag to allow global disabling of thrust (e.g., during lightning storms)
  static enginesLocked = false;
  constructor(pos, vel, size) {
    super(pos, vel, size);
    this.angle = -PI / 2;
    this.hasGrabbedPod = false;
    this.isLanded = false;
    this.thrustPower = 0.1;
    this.rotationSpeed = 0.05;
    this.bulletSpeed = 10;
    this.bombSpeed = 1;
    this.safeLandingVelocity = 2.5;
    this.frictionCoefficient = 0.995;
    this.hasParachute = true;
    this.parachuteDeployed = false;
    this.parachuteSize = this.size * 3;
    this.parachuteDrag = 0.01;
    this.isZapped = false;
    this.zapTimer = 0;
    this.isMainShip = false;
    this.particleCount = 3;
  }

  update() {
    if (!this.isLanded) {
      this.applyPhysics();
      this.applyWind();
      this.applyFriction();
    }

    this.handleInput();

    this.zapTimer--;
    this.zapTimer <= 0 && (this.isZapped = false);

    this.handlePodInteraction();
    this.constrainToWorld();
    this.parachuteDeployed && this.applyParachuteDrag();

    if (this.isMainShip) {
      this.isThrusting && !this.isLanded && !this.isZapped ? soundManager.loopIfNotPlaying('shipThrust') : soundManager.stop('shipThrust');
    }
  }

  dropBase() {
    if (money > 500) {
      money -= 500;
      // basePos.x is at center of ship, which becomes center of base
      const basePos = this.pos.copy();
      basePos.y = getCachedSurfaceYAtX(basePos.x);
      new MoonBase(MoonBase.BASE_WIDTH, MoonBase.BASE_HEIGHT, basePos);
      soundManager.play('shipDropOffPod');
      announcer.speak("Base deployed", 0, 1, 1000);
      // Immediately update feature labels
      try { if (typeof MapLabel !== 'undefined') MapLabel.scanWorld(); } catch(e) { /* ignore */ }
    }
  }

  applyPhysics() {
    this.vel.add(gravity);
    super.update();
    if (this.pos.y + this.size / 2 > this.getSurfaceY()) {
      this.checkImpact();
    }
  }

  applyFriction() {
    !this.isThrusting && this.vel.mult(this.frictionCoefficient);
  }

  applyWind() {
    const windForce = this.parachuteDeployed ? wind.copy().mult(5) : wind.copy();
    this.vel.add(windForce);
  }

  handleInput() {
    if (cameraFollowsMissile || cameraFollowsDrone) return;

    const isStormActive = magneticStorm.isStormActive();
    const upKey = isStormActive ? DOWN_ARROW : UP_ARROW;
    const leftKey = isStormActive ? RIGHT_ARROW : LEFT_ARROW;
    const rightKey = isStormActive ? LEFT_ARROW : RIGHT_ARROW;

    keyIsDown(upKey) ? this.thrust() : (this.isThrusting = false);
    keyIsDown(leftKey) && this.rotate(-1);
    keyIsDown(rightKey) && this.rotate(1);
  }

  constrainToWorld() {
    this.pos.x = constrain(this.pos.x, 0, worldWidth);
    this.pos.y = constrain(this.pos.y, 20, height);
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    this.parachuteDeployed && this.drawParachute();
    rotate(this.angle);
    fill(255);
    triangle(-this.size / 2, -this.size / 2, this.size, 0, -this.size / 2, this.size / 2);
    pop();
    this.isZapped && this.drawForcefield();
  }

  thrust() {
    // Prevent thrust when a global engine lock (e.g., Lightning Storm) is active
    if (Ship.enginesLocked) {
      this.isThrusting = false;
      return; // Early exit: engines are disabled
    }

    if (energy > 0 && !this.isZapped) {
      const thrust = p5.Vector.fromAngle(this.angle, this.thrustPower);
      this.vel.add(thrust);
      energy--;
      this.isLanded && this.takeOff();
      Particle.createThrustParticles(this);
      this.isThrusting = true;
    } else {
      this.isThrusting = false;
    }
      // Sound handling only for the main ship
    this.isMainShip && (this.isThrusting ? soundManager.loopIfNotPlaying('shipThrust') : soundManager.stop('shipThrust'));
  }

  takeOff() {
    this.isLanded = false;
    this.vel.set(0, 0);
    this.pos.y -= 1;
  }

  rotate(dir) {
    this.angle += dir * this.rotationSpeed;
  }

  shoot() {
    if (energy >= 1) {
      const bulletSpawnPos = this.calculateBulletSpawnPosition();
  const surfaceY = getCachedSurfaceYAtX(bulletSpawnPos.x);
      if (bulletSpawnPos.y <= surfaceY) {
        const bulletVel = p5.Vector.fromAngle(this.angle, this.bulletSpeed);
        Bullet.addBullet(bulletSpawnPos, bulletVel, 5, true);
        energy--;
        soundManager.play('shipShooting');
      }
    }
  }

  calculateBulletSpawnPosition() {
    return this.pos.copy().add(p5.Vector.fromAngle(this.angle, this.size));
  }


  shootBomb() {
    if (energy >= 50 && !this.isLanded) {
      const bombSpawnPos = this.calculateBombSpawnPosition();
  const surfaceY = getCachedSurfaceYAtX(bombSpawnPos.x);
      if (bombSpawnPos.y <= surfaceY) {
        const bombVel = this.vel.copy().add(p5.Vector.fromAngle(this.angle + PI, this.bombSpeed));
        bombs.push(new Bomb(bombSpawnPos, bombVel, 10));
        energy -= 50;
      }
    }
  }

  calculateBombSpawnPosition() {
    return this.pos.copy().add(p5.Vector.fromAngle(this.angle + PI, this.size / 2));
  }


  handlePodInteraction() {
    if (!pod || !this.hasGrabbedPod && !pod.isPickedUp() && this.isNearPod()) {
      this.grabPod();
    }

    if (this.hasGrabbedPod) {
      this.updatePodPosition();
      this.isLanded && this.isOverBase() && this.dropOffPod();
    }
  }

  isNearPod() {
    if (!pod) return false;
    return dist(this.pos.x, this.pos.y, pod.pos.x, pod.pos.y) < this.size / 2 + pod.size / 2;
  }

  grabPod() {
    if (!pod) return;
    this.hasGrabbedPod = true;
    pod.updatePickupState('ship');
    money += 100;
    soundManager.play('shipDropOffPod');

    const spawnChance = 0.7;
    if (random() < spawnChance) {
      const enemyType = random(['Hunter', 'Destroyer', 'Zapper']);
      switch (enemyType) {
        case 'Hunter':
          Hunter.spawnHunter();
          break;
        case 'Destroyer':
          Destroyer.spawnDestroyer();
          break;
        case 'Zapper':
          Zapper.spawnZapper();
          break;
      }
    }
  }

  dropOffPod() {
    if (!pod) return;
    money += 500;
    energy = Math.min(energy + 10000, maxEnergy);
    this.hasGrabbedPod = false;
    soundManager.play('shipDropOffPod');
    placePodOnSurface();
  }

  updatePodPosition() {
    if (pod) {
      pod.pos = p5.Vector.add(this.pos, p5.Vector.fromAngle(this.angle + PI, this.size));
    }
  }


  isOverBase() {
    for (const base of MoonBase.moonBases) {
      // base.pos.x is now at center, so check if within half width on each side
      if (this.pos.x > base.pos.x - base.width / 2 && this.pos.x < base.pos.x + base.width / 2 && Math.abs(this.pos.y - (base.pos.y - this.size / 2)) < 5) {
        return true;
      }
    }
    return false;
  }

  findBaseUnder() {
    for (const base of MoonBase.moonBases) {
      // base.pos.x is now at center, so check if within half width on each side
      if (this.pos.x > base.pos.x - base.width / 2 && this.pos.x < base.pos.x + base.width / 2) {
        return base;
      }
    }
    return null;
  }

  getSurfaceY() {
    const base = this.findBaseUnder();
  return base ? base.pos.y : getCachedSurfaceYAtX(this.pos.x);
  }

  placeOnMoonBase() {
    const nearestBase = this.findNearestBase();
    if (nearestBase) {
      // base.pos.x is now already at center
      const baseCenter = nearestBase.pos.x;
      const surfaceY = this.getSurfaceY();
      this.pos.set(baseCenter, Math.min(nearestBase.pos.y, surfaceY) - this.size / 2);
      this.vel.set(0, 0);
      this.angle = -PI / 2;
      this.isLanded = true;
    }
  }

  findNearestBase() {
    let nearestBase = null;
    let shortestDistance = Infinity;
    for (const base of MoonBase.moonBases) {
      // base.pos.x is now at center, so no need to add width / 2
      const distance = dist(this.pos.x, this.pos.y, base.pos.x, base.pos.y);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestBase = base;
      }
    }
    return nearestBase;
  }

  checkImpact() {
    if (this.pos.y + this.size / 2 > this.getSurfaceY()) {
      return this.aCrashOrAlanding() ? this.land(this.getSurfaceY()) : (energy -= 10000);
    }
    return false;
  }


  aCrashOrAlanding() {
    return this.vel.mag() < this.safeLandingVelocity;
  }

  land(surfaceY) {
    this.pos.y = surfaceY - this.size / 2;
    this.vel.set(0, 0);
    this.isLanded = true;
    this.parachuteDeployed = false;
  }

  toggleParachute() {
    this.hasParachute && !this.isLanded && (this.parachuteDeployed = !this.parachuteDeployed);
  }

  applyParachuteDrag() {
    const dragForce = this.vel.copy().mult(-1).normalize().mult(this.parachuteDrag * this.vel.magSq());
    this.vel.add(dragForce);
  }

  drawParachute() {
    push();
    translate(0, -this.size * 1.5);

    // Draw the arc outline and lines
    noFill();
    stroke(200, 200, 255);
    strokeWeight(1);
    arc(0, 0, this.parachuteSize, this.parachuteSize, PI, TWO_PI);

    // Parachute lines
    line(-this.parachuteSize / 2, 0, 0, this.size * 1.5);
    line(this.parachuteSize / 2, 0, 0, this.size * 1.5);
    line(-this.parachuteSize / 4, 0, 0, this.size * 1.5);
    line(this.parachuteSize / 4, 0, 0, this.size * 1.5);

    // Draw a slight upward curve at the bottom of the parachute connecting the two sides
    noFill();
    beginShape();
    vertex(-this.parachuteSize / 2, 0);
    bezierVertex(
      -this.parachuteSize / 4, -this.parachuteSize * 0.08, // control point left
      this.parachuteSize / 4, -this.parachuteSize * 0.08,  // control point right
      this.parachuteSize / 2, 0
    );
    endShape();

    pop();
  }

applyZapEffect(duration) {
  this.isZapped = true;
  this.zapTimer = duration;
  // Release the pod if the ship is carrying it
  if (this.hasGrabbedPod) {
    this.hasGrabbedPod = false;
    placePodOnSurface();
  }
}

drawForcefield() {
  push();
  translate(this.pos.x, this.pos.y);
  noFill();
  stroke(0, 100, 255, 100);
  strokeWeight(2);
  ellipse(0, 0, this.size * 3);
  pop();
}
}


class Particle {
  static pool = [];
  static activeParticles = [];
  static maxPoolSize = 1000;

  constructor(pos, vel, size, lifetime, colory) {
    this.pos = pos.copy();
    this.vel = vel.copy();
    this.size = size;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.active = false;
    this.color = colory || color(200); // Default color if not provided
  }

  static create(pos, vel, size, lifetime, colory) {
    let particle;
    if (Particle.pool.length > 0) {
      particle = Particle.pool.pop();
      particle.reset(pos, vel, size, lifetime, colory);
    } else {
      particle = new Particle(pos, vel, size, lifetime, colory);
    }
    particle.active = true;
    Particle.activeParticles.push(particle);
    return particle;
  }

  static recycle(particle) {
    const index = Particle.activeParticles.indexOf(particle);
    if (index > -1) {
      Particle.activeParticles.splice(index, 1);
      particle.active = false;
      if (Particle.pool.length < Particle.maxPoolSize) {
        Particle.pool.push(particle);
      }
    }
  }

  reset(pos, vel, size, lifetime, colory) {
    this.pos.set(pos.x, pos.y);
    this.vel.set(vel.x, vel.y);
    this.size = size;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.color = colory || color(200); // Ensure color is reset, use default if not provided
    this.active = true;
  }

  update() {
    if (!this.active) return;
    this.pos.add(this.vel);
    this.lifetime--;
    if (this.lifetime <= 0) {
      Particle.recycle(this);
    }
  }

  draw() {
    if (!this.active) return;
    let alpha = map(this.lifetime, 0, this.maxLifetime, 0, 255);
    fill(red(this.color), green(this.color), blue(this.color), alpha);
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  static updateParticles() {
    for (let i = Particle.activeParticles.length - 1; i >= 0; i--) {
      Particle.activeParticles[i].update();
    }
  }

  static drawParticles() {
    noStroke();
    for (let particle of Particle.activeParticles) {
      if (isInView(particle.pos, particle.size)) {
        particle.draw();
      }
    }
  }

  static createThrustParticles(ship) {
    const basePos = p5.Vector.add(ship.pos, p5.Vector.fromAngle(ship.angle + PI, ship.size / 2));
    for (let i = 0; i < ship.particleCount; i++) {
      const particleAngle = ship.angle + PI + random(-0.2, 0.2);
      const particleVel = p5.Vector.fromAngle(particleAngle, random(1, 3));
      const particleColor = color(random(150, 190));
      Particle.create(basePos.copy(), particleVel, random(3, 7), random(20, 40), particleColor);
    }
  }
}

class Shield {
  static shields = [];
  static MAX_SHIELDS = 3;

  constructor(pos) {
    this.pos = pos;
    this.radius = 100;
    this.health = 100;
  }

  draw() {
    push();
    noFill();
    stroke(0, 100, 255);
    strokeWeight(2);
    arc(this.pos.x, this.pos.y, this.radius * 2, this.radius * 2, PI, TWO_PI);
    pop();
  }

  takeDamage(amount) {
    this.health -= amount;
  }

  isDestroyed() {
    return this.health <= 0;
  }

  static createShield(pos) {
    if (Shield.shields.length < Shield.MAX_SHIELDS) {
      Shield.shields.push(new Shield(pos));
    } else {
      Shield.shields.shift(); // Remove the oldest shield
      Shield.shields.push(new Shield(pos));
    }
  }

  static updateShields() {
    for (let i = Shield.shields.length - 1; i >= 0; i--) {
      if (Shield.shields[i].isDestroyed()) {
        Shield.shields.splice(i, 1);
      }
    }
  }

  static drawShields() {
    for (let shield of Shield.shields) {
      if (isInView(shield.pos, shield.radius)) {
        shield.draw();
      }
    }
  }
}

class Pod extends Entity {
    static podCounter = 0;
  
  constructor(pos, size) {
    super(pos, createVector(0, 0), size);
    this.id = ++Pod.podCounter;
    this.pickedUpByShip = false;
    this.pickedUpByAlien = false;
    this.pickedUpByAstronaut = false;
    this.logState('Created');
  }

  isPickedUp() {
    return this.pickedUpByShip || this.pickedUpByAlien || this.pickedUpByAstronaut;
  }

  draw() {
    if (isInView(this.pos, this.size) && !this.pickedUpByAlien && !this.pickedUpByAstronaut) {
      fill(255, 0, 0);
      ellipse(this.pos.x, this.pos.y, this.size, this.size);
    }
  }

  updatePickupState(pickedUpBy) {
    this.pickedUpByShip = pickedUpBy === 'ship';
    this.pickedUpByAlien = pickedUpBy === 'alien';
    this.pickedUpByAstronaut = pickedUpBy === 'astronaut';
    this.logState(`Picked up by ${pickedUpBy}`);
  }

  validateState() {
    if (this.pickedUpByAlien) {
      let alienHasPod = Alien.aliens.some(alien => alien.hasGrabbedPod);
      if (!alienHasPod) {
        debug.log(`Pod ${this.id} thinks it's picked up by an alien, but no alien has it. Resetting state.`);
        this.reset();
      }
    }
  }

  carrierKilled(newPos) {
    this.pos = newPos ? newPos.copy() : this.pos.copy();
    this.pickedUpByShip = false;
    this.pickedUpByAlien = false;
    this.pickedUpByAstronaut = false;
    this.logState('CarrierKilled');
  }

  podDropOff(newPos) {
    this.pos = newPos ? newPos.copy() : this.pos.copy();
    this.pickedUpByShip = false;
    this.pickedUpByAlien = false;
    this.pickedUpByAstronaut = false;
    this.logState('Pod dropped off');
    if (gameMode === 'twoPlayer') {
      alienEnergy += 1000;
    }
  }

  logState(action) {
    debug.log(`Pod ${this.id} ${action}: Position (${this.pos.x.toFixed(0)}, ${this.pos.y.toFixed(0)}), Picked up: ${this.isPickedUp()}`);
  }
}

class Bullet extends Entity {
  static pool = [];
  static activeObjects = [];
  static maxPoolSize = 100;
  static damageMultiplier = 1;

  constructor(pos, vel, size, isPlayerBullet) {
    super(pos, vel, size);
    this.isPlayerBullet = isPlayerBullet;
    this.active = false;
  }

  static addBullet(pos, vel, size, isPlayerBullet) {
    let bullet;
    if (Bullet.pool.length > 0) {
      bullet = Bullet.pool.pop();
      bullet.reset(pos, vel, size, isPlayerBullet);
    } else {
      bullet = new Bullet(pos.copy(), vel.copy(), size, isPlayerBullet);
    }
    bullet.active = true;
    Bullet.activeObjects.push(bullet);
    return bullet;
  }

  static recycle(bullet) {
    const index = Bullet.activeObjects.indexOf(bullet);
    if (index > -1) {
      Bullet.activeObjects.splice(index, 1);
      bullet.active = false;
      if (Bullet.pool.length < Bullet.maxPoolSize) {
        Bullet.pool.push(bullet);
      }
    }
  }

  reset(pos, vel, size, isPlayerBullet) {
    this.pos.set(pos.x, pos.y);
    this.vel.set(vel.x, vel.y);
    this.size = size;
    this.isPlayerBullet = isPlayerBullet;
    this.active = true;
  }

  update() {
    if (!this.active) return;

    this.pos.add(this.vel);

    // Check world boundaries
    if (this.pos.x < 0 || this.pos.x > worldWidth || this.pos.y < 0 || this.pos.y > height) {
      this.active = false;
      return;
    }

    // Check if bullet is below the surface
    const surfaceY = getCachedSurfaceYAtX(this.pos.x);
    if (this.pos.y > surfaceY) {
      this.active = false;
      return;
    }

    // Check collision with moon surface
    if (this.checkCollisionWithSurface()) {
      this.active = false;
    }
  }

  checkCollisionWithSurface() {
    const thresholdSq = (this.size / 2) * (this.size / 2);
    for (let i = 0; i < moonSurface.length - 1; i++) {
      if (distToSegmentSq(this.pos, moonSurface[i], moonSurface[i + 1]) < thresholdSq) {
        return true;
      }
    }
    return false;
  }

  checkCollisions() {
    return this.isPlayerBullet ? this.checkPlayerBulletCollisions() : this.checkEnemyBulletCollisions();
  }

  checkPlayerBulletCollisions() {
    return this.checkCollisionWithEntities(Alien.aliens) ||
           this.checkCollisionWithEntities(Hunter.hunters) ||
           this.checkCollisionWithEntities(Zapper.zappers) ||
           this.checkCollisionWithEntities(Destroyer.destroyers) ||
           this.checkCollisionWithWorms() ||
           this.checkCollisionWithPlants() ||
           this.checkCollisionWithQueen() ||
           this.checkCollisionWithKing() ||
           this.checkCollisionWithNests() ||
           this.checkCollisionWithFortresses();
  }

  checkCollisionWithPlants() {
    // Delegate to AlienPlant collision check to support both anchored and ground plants
    return AlienPlant.checkCollisionWithBullet(this);
  }

  checkEnemyBulletCollisions() {
    return this.checkCollisionWithShields() ||
           this.checkCollisionWithShip() ||
           this.checkCollisionWithWingmen() ||
           this.checkCollisionWithMoonBases() ||
           this.checkCollisionWithTurrets() ||
           this.checkCollisionWithAstronaut() ||
           this.checkCollisionWithBarrageBalloons() ||
           this.checkCollisionWithDrones();
  }

checkCollisionWithEntities(entities) {
  for (let entity of entities) {
    const dx = this.pos.x - entity.pos.x;
    const dy = this.pos.y - entity.pos.y;
    const minDist = (entity.size + this.size) / 2;
    const minDistSq = minDist * minDist;
    
    if (dx * dx + dy * dy < minDistSq) {
      const damage = this.isPlayerBullet ? Bullet.damageMultiplier : 1;
      entity.health -= damage;
      return true;
    }
  }
  return false;
}


  checkCollisionWithBarrageBalloons() {
    for (let base of MoonBase.moonBases) {
      for (let balloon of base.balloons) {
        const dx = this.pos.x - balloon.pos.x;
        const dy = this.pos.y - balloon.pos.y;
        const minDist = (balloon.size + this.size) / 2;
        const minDistSq = minDist * minDist;
        
        if (dx * dx + dy * dy < minDistSq) {
          balloon.takeDamage(1);
          return true;
        }
      }
    }
    return false;
  }

  checkCollisionWithDrones() {
    // Check collision with player's active drone
    if (activeDrone && activeDrone.active) {
      const dx = this.pos.x - activeDrone.pos.x;
      const dy = this.pos.y - activeDrone.pos.y;
      const minDist = (activeDrone.size + this.size) / 2;
      const minDistSq = minDist * minDist;
      
      if (dx * dx + dy * dy < minDistSq) {
        activeDrone.destroy();
        return true;
      }
    }

    // Check collision with base drones
    for (let base of MoonBase.moonBases) {
      if (base.drone && base.drone.active) {
        const dx = this.pos.x - base.drone.pos.x;
        const dy = this.pos.y - base.drone.pos.y;
        const minDist = (base.drone.size + this.size) / 2;
        const minDistSq = minDist * minDist;
        
        if (dx * dx + dy * dy < minDistSq) {
          base.drone.destroy();
          return true;
        }
      }
    }
    return false;
  }

  checkCollisionWithWorms() {
    for (let worm of AlienWorm.worms) {
      for (let segment of worm.segments) {
        const dx = this.pos.x - segment.pos.x;
        const dy = this.pos.y - segment.pos.y;
        const minDist = (segment.size + this.size) / 2;
        const minDistSq = minDist * minDist;
        
        if (dx * dx + dy * dy < minDistSq) {
          const damage = this.isPlayerBullet ? 2 * Bullet.damageMultiplier : 2;
          if (worm.takeDamage(damage)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  checkCollisionWithQueen() {
    if (alienQueen) {
      const dx = this.pos.x - alienQueen.pos.x;
      const dy = this.pos.y - alienQueen.pos.y;
      const minDist = (alienQueen.size + this.size) / 2;
      const minDistSq = minDist * minDist;
      
      if (dx * dx + dy * dy < minDistSq) {
        const damage = this.isPlayerBullet ? Bullet.damageMultiplier : 1;
        alienQueen.takeDamage(damage);
        return true;
      }
    }
    return false;
  }

  checkCollisionWithKing() {
    if (alienKing) {
      const dx = this.pos.x - alienKing.pos.x;
      const dy = this.pos.y - alienKing.pos.y;
      const minDist = (alienKing.size + this.size) / 2;
      const minDistSq = minDist * minDist;
      
      if (dx * dx + dy * dy < minDistSq) {
        const damage = this.isPlayerBullet ? Bullet.damageMultiplier : 1;
        alienKing.takeDamage(damage);
        return true;
      }
    }
    return false;
  }

checkCollisionWithNests() {
  for (let nest of Nest.nests) {
    const centerY = nest.pos.y + 10; // match draw translate offset
    const dx = this.pos.x - nest.pos.x;
    const dy = this.pos.y - centerY;
    const minDist = (nest.size + this.size) / 2;
    const minDistSq = minDist * minDist;
    
    if (dx * dx + dy * dy < minDistSq) {
      const damage = this.isPlayerBullet ? Bullet.damageMultiplier : 1;
      nest.health -= damage;
      return true;
    }
  }
  return false;
}

checkCollisionWithFortresses() {
  for (let fortress of AlienFortress.fortresses) {
    const centerY = fortress.pos.y + 10; // match draw translate offset
    const dx = this.pos.x - fortress.pos.x;
    const dy = this.pos.y - centerY;
    const minDist = (fortress.size + this.size) / 2;
    const minDistSq = minDist * minDist;
    
    if (dx * dx + dy * dy < minDistSq) {
      const damage = this.isPlayerBullet ? Bullet.damageMultiplier : 1;
      fortress.health -= damage;
      return true;
    }
  }
  return false;
}

  checkCollisionWithShip() {
  if (!isWalking && !astronaut.ridingWalker) {
    const dx = this.pos.x - ship.pos.x;
    const dy = this.pos.y - ship.pos.y;
    const minDist = (ship.size + this.size) / 2;
    const minDistSq = minDist * minDist;
    
    if (dx * dx + dy * dy < minDistSq) {
      soundManager.play('shipHit');
      energy -= 500;
      if (gameMode === 'twoPlayer') {
        alienEnergy += 100;
      }
      return true;
    }
    return false;
  }
       return false;
  }

checkCollisionWithWingmen() {
  for (let wingman of Wingman.wingmen) {
    if (wingman.isActive) {
      const dx = this.pos.x - wingman.pos.x;
      const dy = this.pos.y - wingman.pos.y;
      const minDist = (wingman.size + this.size) / 2;
      const minDistSq = minDist * minDist;
      
      if (dx * dx + dy * dy < minDistSq) {
        wingman.takeDamage(10);
        return true;
      }
    }
  }
  return false;
}

  checkCollisionWithAstronaut() {
    if (isWalking && !astronaut.isInShip && !astronaut.ridingWalker) {
      const dx = this.pos.x - astronaut.pos.x;
      const dy = this.pos.y - astronaut.pos.y;
      const minDist = (astronaut.size + this.size) / 2;
      const minDistSq = minDist * minDist;
      
      if (dx * dx + dy * dy < minDistSq) {
        energy -= 100;
        soundManager.play('shipHit');
        return true;
      }
    }
    return false;
  }

  checkCollisionWithMoonBases() {
    for (let base of MoonBase.moonBases) {
      // base.pos.x is now at center, so check if within half width on each side
      if (this.pos.x > base.pos.x - base.width / 2 && this.pos.x < base.pos.x + base.width / 2 &&
          this.pos.y > base.pos.y && this.pos.y < base.pos.y + base.height) {
        base.health -= 10;
        return true;
      }
    }
    return false;
  }

  checkCollisionWithTurrets() {
    for (let turret of turrets) {
      const dx = this.pos.x - turret.pos.x;
      const dy = this.pos.y - turret.pos.y;
      const minDist = (turret.size + this.size) / 2;
      const minDistSq = minDist * minDist;
      
      if (dx * dx + dy * dy < minDistSq) {
        turret.health -= 1;
        return true;
      }
    }
    return false;
  }

  checkCollisionWithShields() {
    for (let shield of Shield.shields) {
      const dx = this.pos.x - shield.pos.x;
      const dy = this.pos.y - shield.pos.y;
      const radiusSq = shield.radius * shield.radius;
      
      if (dx * dx + dy * dy < radiusSq) {
        if (!this.isPlayerBullet) {
          shield.takeDamage(10);
        }
        return true;
      }
    }
    return false;
  }

static updatePlayerBulletColour() {
  const bulletDamageLevel = (typeof upgrades !== "undefined" && upgrades.availableUpgrades?.bulletDamage?.level) || 0;

  const colours = [
    [255, 255, 0], // Level 0: Yellow
    [255, 165, 0], // Level 1: Orange
    [255, 69, 0],  // Level 2: Red-Orange
    [255, 0, 0]    // Level 3+: Red
  ];

  Bullet.playerBulletColour = colours[Math.min(bulletDamageLevel, 3)];
}

  static updateBullets() {
    for (let i = Bullet.activeObjects.length - 1; i >= 0; i--) {
      let bullet = Bullet.activeObjects[i];
      bullet.update();
      
      if (!bullet.active || bullet.checkCollisions()) {
        Bullet.recycle(bullet);
      }
    }
  }

static drawBullets() {
  // Batch bullets by type to minimize fill() calls
  let playerBullets = [];
  let enemyBullets = [];
  
  for (let bullet of Bullet.activeObjects) {
    if (isInView(bullet.pos, bullet.size)) {
      if (bullet.isPlayerBullet) {
        playerBullets.push(bullet);
      } else {
        enemyBullets.push(bullet);
      }
    }
  }
  
  // Draw all player bullets with one fill call
  if (playerBullets.length > 0) {
    fill(...Bullet.playerBulletColour);
    for (let bullet of playerBullets) {
      ellipse(bullet.pos.x, bullet.pos.y, bullet.size, bullet.size);
    }
  }
  
  // Draw all enemy bullets with one fill call
  if (enemyBullets.length > 0) {
    fill(0, 255, 0); // Enemy bullets are green
    for (let bullet of enemyBullets) {
      ellipse(bullet.pos.x, bullet.pos.y, bullet.size, bullet.size);
    }
  }
}
}

class Bomb extends Entity {
  static defaultExplosionRadius = 30;
  static defaultBombDamage = 3;
  static bombColour = [255, 255, 0]; // Default to yellow (Level 0)
  
  constructor(pos, vel, size) {
    super(pos, vel, size);
    this.explosionRadius = Bomb.defaultExplosionRadius;
    this.bombDamage = Bomb.defaultBombDamage;
    this.craterDepth = 25; // Maximum depth of the crater
    this.craterWidth = this.explosionRadius; // Width of the crater
  }

  update() {
    super.update();
    this.vel.y += 0.05; // Gravity effect for slow fall
    this.vel.add(wind); // Apply wind effect to the bomb
    
    // Check if bomb is below the surface
    const surfaceY = getCachedSurfaceYAtX(this.pos.x);
    if (this.pos.y > surfaceY) {
      return true; // Trigger collision if below surface
    }
    
    return this.checkCollision() || this.checkAlienCollision();
  }

  draw() {
    fill(...Bomb.bombColour);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
  }

    static updateBombColour() {
    const bombDamageLevel = (typeof upgrades !== "undefined" && upgrades.availableUpgrades?.bombDamage?.level) || 0;

    const colours = [
      [255, 255, 0], // Level 0: Yellow
      [255, 200, 0], // Level 1: Orange-Yellow
      [255, 165, 0], // Level 2: Orange
      [255, 69, 0],  // Level 3: Red-Orange
      [255, 0, 0],   // Level 4: Red
      [180, 0, 0]    // Level 5+: Dark Red
    ];

    Bomb.bombColour = colours[Math.min(bombDamageLevel, 5)];
  }

  checkCollision() {
    const thresholdSq = (this.size / 2) * (this.size / 2);
    for (let i = 0; i < moonSurface.length - 1; i++) {
      let start = moonSurface[i];
      let end = moonSurface[i + 1];
      
      if (distToSegmentSq(this.pos, start, end) < thresholdSq) {
        return true;
      }
    }
    return false;
  }

checkAlienCollision() {
  for (let nest of Nest.nests) {
    const dx = this.pos.x - nest.pos.x;
    const dy = this.pos.y - nest.pos.y;
    const minDist = (this.size + nest.size) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }

  // Check collision with fortresses
  for (let fortress of AlienFortress.fortresses) {
    const dx = this.pos.x - fortress.pos.x;
    const dy = this.pos.y - fortress.pos.y;
    const minDist = (this.size + fortress.size) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }
  
  // Check collision with plants (both ground and reed-anchored)
  for (let plant of AlienPlant.plants) {
    const dx = this.pos.x - plant.pos.x;
    const dy = this.pos.y - plant.pos.y;
    const minDist = (this.size + (plant.currentSize || plant.size)) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }

  // Check collision with regular aliens
  for (let alien of Alien.aliens) {
    const dx = this.pos.x - alien.pos.x;
    const dy = this.pos.y - alien.pos.y;
    const minDist = (this.size + alien.size) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }

  // Check collision with hunters
  for (let hunter of Hunter.hunters) {
    const dx = this.pos.x - hunter.pos.x;
    const dy = this.pos.y - hunter.pos.y;
    const minDist = (this.size + hunter.size) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }

  // Check collision with zappers
  for (let zapper of Zapper.zappers) {
    const dx = this.pos.x - zapper.pos.x;
    const dy = this.pos.y - zapper.pos.y;
    const minDist = (this.size + zapper.size) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }

  // Check collision with destroyers
  for (let destroyer of Destroyer.destroyers) {
    const dx = this.pos.x - destroyer.pos.x;
    const dy = this.pos.y - destroyer.pos.y;
    const minDist = (this.size + destroyer.size) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }

  // Check collision with Queen, adjusting for her size
  if (alienQueen) {
    const dx = this.pos.x - alienQueen.pos.x;
    const dy = this.pos.y - alienQueen.pos.y;
    const minDist = (this.size + alienQueen.size) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }
  
  if (alienKing) {
    const dx = this.pos.x - alienKing.pos.x;
    const dy = this.pos.y - alienKing.pos.y;
    const minDist = (this.size + alienKing.size) / 2;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }

  // Check collision with worms
  for (let worm of AlienWorm.worms) {
    for (let segment of worm.segments) {
      const dx = this.pos.x - segment.pos.x;
      const dy = this.pos.y - segment.pos.y;
      const minDist = (this.size + segment.size) / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        return true;
      }
    }
  }

  return false;
}

  
  
  
  explode() {
    // Create explosion effect
    explosions.push(new Explosion(this.pos, this.explosionRadius * 2));
    soundManager.play('shipBomb');
    
    // Reshape moon surface
    this.reshapeMoonSurface();
    
    // Adjust positions of game objects
    this.adjustGameObjectPositions();
    
    // Explosion effect on aliens and nest
    this.damageAliens();
    this.damageHunters();
    this.damageDestroyers();
    this.damageWorms();
    this.damageNests();
    this.damageFortresses();
    this.damageQueen();
    this.damageKing();
    AlienPlant.checkCollisionWithBomb(this);
  }

reshapeMoonSurface() {
  let impactPoint = this.pos.x;
  let craterLeft = max(0, impactPoint - this.craterWidth / 2);
  let craterRight = min(worldWidth, impactPoint + this.craterWidth / 2);
  const minHeight = height; // Minimum height for the surface

  // Find the index range of affected surface points
  let startIndex = moonSurface.findIndex(point => point.x >= craterLeft);
  let endIndex = moonSurface.findIndex(point => point.x > craterRight);
  if (endIndex === -1) endIndex = moonSurface.length;

  // Create new surface points for the crater
  let newSurfacePoints = [];
  for (let i = startIndex; i < endIndex; i++) {
    let point = moonSurface[i];
    let distanceFromImpact = abs(point.x - impactPoint);
    let depthFactor = 1 - (distanceFromImpact / (this.craterWidth / 2));
    depthFactor = max(0, depthFactor); // Ensure non-negative
    let craterDepthAtPoint = this.craterDepth * depthFactor;
    
    // Apply a smooth curve to the crater shape
    craterDepthAtPoint *= sin((distanceFromImpact / (this.craterWidth / 2)) * PI);
    
    // Ensure the new point is not below minHeight
    point.y = min(point.y + craterDepthAtPoint, minHeight);
    newSurfacePoints.push(point);
  }

  // Replace the affected portion of moonSurface with new points
  moonSurface.splice(startIndex, endIndex - startIndex, ...newSurfacePoints);

  // Ensure the crater edges blend smoothly with existing terrain
  this.smoothCraterEdges(startIndex, newSurfacePoints.length);
  // Terrain changed by explosion; clear cached heights
  if (typeof clearTerrainCache === 'function') clearTerrainCache();
}

  smoothCraterEdges(startIndex, newPointsCount) {
    let smoothingRange = 3; // Number of points to smooth on each side

    for (let i = 0; i < smoothingRange; i++) {
      let leftIndex = startIndex - smoothingRange + i;
      let rightIndex = startIndex + newPointsCount + i;

      if (leftIndex >= 0 && leftIndex < moonSurface.length - 1) {
        let weight = i / smoothingRange;
        moonSurface[leftIndex].y = lerp(moonSurface[leftIndex].y, moonSurface[leftIndex + 1].y, weight);
      }

      if (rightIndex >= 0 && rightIndex < moonSurface.length - 1) {
        let weight = 1 - (i / smoothingRange);
        moonSurface[rightIndex].y = lerp(moonSurface[rightIndex].y, moonSurface[rightIndex - 1].y, weight);
      }
    }
  }

  adjustGameObjectPositions() {
    this.adjustMoonBases();
    this.adjustNests();
    this.adjustFortresses();
    this.adjustTurrets();
    this.adjustAlienPlants();
    this.adjustShip();
    this.adjustRigs();
    RuinedShip.updatePositions();
  }

  adjustMoonBases() {
    for (let base of MoonBase.moonBases) {
      let newY = min(this.getNewSurfaceY(base.pos.x), height);
      base.pos.y = newY - base.height;
    }
  }

  
  adjustShip() {
    if (ship.isLanded){
      let newY = min(this.getNewSurfaceY(ship.pos.x), height);
      ship.pos.y = newY - ship.size / 2;
      // Update pod position if ship is carrying it
      if (ship.hasGrabbedPod) {
        ship.updatePodPosition();
      }
   }
  }
  
  adjustNests() {
    for (let nest of Nest.nests) {
      if (nest.isAnchoredToReed) continue; // anchored entities follow reed tips
      let newY = min(this.getNewSurfaceY(nest.pos.x), height);
      nest.pos.y = newY - nest.size / 2;
    }
  }

  adjustFortresses() {
    for (let fortress of AlienFortress.fortresses) {
      if (fortress.isAnchoredToReed) continue; // anchored entities follow reed tips
      let newY = min(this.getNewSurfaceY(fortress.pos.x), height);
      fortress.pos.y = newY - fortress.size / 2;
    }
  }

  adjustTurrets() {
    for (let turret of turrets) {
      let newY = min(this.getNewSurfaceY(turret.pos.x), height);
      turret.pos.y = newY - turret.size / 2;
    }
  }

  adjustRigs() {
    for (let rig of DrillRig.rigs) {
      let newY = min(this.getNewSurfaceY(rig.pos.x), height);
      rig.pos.y = newY - rig.size / 2;
    }
  }

adjustAlienPlants() {
  for (let plant of AlienPlant.plants) {
    let newY = min(this.getNewSurfaceY(plant.pos.x), height);
    plant.targetPos.y = newY - plant.size / 2;
  }
}
  
  
  

  getNewSurfaceY(x) {
    for (let i = 0; i < moonSurface.length - 1; i++) {
      if (x >= moonSurface[i].x && x < moonSurface[i + 1].x) {
        let t = (x - moonSurface[i].x) / (moonSurface[i + 1].x - moonSurface[i].x);
        return lerp(moonSurface[i].y, moonSurface[i + 1].y, t);
      }
    }
    return height; // Default to bottom of screen if not found
  }

  damageAliens() {
    for (let i = Alien.aliens.length - 1; i >= 0; i--) {
      let alien = Alien.aliens[i];
      let d = dist(this.pos.x, this.pos.y, alien.pos.x, alien.pos.y);
      let adjustedRadius = this.explosionRadius + alien.size / 2; // Include alien size
      if (d < adjustedRadius) {
        alien.health -= this.bombDamage;
      }
    }
  }

  damageNests() {
    for (let i = Nest.nests.length - 1; i >= 0; i--) {
      let nest = Nest.nests[i];
      let d = dist(this.pos.x, this.pos.y, nest.pos.x, nest.pos.y);
      let adjustedRadius = this.explosionRadius + nest.size / 2; // Include nest size
      if (d < adjustedRadius) {
        nest.health -= this.bombDamage;
      }
    }
  }

  damageFortresses() {
    for (let i = AlienFortress.fortresses.length - 1; i >= 0; i--) {
      let fortress = AlienFortress.fortresses[i];
      let d = dist(this.pos.x, this.pos.y, fortress.pos.x, fortress.pos.y);
      let adjustedRadius = this.explosionRadius + fortress.size / 2; // Include fortress size
      if (d < adjustedRadius) {
        fortress.health -= this.bombDamage;
      }
    }
  }

  damageDestroyers() {
    for (let i = Destroyer.destroyers.length - 1; i >= 0; i--) {
      let destroyer = Destroyer.destroyers[i];
      let d = dist(this.pos.x, this.pos.y, destroyer.pos.x, destroyer.pos.y);
      let adjustedRadius = this.explosionRadius + destroyer.size / 2; // Include destroyer size
      if (d < adjustedRadius) {
        destroyer.health -= this.bombDamage;
      }
    }
  }
  
  damageHunters() {
    for (let i = Hunter.hunters.length - 1; i >= 0; i--) {
      let hunter = Hunter.hunters[i];
      let d = dist(this.pos.x, this.pos.y, hunter.pos.x, hunter.pos.y);
      let adjustedRadius = this.explosionRadius + hunter.size / 2; // Include hunter size
      if (d < adjustedRadius) {
        hunter.health -= this.bombDamage;
      }
    }
  }

damageQueen() {
  if (alienQueen) {
    let d = dist(this.pos.x, this.pos.y, alienQueen.pos.x, alienQueen.pos.y);
    let adjustedRadius = this.explosionRadius + alienQueen.size / 2; // Include AlienQueen's size
    if (d < adjustedRadius) {
      alienQueen.takeDamage(this.bombDamage);
    }
  }
} 
  damageKing() {
  if (alienKing) {
    let d = dist(this.pos.x, this.pos.y, alienKing.pos.x, alienKing.pos.y);
    let adjustedRadius = this.explosionRadius + alienKing.size / 2; // Include alienKing's size
    if (d < adjustedRadius) {
      alienKing.takeDamage(this.bombDamage);
    }
  }  
}


  
  damageWorms() {
    for (let worm of AlienWorm.worms) {
      let damaged = false;
      for (let segment of worm.segments) {
        if (dist(this.pos.x, this.pos.y, segment.pos.x, segment.pos.y) < this.explosionRadius) {
          damaged = true;
          break;
        }
      }
      if (damaged) {
        worm.takeDamage(this.bombDamage);
      }
    }
  }
  
  static updateBombs() {
    for (let i = bombs.length - 1; i >= 0; i--) {
      let bomb = bombs[i];
      if (bomb.update()) {
        bomb.explode();
        bombs.splice(i, 1);
      } else if (bomb.pos.y > height) {
        bombs.splice(i, 1);
      }
    }

    // Update and remove finished explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].update();
      if (explosions[i].isFinished()) {
        explosions.splice(i, 1);
      }
    }
  }
}

class Turret extends Entity {
  static  defaultHealth = 4;
  static defaultRange = 200;
  static ShootCooldown = 120;
  
  constructor(pos) {
    super(pos, createVector(0, 0), 20);
    this.shootCooldown = 0;
    this.maxShootCooldown = Turret.ShootCooldown;
    this.range = Turret.defaultRange;
    this.angle = -PI / 2; // Default angle pointing upwards
    this.health = Turret.defaultHealth;
    this.accuracy = 0.04; // 0.1 = 18 degrees deviation, lower means more accurate


    // Freeze Burst properties
    this.burstDefenseRadius = Turret.defaultRange;
    this.burstDefenseCooldown = 0;
    this.burstDefenseMaxCooldown = 300; // 5 seconds cooldown
    this.freezeDuration = 180; // 3 seconds frozen
    this.burstDefenseAnimationFrames = 30;
    this.currentBurstFrame = 0;
  }

  update() {
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }
    if (this.burstDefenseCooldown > 0) {
      this.burstDefenseCooldown--;
    }
    if (this.currentBurstFrame > 0) {
      this.currentBurstFrame--;
    }

    let closestTarget = this.findClosestTarget();
    if (closestTarget) {

    if (this.burstDefenseCooldown <= 0) {
      this.activateBurstDefense();
    }
      // Ensure the target has a valid position
      let targetPos = this.getTargetPosition(closestTarget);
      if (targetPos) {
        this.angle = p5.Vector.sub(targetPos, this.pos).heading();
        if (this.shootCooldown <= 0) {
          this.shoot(closestTarget);
        }
      }
    }



  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(200);
    triangle(0, -10, -10, 10, 10, 10);
    pop();

        // Draw freeze burst animation
    if (this.currentBurstFrame > 0) {
      let progress = this.currentBurstFrame / this.burstDefenseAnimationFrames;
      let radius = this.burstDefenseRadius * (1 - progress);
      noFill();
      stroke(100, 100, 255, 255 * progress); // Blue freeze burst effect
      strokeWeight(3 * progress);
      ellipse(this.pos.x, this.pos.y, radius * 2);
      noStroke();
    }
  }


activateBurstDefense() {
  this.burstDefenseCooldown = this.burstDefenseMaxCooldown;
  this.currentBurstFrame = this.burstDefenseAnimationFrames;

  // Create an array of all alien types
  let allAliens = [
    ...Alien.aliens,
    ...Hunter.hunters,
    ...Zapper.zappers,
    ...Destroyer.destroyers
  ];

  // Apply freeze effect to all aliens within range
  for (let alien of allAliens) {
    let d = dist(this.pos.x, this.pos.y, alien.pos.x, alien.pos.y);
    if (d < this.burstDefenseRadius) {
      alien.freeze(this.freezeDuration);
    }
  }

    // Freeze AlienWorms (check head segment)
  for (let worm of AlienWorm.worms) {
    if (worm && worm.segments && worm.segments.length > 0) {
      let head = worm.segments[0]; // Head segment
      let d = dist(this.pos.x, this.pos.y, head.pos.x, head.pos.y);
      if (d < this.burstDefenseRadius) {
        worm.freeze(this.freezeDuration);
      }
    }
  }

  soundManager.play('turretFreezeBurst');
}

  findClosestTarget() {
    let closestTarget = null;
    let closestDist = Infinity;
    
    const checkEntity = (entity) => {
      if (entity && entity.pos) {
        let d = dist(this.pos.x, this.pos.y, entity.pos.x, entity.pos.y);
        if (d < closestDist && d < this.range) {
          closestTarget = entity;
          closestDist = d;
        }
      }
    };

    // Prioritize fortresses first (highest threat)
    for (let fortress of AlienFortress.fortresses) {
      checkEntity(fortress);
    }
    if (closestTarget) return closestTarget; // Return fortress if found

    // Then prioritize nests
    for (let nest of Nest.nests) {
      checkEntity(nest);
    }
    if (closestTarget) return closestTarget; // Return nest if found
    
    Alien.aliens.forEach(checkEntity);
    Destroyer.destroyers.forEach(checkEntity);
    Zapper.zappers.forEach(checkEntity);
    Hunter.hunters.forEach(checkEntity);
    Nest.nests.forEach(checkEntity);
    
    AlienWorm.worms.forEach(worm => {
      if (worm && worm.segments && worm.segments.length > 0) {
        checkEntity({pos: worm.segments[0].pos});
      }
    });
    
    return closestTarget;
  }

getTargetPosition(target) {
  if (target instanceof AlienWorm) {
    return target.segments[0].pos;
  } else if (target instanceof AlienFortress) {
    return createVector(target.pos.x + target.size / 2, target.pos.y + target.size / 2);
  } else if (target instanceof Nest) {
    return createVector(target.pos.x + target.size / 2, target.pos.y + target.size / 2);
  } else if (target && target.pos) {
    return target.pos;
  }
  return null;
}

  shoot(target) {
    let targetPos = this.getTargetPosition(target);
    if (!targetPos) return;

    let bulletVel = p5.Vector.sub(targetPos, this.pos).normalize().mult(6);
    
    // Add randomness to bullet direction
    let randomAngle = random(-PI * this.accuracy, PI * this.accuracy);
    bulletVel.rotate(randomAngle);
    
    Bullet.addBullet(this.pos.copy(), bulletVel, 5, true);
    
    this.shootCooldown = this.maxShootCooldown;
  }

  static updateTurrets() {
    for (let i = turrets.length - 1; i >= 0; i--) {
      if (turrets[i]) {
        turrets[i].update();
        if (turrets[i].health <= 0) {
          explosions.push(new Explosion(turrets[i].pos, 30, color(0, 255, 255), color(0, 100, 100)));
          turrets.splice(i, 1);
        }
      }
    }
  }

  static drawTurrets() {
    turrets.forEach(turret => {
      if (turret && isInView(turret.pos, turret.size)) {
        turret.draw();
      }
    });
  }
}

class Explosion {
  constructor(pos, size, outerColor, innerColor) {
    this.pos = pos.copy();
    this.maxSize = size;
    this.currentSize = 0;
    this.lifetime = 30; // Animation duration in frames
    this.outerColor = outerColor || color(255, 200, 0); // Default to original color if not provided
    this.innerColor = innerColor || color(255, 100, 0); // Default to original color if not provided
  }

  update() {
    this.currentSize = map(this.lifetime, 30, 0, 0, this.maxSize);
    this.lifetime--;
  }

  draw() {
    push();
    noFill();
    let alpha = map(this.lifetime, 30, 0, 255, 0);
    
    // Outer circle
    stroke(this.outerColor.levels[0], this.outerColor.levels[1], this.outerColor.levels[2], alpha);
    strokeWeight(3);
    ellipse(this.pos.x, this.pos.y, this.currentSize);
    
    // Inner circle
    stroke(this.innerColor.levels[0], this.innerColor.levels[1], this.innerColor.levels[2], alpha);
    strokeWeight(2);
    ellipse(this.pos.x, this.pos.y, this.currentSize * 0.7);
    
    pop();
  }

  isFinished() {
    return this.lifetime <= 0;
  }
}

class WindSoundGenerator {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.noiseChains = [];
    for (let i = 0; i < 3; i++) {
      this.noiseChains.push(this.createNoiseChain());
    }

    this.isPlaying = false;
    this.baseVolume = 0.3;
    this.windForce = 0;
  }

  createNoiseChain() {
    const filter = this.audioContext.createBiquadFilter();
    const gain = this.audioContext.createGain();

    filter.connect(gain);
    gain.connect(this.masterGain);

    filter.type = 'lowpass';
    filter.frequency.value = this.randomRange(400, 1000);
    filter.Q.value = this.randomRange(0.5, 2);

    gain.gain.value = this.randomRange(0.1, 0.3);

    // Create an LFO for filter modulation
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = this.randomRange(0.1, 0.3);
    lfoGain.gain.value = this.randomRange(50, 200);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    return { filter, gain, lfo, lfoGain };
  }

  createNoise() {
    const bufferSize = 2 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    return source;
  }

  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  start() {
    if (!this.isPlaying) {
      this.noiseChains.forEach(chain => {
        const noise = this.createNoise();
        noise.connect(chain.filter);
        noise.start();
        chain.currentNoise = noise;
      });
      this.isPlaying = true;
      this.scheduleVariations();
    }
  }

  stop() {
    if (this.isPlaying) {
      this.noiseChains.forEach(chain => {
        if (chain.currentNoise) {
          chain.currentNoise.stop();
          chain.currentNoise.disconnect();
          delete chain.currentNoise;
        }
      });
      this.isPlaying = false;
      if (this.variationTimeout) {
        clearTimeout(this.variationTimeout);
      }
    }
  }

  setWindForce(windForce, transitionTime = 2) {
    // Adjust windForce to the new range (0 to 0.01)
    this.windForce = Math.max(0, Math.min(windForce, 0.01));
    const normalizedWindForce = this.windForce / 0.01; // Normalize to 0-1 range for calculations
    const volume = this.baseVolume + (normalizedWindForce * 0.7);
    this.masterGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, transitionTime);

    this.noiseChains.forEach((chain, index) => {
      const baseFreq = 400 + (index * 200);
      const maxFreq = baseFreq + 1600;
      const frequency = baseFreq + (maxFreq - baseFreq) * normalizedWindForce;
      chain.filter.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, transitionTime);

      const q = 0.5 + (4.5 * normalizedWindForce);
      chain.filter.Q.setTargetAtTime(q, this.audioContext.currentTime, transitionTime);

      const modulationIntensity = 50 + (150 * normalizedWindForce);
      chain.lfoGain.gain.setTargetAtTime(modulationIntensity, this.audioContext.currentTime, transitionTime);
    });
  }

  scheduleVariations() {
    const variationTime = this.randomRange(1, 5);
    this.variationTimeout = setTimeout(() => {
      const variation = (Math.random() - 0.5) * 0.003; // Adjusted for 0-0.01 range
      let newWindForce = this.windForce + variation;
      newWindForce = Math.max(0, Math.min(newWindForce, 0.01));
      this.setWindForce(newWindForce, this.randomRange(0.5, 2));

      // Randomly adjust LFO frequencies
      this.noiseChains.forEach(chain => {
        chain.lfo.frequency.setTargetAtTime(this.randomRange(0.1, 0.3), this.audioContext.currentTime, 1);
      });

      this.scheduleVariations();
    }, variationTime * 1000);
  }

  setBaseVolume(volume) {
    this.baseVolume = Math.max(0, Math.min(volume, 1));
    this.setWindForce(this.windForce);
  }

  mute() {
    this.masterGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.5);
  }

  unmute() {
    const normalizedWindForce = this.windForce / 0.01;
    const volume = this.baseVolume + (normalizedWindForce * 0.7);
    this.masterGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.5);
  }

  isActive() {
    return this.isPlaying;
  }
}

class SoundManager {
  constructor() {
    this.sounds = {};
    this.muted = false;
    this.globalVolume = 1.0;
    this.maxSimultaneousSounds = 10;
    this.currentlyPlaying = [];
    this.soundFiles = [
      'shipThrust', 'magneticStorm','methane','queenDeath','walker','shipShooting', 'shipHit', 'shipDropOffPod', 'enterKing','teleportKing', 'laserKing','walkerShoot',
      'alienShooting', 'gameOver', 'nextLevel', 'alienPodPickup', 'quantumRift', 'eclipseWarning',
      'alienPodDropOff', 'alienDestruction', 'nestDestruction','teleport','turretFreezeBurst',
      'moonBaseDestruction', 'hunterSpawned','zapperSpawned', 'wormDead','destroyerSpawned',
      'shipBomb', 'meteorImpact','diamondImpact','earthquake','astronautJump','missileImpact','nestBurstDefense','balloonPop','warning','lightning'
    ];
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  getTotalAssets() {
    return this.soundFiles.length;
  }

  preloadWithCallback(callback) {
    this.soundFiles.forEach(soundName => {
      this.loadSound(soundName, callback);
    });
  }

  loadSound(soundName, callback) {
    const request = new XMLHttpRequest();
    request.open('GET', `assets/${soundName}.wav`, true);
    request.responseType = 'arraybuffer';

    request.onload = () => {
      this.audioContext.decodeAudioData(request.response, (buffer) => {
        this.sounds[soundName] = {
          buffer: buffer,
          priority: this.getPriority(soundName),
          volume: this.getVolume(soundName)
        };
        callback();
      }, (error) => {
        debug.error(`Error decoding sound: ${soundName}`, error);
        callback();
      });
    };

    request.onerror = () => {
      debug.error(`Failed to load sound: ${soundName}`);
      callback();
    };

    request.send();
  }

  getPriority(soundName) {
    const priorities = {
      queenDeath: 5,walker: 3, methane: 3, magneticStorm: 2, shipThrust: 2, shipShooting: 4, shipHit: 5, shipDropOffPod: 3,
      alienShooting: 2, gameOver: 5, nextLevel: 5, alienPodPickup: 1,enterKing: 5, teleportKing: 3, laserKing: 1,
      alienPodDropOff: 2, alienDestruction: 3, turretFreezeBurst: 1, nestDestruction: 4,walkerShoot: 2,quantumRift: 5, eclipseWarning: 5,
      moonBaseDestruction: 5, teleport: 5, hunterSpawned: 2, destroyerSpawned: 2, zapperSpawned: 2,earthquake: 4,
      shipBomb: 4, meteorImpact: 1, wormDead: 4, astronautJump: 4, nestBurstDefense: 1, balloonPop: 3,diamondImpact: 1,missileLaunch: 3, missileImpact: 5,warning: 3, lightning: 5
    };
    return priorities[soundName] || 1;
  }

  getVolume(soundName) {
    const volumes = {
      shipThrust: 0.2, missileLaunch: 0.5, turretFreezeBurst: 0.8, nestDestruction: 0.8, meteorImpact: 0.5, diamondImpact: 0.6, hunterSpawned: 0.7, destroyerSpawned: 0.7, walkerShoot: 0.2, warning: 0.5, lightning: 0.9
    };
    return volumes[soundName] || 1.0;
  }

  play(soundName) {
    if (this.muted || !this.sounds[soundName]) return;

    const soundObj = this.sounds[soundName];
    
    if (this.currentlyPlaying.length >= this.maxSimultaneousSounds) {
      const lowestPriority = Math.min(...this.currentlyPlaying.map(s => this.sounds[s].priority));
      if (soundObj.priority <= lowestPriority) return;
      
      const lowestPrioritySound = this.currentlyPlaying.find(s => this.sounds[s].priority === lowestPriority);
      this.stop(lowestPrioritySound);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = soundObj.buffer;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(this.globalVolume * soundObj.volume, this.audioContext.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
    
    this.currentlyPlaying.push(soundName);
    
    source.onended = () => {
      const index = this.currentlyPlaying.indexOf(soundName);
      if (index > -1) this.currentlyPlaying.splice(index, 1);
    };

    soundObj.source = source;
    soundObj.gainNode = gainNode;
  }

  loop(soundName) {
    if (this.muted || !this.sounds[soundName]) return;

    const soundObj = this.sounds[soundName];
    const source = this.audioContext.createBufferSource();
    source.buffer = soundObj.buffer;
    source.loop = true;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(this.globalVolume * soundObj.volume, this.audioContext.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
    
    if (!this.currentlyPlaying.includes(soundName)) {
      this.currentlyPlaying.push(soundName);
    }

    soundObj.source = source;
    soundObj.gainNode = gainNode;
  }

  stop(soundName) {
    if (this.sounds[soundName] && this.sounds[soundName].source) {
      this.sounds[soundName].source.stop(0);
      this.sounds[soundName].source.disconnect();
      this.sounds[soundName].gainNode.disconnect();
      delete this.sounds[soundName].source;
      delete this.sounds[soundName].gainNode;
      const index = this.currentlyPlaying.indexOf(soundName);
      if (index > -1) this.currentlyPlaying.splice(index, 1);
    }
  }

  stopAll() {
    for (let soundName in this.sounds) {
      this.stop(soundName);
    }
  }

  setGlobalVolume(volume) {
    this.globalVolume = Math.max(0, Math.min(volume, 1));
    this.updateAllVolumes();
  }

  setSoundVolume(soundName, volume) {
    if (this.sounds[soundName]) {
      this.sounds[soundName].volume = Math.max(0, Math.min(volume, 1));
      this.updateSoundVolume(soundName);
    }
  }

  updateAllVolumes() {
    for (let soundName of this.currentlyPlaying) {
      this.updateSoundVolume(soundName);
    }
  }

  updateSoundVolume(soundName) {
    const soundObj = this.sounds[soundName];
    if (soundObj.gainNode) {
      soundObj.gainNode.gain.setValueAtTime(this.globalVolume * soundObj.volume, this.audioContext.currentTime);
    }
  }

  mute() {
    this.muted = true;
    this.setGlobalVolume(0);
  }

  unmute() {
    this.muted = false;
    this.setGlobalVolume(1);
  }

  toggleMute() {
    this.muted ? this.unmute() : this.mute();
  }

  isPlaying(soundName) {
    return this.currentlyPlaying.includes(soundName);
  }

  loopIfNotPlaying(soundName) {
    if (!this.isPlaying(soundName)) {
      this.loop(soundName);
    }
  }

  reset() {
    this.stopAll();
    this.currentlyPlaying = [];
    this.audioContext.close();
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    for (let soundName in this.sounds) {
      delete this.sounds[soundName].source;
      delete this.sounds[soundName].gainNode;
    }
  }
}

class Missile extends Entity {
  static cooldownTime = 15000; // 15 seconds cooldown
  static lastLaunchTime = 0;
  static defaultExplosionRadius = 100;
  static defaultDamage = 5;

  constructor(pos, size) {
    super(pos, createVector(0, -5), size); // Initial upward velocity
    this.active = true;
    this.fuel = 300; // Fuel for steering
    this.turnSpeed = 0.05;
    this.thrustPower = 0.2;
    this.explosionRadius = Missile.defaultExplosionRadius;
    this.damage = Missile.defaultDamage;
    this.particleCount = 1; // Number of particles to create per frame
    this.length = this.size * 3; // Missile length
  }

  update() {
    if (!this.active) return;
    this.handleInput();
    super.update();
    this.fuel = max(this.fuel - 0.5, 0); // Decrease fuel

    // Create thrust particles
    if (this.fuel > 0) {
      this.createThrustParticles();
    }

    // Check if missile is above screenheight or below surface
    if (this.pos.y < -0 || this.isBelowMoonSurface() || this.checkCollision() || this.fuel <= 0) {
      this.explode();
    }
  }

  handleInput() {
    if (keyIsDown(LEFT_ARROW)) this.vel.rotate(-this.turnSpeed);
    if (keyIsDown(RIGHT_ARROW)) this.vel.rotate(this.turnSpeed);
    if (keyIsDown(UP_ARROW) && this.fuel > 0) {
      let thrust = p5.Vector.fromAngle(this.vel.heading(), this.thrustPower);
      this.vel.add(thrust);
    }
  }

  createThrustParticles() {
    const thrustDirection = this.vel.copy().normalize().mult(-1); // Opposite to velocity
    const basePos = p5.Vector.add(this.pos, p5.Vector.mult(thrustDirection, this.size / 2));
    
    for (let i = 0; i < this.particleCount; i++) {
      const particleAngle = thrustDirection.heading() + random(-0.2, 0.2);
      const particleVel = p5.Vector.fromAngle(particleAngle, random(1, 3));
      Particle.create(basePos.copy(), particleVel, random(3, 7), random(20, 40));
    }
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    
    // Main body
    fill(255);
    rectMode(CENTER);
    rect(0, 0, this.length, this.size / 2, this.size / 4);
    
    // Small fins
    fill(180);
    // Top fin
    triangle(0, 0, -this.size, -this.size / 2, -this.size * 1.5, -this.size / 2);
    // Bottom fin
    triangle(0, 0, -this.size, this.size / 2, -this.size * 1.5, this.size / 2);
    
    // Nose cone
    fill(200);
    triangle(this.length / 2, 0, this.length / 3, -this.size / 4, this.length / 3, this.size / 4);
    
    // Exhaust
    if (this.fuel > 0 && keyIsDown(UP_ARROW)) { 
      fill(255, 100, 0);
      triangle(-this.length / 2, 0, -this.length / 2 - this.size / 2, -this.size / 4, -this.length / 2 - this.size / 2, this.size / 4);
    }
    
    pop();
    
    // Draw fuel bar
    push();
    translate(this.pos.x, this.pos.y - this.size);
    //noStroke();
    fill(255, 0, 0);
    rect(0, 0, this.fuel / 100 * this.length, 2);
    pop();
  }

  isBelowMoonSurface() {
    // Assuming moonSurface is an array of points defining the moon's surface
    for (let i = 0; i < moonSurface.length - 1; i++) {
      let p1 = moonSurface[i];
      let p2 = moonSurface[i + 1];
      if (this.pos.x >= p1.x && this.pos.x <= p2.x) {
        let surfaceY = map(this.pos.x, p1.x, p2.x, p1.y, p2.y);
        if (this.pos.y > surfaceY) {
          return true;
        }
      }
    }
    return false;
  }

  checkCollision() {
    // Check collision with moon surface
    for (let i = 0; i < moonSurface.length - 1; i++) {
      if (distToSegment(this.pos, moonSurface[i], moonSurface[i + 1]) < this.size / 2) {
        return true;
      }
    }
    // Check collision with aliens, nests, etc. - use squared distance
    let targets = [...(alienKing ? [alienKing] : []),...(alienQueen ? [alienQueen] : []), ...Alien.aliens, ...Nest.nests, ...AlienFortress.fortresses, ...Hunter.hunters, ...Destroyer.destroyers, ...Zapper.zappers];
    const halfSizePlusThreshold = this.size / 2;
    for (let target of targets) {
      const dx = this.pos.x - target.pos.x;
      const dy = this.pos.y - target.pos.y;
      const minDist = halfSizePlusThreshold + target.size / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        return true;
      }
    }
    // Check collision with plants (use currentSize for precision)
    for (let plant of AlienPlant.plants) {
      const dx = this.pos.x - plant.pos.x;
      const dy = this.pos.y - plant.pos.y;
      const minDist = halfSizePlusThreshold + (plant.currentSize || plant.size) / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        return true;
      }
    }
    return false;
  }

  explode() {
    this.active = false;
    explosions.push(new Explosion(this.pos, this.explosionRadius * 2, color(255, 0, 0), color(255, 100, 0)));
    soundManager.play('missileImpact');
    
    // Damage nearby entities
    this.damageNearbyEntities();
    // Switch camera back to ship
    cameraFollowsMissile = false;
  }

damageNearbyEntities() {
  let targets = [...(alienKing ? [alienKing] : []), ...(alienQueen ? [alienQueen] : []), ...Alien.aliens, ...Nest.nests, ...AlienFortress.fortresses, ...Hunter.hunters, ...Destroyer.destroyers, ...Zapper.zappers, ...MoonBase.moonBases];
  
  for (let target of targets) {
    // Use squared distance to avoid sqrt until needed for damage calculation
    const dx = this.pos.x - target.pos.x;
    const dy = this.pos.y - target.pos.y;
    const distSq = dx * dx + dy * dy;
    const adjustedRadius = this.explosionRadius + target.size / 2;
    const adjustedRadiusSq = adjustedRadius * adjustedRadius;

    // Check if target is within the adjusted explosion radius
    if (distSq < adjustedRadiusSq) {
      // Only calculate sqrt when we know we need it for damage calculation
      const distance = Math.sqrt(distSq);
      // Adjust damage scaling based on the distance and adjusted radius
      let damage = map(distance, 0, adjustedRadius, this.damage, 0);

      // Apply damage to the target
      if (target.takeDamage) {
        target.takeDamage(damage);
      } else if (target.health !== undefined) {
        target.health -= damage;
      }
    }
  }

  // Damage AlienWorms
  for (let worm of AlienWorm.worms) {
    if (worm && worm.segments && worm.segments.length > 0) {
      const dx = this.pos.x - worm.segments[0].pos.x;
      const dy = this.pos.y - worm.segments[0].pos.y;
      const explosionRadiusSq = this.explosionRadius * this.explosionRadius;
      if (dx * dx + dy * dy < explosionRadiusSq) {
        worm.takeDamage(this.damage);
      }
    }
  }

  // Destroy AlienPlants
  AlienPlant.checkCollisionWithBomb(this);
}


  static launchMissile() {

  if (activeMissile && activeMissile.active) {
    activeMissile.explode(); // Destroy the current active missile
    return; // Return without launching a new missile
  }

    let currentTime = millis();
    if (!cameraFollowsMissile && currentTime - this.lastLaunchTime >= this.cooldownTime) {
      let missilePos = ship.pos.copy().add(0, -ship.size);
      activeMissile = new Missile(missilePos, 10);
      cameraFollowsMissile = true;
      soundManager.play('missileLaunch');
      this.lastLaunchTime = currentTime;
    }
  }

  static updateMissile() {
    if (activeMissile) {
      if (activeMissile.active) {
        activeMissile.update();
        if (cameraFollowsMissile) {
          cameraOffset = constrain(activeMissile.pos.x - width / 2, 0, worldWidth - width);
        }
      } else {
        activeMissile = null;
        cameraFollowsMissile = false;
      }
    }
  }

  static drawMissile() {
    if (activeMissile && activeMissile.active) {
      activeMissile.draw();
    }
  }

  static getRemainingCooldown() {
    let currentTime = millis();
    let elapsedTime = currentTime - this.lastLaunchTime;
    return Math.max(0, this.cooldownTime - elapsedTime);
  }
}

class Drone extends Entity {
  constructor(pos, vel, size) {
    super(pos, vel, size);
    this.speed = 2;
    this.bombCooldown = 30;
    this.bombTimer = 0;
    this.active = false; // Active state for tracking if drone is in the game
  
    // Freeze Burst properties
    this.burstDefenseRadius = 200; // Same as Turret.defaultRange
    this.burstDefenseCooldown = 0;
    this.burstDefenseMaxCooldown = 300; // 5 seconds cooldown
    this.freezeDuration = 180; // 3 seconds frozen
    this.burstDefenseAnimationFrames = 30;
    this.currentBurstFrame = 0;
  }

  update() {

    this.applyWind();
    this.handleInput();
    super.update();

    // Handle camera follow
    if (cameraFollowsDrone) {
      cameraOffset = constrain(this.pos.x - width / 2, 0, worldWidth - width);
    }

    // Handle bomb timer
    this.bombTimer = max(0, this.bombTimer - 1);

    // Check collision with surfaces or enemies
    if (this.checkCollision()) {
      this.destroy();
    }

//burstdefence
    if (this.burstDefenseCooldown > 0) {
      this.burstDefenseCooldown--;
    }
    if (this.currentBurstFrame > 0) {
      this.currentBurstFrame--;
    }
    this.updateFreezeBurstDefense();
  }




applyWind() {
  const windEffect = wind.copy().mult(0.2); // Scale wind down to a reasonable force
  this.vel.add(windEffect); // Directly add a small portion of wind force
  this.vel.limit(0.4); // Prevent excessive acceleration
}


  handleInput() {
    if (keyIsDown(LEFT_ARROW)) this.pos.x -= this.speed;
    if (keyIsDown(RIGHT_ARROW)) this.pos.x += this.speed;
    if (keyIsDown(UP_ARROW)) this.pos.y -= this.speed;
    if (keyIsDown(DOWN_ARROW)) this.pos.y += this.speed;

    // Bomb drop with spacebar
    if (keyIsDown(32) && this.bombTimer === 0) {
      this.dropBomb();
      this.bombTimer = this.bombCooldown;
    }
  }

  dropBomb() {
    let bombPos = createVector(this.pos.x, this.pos.y + this.size / 2);
    let bombVel = createVector(0, 2);
    let bombSize = 10;
    bombs.push(new Bomb(bombPos, bombVel, bombSize));
  }

  checkCollision() {
    // Check for collision with moon surface or enemies
    const thresholdSq = (this.size / 2) * (this.size / 2);
    for (let i = 0; i < moonSurface.length - 1; i++) {
      let start = moonSurface[i];
      let end = moonSurface[i + 1];
      if (distToSegmentSq(this.pos, start, end) < thresholdSq) return true;
    }

    let entities = [...Nest.nests, ...AlienFortress.fortresses, ...Alien.aliens, ...Hunter.hunters, ...Zapper.zappers, ...Destroyer.destroyers];
    for (let entity of entities) {
      const dx = this.pos.x - entity.pos.x;
      const dy = this.pos.y - entity.pos.y;
      const minDist = (this.size + entity.size) / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        return true;
      }
    }
    return false;
  }

  destroy() {
    this.active = false;
    cameraFollowsDrone = false;
    explosions.push(new Explosion(this.pos, 20)); // Explosion effect
    soundManager.play('shipBomb');
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    
    fill(255);
    // Draw the main body (a saucer-like shape)
    ellipse(0, 0, this.size * 2, this.size); // Main body

    // Draw some propellers or details on the drone (e.g., smaller circles)
    fill(150);
    ellipse(0, -this.size / 2, 10, 5); // Top propeller
    ellipse(0, this.size / 2, 10, 5); // Bottom propeller
    pop();

        // Draw freeze burst animation
    if (this.currentBurstFrame > 0) {
      let progress = this.currentBurstFrame / this.burstDefenseAnimationFrames;
      let radius = this.burstDefenseRadius * (1 - progress);
      noFill();
      stroke(100, 100, 255, 255 * progress); // Blue freeze burst effect
      strokeWeight(3 * progress);
      ellipse(this.pos.x, this.pos.y, radius * 2);
      noStroke();
    }
  }

  activateFreezeBurstDefense() {
    if (this.burstDefenseCooldown > 0) {
      return;
    }

    if (!this.hasTargetsInBurstRange()) {
      return;
    }

    this.burstDefenseCooldown = this.burstDefenseMaxCooldown;
    this.currentBurstFrame = this.burstDefenseAnimationFrames;

    // Create an array of all alien types
    let allAliens = [
      ...Alien.aliens,
      ...Hunter.hunters,
      ...Zapper.zappers,
      ...Destroyer.destroyers
    ];

    // Apply freeze effect to all aliens within range
    for (let alien of allAliens) {
      let d = dist(this.pos.x, this.pos.y, alien.pos.x, alien.pos.y);
      if (d < this.burstDefenseRadius) {
        alien.freeze(this.freezeDuration);
      }
    }

    // Freeze AlienWorms (check head segment)
    for (let worm of AlienWorm.worms) {
      if (worm && worm.segments && worm.segments.length > 0) {
        let head = worm.segments[0]; // Head segment
        let d = dist(this.pos.x, this.pos.y, head.pos.x, head.pos.y);
        if (d < this.burstDefenseRadius) {
          worm.freeze(this.freezeDuration);
        }
      }
    }

    soundManager.play('turretFreezeBurst');
  }

  updateFreezeBurstDefense() {
    if (this.burstDefenseCooldown <= 0) {
      this.activateFreezeBurstDefense();
    }
  }

  hasTargetsInBurstRange() {
    const radius = this.burstDefenseRadius;
    const checkEntity = (entity) => {
      if (!entity || !entity.pos) {
        return false;
      }
      return dist(this.pos.x, this.pos.y, entity.pos.x, entity.pos.y) < radius;
    };

    if (
      Alien.aliens.some(checkEntity) ||
      Hunter.hunters.some(checkEntity) ||
      Zapper.zappers.some(checkEntity) ||
      Destroyer.destroyers.some(checkEntity)
    ) {
      return true;
    }

    for (const worm of AlienWorm.worms) {
      if (worm && worm.segments && worm.segments[0] && checkEntity({ pos: worm.segments[0].pos })) {
        return true;
      }
    }

    return false;
  }

static launchDrone() {
  if (activeDrone && activeDrone.active) {
    activeDrone.destroy(); // Destroy the current active drone
    return; // Return without launching a new drone
  }
  
let dronePos;
if (isWalking) {
  dronePos = astronaut.pos.copy().add(0, -astronaut.size);
} else {
  dronePos = ship.pos.copy().add(0, -ship.size);
}

    let startVelocity = createVector(0, 0);
    let size = 12;
    activeDrone = new Drone(dronePos, startVelocity, size);
    activeDrone.active = true; // Make sure activeDrone is initialized correctly
    cameraFollowsDrone = true;

}

  static updateDrone() {
    if (activeDrone && activeDrone.active) {
      activeDrone.update();
    }
  }

  static drawDrone() {
    if (activeDrone && activeDrone.active) {
      activeDrone.draw();
    }
  }
}

class BaseDrone extends Drone {
  constructor(pos, vel, size, homeBase) {
    super(pos, vel, size);
    this.homeBase = homeBase;
    this.patrolRadius = homeBase.dronePatrolRadius;
    this.speed = 1.5;
    this.bombCooldown = 240; // 4 seconds between bombs
    this.bombTimer = 0;
    this.targetAcquisitionRange = 250;
    this.currentTarget = null;
    this.patrolAngle = random(TWO_PI);
    this.patrolSpeed = 0.01;
  }

  update() {
    // AI behavior first
    this.updateAI();
    
    // Apply wind
    this.applyWind();
    
    // Update position (Entity.update() without Drone input handling)
    this.pos.add(this.vel);
    this.pos.x = (this.pos.x + worldWidth) % worldWidth;

    // Handle bomb timer
    this.bombTimer = max(0, this.bombTimer - 1);

    // Check collision with surfaces or enemies
    if (this.checkCollision()) {
      this.destroy();
    }

    // Freeze burst defense
    if (this.burstDefenseCooldown > 0) {
      this.burstDefenseCooldown--;
    }
    if (this.currentBurstFrame > 0) {
      this.currentBurstFrame--;
    }
    this.updateFreezeBurstDefense();
  }

  updateAI() {
    // Find closest target
    this.currentTarget = this.findClosestTarget();

    if (this.currentTarget) {
      // Move toward target
      this.moveTowardTarget();
      
      // Try to drop bomb if above target
      if (this.bombTimer === 0 && this.isAboveTarget()) {
        this.dropBomb();
        this.bombTimer = this.bombCooldown;
      }
    } else {
      // Patrol around home base
      this.patrol();
    }

    // Constrain to patrol area
    this.constrainToPatrolArea();
  }

  findClosestTarget() {
    let closestTarget = null;
    let closestDist = Infinity;

    const checkEntity = (entity) => {
      if (entity && entity.pos) {
        let d = dist(this.pos.x, this.pos.y, entity.pos.x, entity.pos.y);
        if (d < closestDist && d < this.targetAcquisitionRange) {
          closestTarget = entity;
          closestDist = d;
        }
      }
    };

    // Check all hostile entities
    Alien.aliens.forEach(checkEntity);
    Destroyer.destroyers.forEach(checkEntity);
    Zapper.zappers.forEach(checkEntity);
    Hunter.hunters.forEach(checkEntity);
    Nest.nests.forEach(checkEntity);
    AlienFortress.fortresses.forEach(checkEntity);

    return closestTarget;
  }

  moveTowardTarget() {
    if (!this.currentTarget || !this.currentTarget.pos) return;

    let targetPos = this.currentTarget.pos.copy();
    // Hover above target
    targetPos.y -= 50;

    let direction = p5.Vector.sub(targetPos, this.pos);
    direction.limit(this.speed);
    this.vel.add(direction).limit(this.speed);
  }

  isAboveTarget() {
    if (!this.currentTarget || !this.currentTarget.pos) return false;
    
    let horizontalDist = abs(this.pos.x - this.currentTarget.pos.x);
    let verticalDist = this.currentTarget.pos.y - this.pos.y;
    
    return horizontalDist < 30 && verticalDist > 0 && verticalDist < 200;
  }

  patrol() {
    // Patrol in a circle around the base
    this.patrolAngle += this.patrolSpeed;
    
    let baseCenter = createVector(
      this.homeBase.pos.x + this.homeBase.width / 2,
      this.homeBase.pos.y - 100
    );
    
    let targetPatrolPos = createVector(
      baseCenter.x + cos(this.patrolAngle) * (this.patrolRadius * 0.5),
      baseCenter.y + sin(this.patrolAngle) * (this.patrolRadius * 0.3)
    );
    
    let direction = p5.Vector.sub(targetPatrolPos, this.pos);
    direction.limit(this.speed * 0.5);
    this.vel.add(direction).limit(this.speed * 0.5);
  }

  constrainToPatrolArea() {
    // base.pos.x is now already at center
    let baseCenter = createVector(
      this.homeBase.pos.x,
      this.homeBase.pos.y
    );
    
    // Use squared distance to avoid sqrt
    const dx = this.pos.x - baseCenter.x;
    const dy = this.pos.y - baseCenter.y;
    const distFromBaseSq = dx * dx + dy * dy;
    const patrolRadiusSq = this.patrolRadius * this.patrolRadius;
    
    if (distFromBaseSq > patrolRadiusSq) {
      let direction = p5.Vector.sub(baseCenter, this.pos);
      direction.setMag(this.speed);
      this.vel = direction;
    }
  }
  
  checkCollision() {
    return super.checkCollision();
  }

  destroy() {
    this.active = false;
    explosions.push(new Explosion(this.pos, 20));
    soundManager.play('shipBomb');
    
    // Notify home base
    if (this.homeBase) {
      this.homeBase.onDroneDestroyed();
    }
  }

  handleInput() {
    // BaseDrone is AI-controlled, no input handling
  }
}

class BarrageBalloon extends Bomb {
  constructor(pos, size = 30) {
    super(pos, createVector(0, -1), size);
    this.anchorX = pos.x;
    this.tetherLength = 0;
    this.maxTetherLength = random(100, 300);
    this.maxHeight = pos.y - this.maxTetherLength;
    this.windInfluence = 3;
    this.swayAngle = 0;
    this.swaySpeed = 0.02;
    this.swayAmount = 3;
    this.riseSpeed = 0.2;
    this.isRising = true;
    this.health = 1;
  }

  update() {
  let surfaceY = getCachedSurfaceYAtX(this.anchorX);

    if (this.isRising) {
      this.pos.y -= this.riseSpeed;
      if (this.pos.y <= this.maxHeight) {
        this.pos.y = this.maxHeight;
        this.isRising = false;
      }
    } else {
      // Calculate wind effect, now including vertical component
      let windOffset = wind.copy().mult(this.windInfluence * this.maxTetherLength);
      let basePos = createVector(
        this.anchorX + windOffset.x,
        surfaceY - this.maxTetherLength + windOffset.y
      );

      // Apply sway
      this.swayAngle += this.swaySpeed;
      let swayOffset = createVector(
        cos(this.swayAngle) * this.swayAmount,
        sin(this.swayAngle) * this.swayAmount
      );
      
      this.pos = p5.Vector.add(basePos, swayOffset);

      // Apply wind resistance
      let distanceFromAnchor = p5.Vector.sub(this.pos, createVector(this.anchorX, surfaceY));
      let resistance = distanceFromAnchor.copy().mult(-0.01);
      this.pos.add(resistance);
    }

    // Constrain balloon position based on tether length
    let anchorPos = createVector(this.anchorX, surfaceY);
    let toAnchor = p5.Vector.sub(anchorPos, this.pos);
    if (toAnchor.mag() > this.maxTetherLength) {
      toAnchor.setMag(this.maxTetherLength);
      this.pos = p5.Vector.sub(anchorPos, toAnchor);
    }

    // Keep within world bounds
    this.pos.x = constrain(this.pos.x, 0, worldWidth);
    this.pos.y = constrain(this.pos.y, 0, height);

    return this.checkAlienCollision();
  }

  draw() {
    push();
    // Draw tether
    strokeWeight(0.3);
    stroke(150);
  let surfaceY = getCachedSurfaceYAtX(this.anchorX);
    line(this.anchorX, surfaceY, this.pos.x, this.pos.y);

    // Draw balloon
    fill(200, 200, 0);
    ellipse(this.pos.x, this.pos.y, this.size);

    pop();
  }

    takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.explode();
    }
  }
  
checkAlienCollision() {
  let alienTypes = [Alien.aliens, Hunter.hunters, Zapper.zappers, Destroyer.destroyers, AlienFortress.fortresses];
  for (let alienGroup of alienTypes) {
    for (let i = alienGroup.length - 1; i >= 0; i--) {
      let alien = alienGroup[i];
      // Use squared distance to avoid sqrt
      const dx = this.pos.x - alien.pos.x;
      const dy = this.pos.y - alien.pos.y;
      const minDist = (this.size + alien.size) / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        
        // Damadge the alien
        alien.health -= 5;
        soundManager.play('alienDestruction');
        explosions.push(new Explosion(alien.pos, alien.size, color(0, 255, 0), color(0, 100, 0)));
        
        // Destroy the balloon
        this.explode();
        return true; // Collision detected and handled
      }
    }
  }
  
  
  
  // Check collision with AlienWorms
  for (let i = AlienWorm.worms.length - 1; i >= 0; i--) {
    let worm = AlienWorm.worms[i];
    for (let segment of worm.segments) {
      // Use squared distance to avoid sqrt
      const dx = this.pos.x - segment.pos.x;
      const dy = this.pos.y - segment.pos.y;
      const minDist = (this.size + segment.size) / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        // Damage the worm
        if (worm.takeDamage(2)) { // Assuming 2 damage per collision
          AlienWorm.worms.splice(i, 1);
          soundManager.play('wormDead');
        }
        
        // Destroy the balloon
        this.explode();
        return true; // Collision detected and handled
      }
    }
  }  
  
  
  
  
  return false;
}

  
  explode() {
      explosions.push(new Explosion(this.pos, this.explosionRadius * 2, color(200, 200, 0), color(150, 150, 0)));
    

  }
}

class Upgrades {
  constructor() {
    this.availableUpgrades = {
      energyCharge: { cost: 4000, level: 0, maxLevel: 1000, description: "Energy Charge +10000" },
      energyCapacity: { cost: 3000, level: 0, maxLevel: 5, description: "Upgrade Energy Capacity" },
      moonBase: { cost: 1500, level: 0, maxLevel: 5, description: "Upgrade Base Armour" },
      shipSpeed: { cost: 1500, level: 0, maxLevel: 5, description: "Improve Ship Maneuverability" },
      parachute: { cost: 1000, level: 0, maxLevel: 3, description: "Upgrade Parachute" },
      astronautSpeed: { cost: 1500, level: 0, maxLevel: 2, description: "Upgrade Spacesuit" },
      bulletDamage: { cost: 1500, level: 0, maxLevel: 3, description: "Increase bullet damage" },
      shieldNumber: { cost: 2500, level: 0, maxLevel: 6, description: "Upgrade No. Shields" },
      turret: { cost: 1800, level: 0, maxLevel: 4, description: "Upgrade Turret" },
      barrageBalloon: { cost: 1000, level: 0, maxLevel: 8, description: "Upgrade Barrage Balloons" },
      cruiseMissile: { cost: 1800, level: 0, maxLevel: 5, description: "Upgrade Cruise Missile" },
      wingMan: { cost: 4000, level: 0, maxLevel: 3, description: "Upgrade Wingmen" },
      bombDamage: { cost: 2000, level: 0, maxLevel: 5, description: "Upgrade Bombs" },
      walkerRobot: { cost: 2000, level: 0, maxLevel: 4, description: "Upgrade Walker Robots" },
      drillRig: { cost: 2000, level: 0, maxLevel: 3, description: "Upgrade Drill Rigs" }
    };
    this.initialUpgrades = JSON.parse(JSON.stringify(this.availableUpgrades));
  }

  canPurchase(upgradeName) {
    const upgrade = this.availableUpgrades[upgradeName];
    return upgrade.level < upgrade.maxLevel && money >= upgrade.cost;
  }

  purchase(upgradeName) {
    if (this.canPurchase(upgradeName)) {
      const upgrade = this.availableUpgrades[upgradeName];
      money -= upgrade.cost;
      upgrade.level++;
      this.applyUpgrade(upgradeName);

    // Increase the cost of the chosen upgrade by 1.9
    upgrade.cost = Math.floor(upgrade.cost * 1.9);

    // Increase the cost of all other upgrades by 1.2
    for (let key in this.availableUpgrades) {
      if (key !== upgradeName && this.availableUpgrades[key].level < this.availableUpgrades[key].maxLevel) {
        this.availableUpgrades[key].cost = Math.floor(this.availableUpgrades[key].cost * 1.2);
      }
    }

      return true;
    }
    return false;
  }

  reset() {
    // Reset upgrades to their initial state
    this.availableUpgrades = JSON.parse(JSON.stringify(this.initialUpgrades));
    this.revertUpgradeEffects();
  }

  revertUpgradeEffects() {
    // Revert all upgrade effects to their default values
    ship.thrustPower = 0.1;
    ship.rotationSpeed = 0.05;
    astronaut.walkSpeed = 2;
    maxEnergy = 15000;
    Shield.MAX_SHIELDS = 3;
    Turret.defaultHealth = 4;
    Turret.defaultRange = 200;
    Turret.ShootCooldown = 120;
    MoonBase.maxBalloons = 0;

    MoonBase.moonBases.forEach(base => {
    base.maxHealth = 100;
    base.towerWidth = 10;
    base.radarDishRadius = 15;
    base.healRate = 1;
    });

    Bullet.damageMultiplier = 1;
    Bullet.updatePlayerBulletColour();
    Bomb.defaultExplosionRadius = 30;
    Bomb.defaultBombDamage = 3;
    Wingman.MAX_WINGMEN = 0;
    Missile.defaultExplosionRadius = 100;
    Missile.defaultDamage = 5;
    DrillRig.ENERGY_GENERATION_RATE = 0.1;
    WalkerRobot.SHOOT_SPEED = 40;
    WalkerRobot.MAX_WALKERS = 0;
  }

  
  applyUpgrade(upgradeName) {
    switch (upgradeName) {
      case 'energyCharge':
        energy += 10000;      
        if (energy > maxEnergy) {
          energy = maxEnergy;
        }
        break;
      case 'energyCapacity':
        maxEnergy += 5000;
        break;
      case 'moonBase':
        MoonBase.moonBases.forEach(base => {
        base.towerWidth += 1;
        base.radarDishRadius += 1;
        base.maxHealth += 50;
        base.healRate += 1;
        base.health = base.maxHealth; // Heal base to full after upgrade
        });
        break;
      case 'shipSpeed':
        ship.thrustPower += 0.02;
        ship.rotationSpeed += 0.01;
        break;
      case 'astronautSpeed':
        astronaut.walkSpeed += 1;
        astronaut.bombThrowCooldownTime -= 2;
        astronaut.updateSpriteColor();
        break;
      case 'parachute':
        ship.parachuteSize += 5;
        ship.parachuteDrag = ship.parachuteDrag*2;
        break;
      case 'bulletDamage':
        Bullet.damageMultiplier += 0.5;
        Bullet.updatePlayerBulletColour(); // Update colour
        break;
      case 'bombDamage':
        Bomb.defaultExplosionRadius += 25;
        Bomb.defaultBombDamage += 1;
        Bomb.updateBombColour();
        break;      
      case 'shieldNumber':
        Shield.MAX_SHIELDS += 1;
        break;
      case 'turret':
        Turret.defaultHealth += 2;
        Turret.defaultRange += 100;
        Turret.ShootCooldown -= 12;      
        break;
      case 'barrageBalloon':
        MoonBase.maxBalloons += 1;
        break;
      case 'wingMan':
        Wingman.MAX_WINGMEN += 1;
        break;  
      case 'cruiseMissile':
        Missile.defaultExplosionRadius += 100;
        Missile.defaultDamage += 3;
        break;  
      case 'drillRig':
        DrillRig.ENERGY_GENERATION_RATE += 0.2;
        break;  
      case 'walkerRobot':
        WalkerRobot.SHOOT_SPEED -= 12;
        WalkerRobot.MAX_WALKERS += 1;
        break;  
    }
  }
}

class UpgradeMenu {
  constructor(upgrades) {
    this.upgrades = upgrades;
    this.isOpen = false;
    this.selectedUpgrade = 0;
    this.scrollOffset = 0;
    this.itemHeight = 50;
    this.scrollBarWidth = 20;
    this.menuPadding = 80; // Space for title and instructions
    this.scrollBarPadding = 2; // Padding for scroll bar
    this.updateDimensions();
  }

  updateDimensions() {
    this.menuWidth = min(600, width * 0.8); // Cap the width at 600 or 80% of screen width
    this.menuHeight = min(500, height * 0.8); // Cap the height at 500 or 80% of screen height
    this.menuX = (width - this.menuWidth) / 2;
    this.menuY = (height - this.menuHeight) / 2;
  }
  
  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.scrollOffset = 0;
      this.selectedUpgrade = 0;
      GameTimer.pauseAll(); // Pause all timers when menu is opened
      //logActiveTimers();

      
    } else {
      GameTimer.resumeAll(); // Resume all timers when menu is closed     
    }
  }

  draw() {
    if (!this.isOpen) return;

    push();
    translate(this.menuX, this.menuY);

    // Draw menu background
    fill(100, 100, 255);
    rect(0, 0, this.menuWidth, this.menuHeight);

    // Draw menu title
    textAlign(CENTER, TOP);
    fill(255);
    textSize(32);
    text("UPGRADES", this.menuWidth / 2, 20);

    const upgradeEntries = Object.entries(this.upgrades.availableUpgrades);
    const totalUpgrades = upgradeEntries.length;

    // Calculate visible items (ensure at least 1)
    this.visibleItems = Math.max(1, Math.floor((this.menuHeight - this.menuPadding) / this.itemHeight));

    // Calculate total menu height and max scroll
    const totalContentHeight = totalUpgrades * this.itemHeight;
    const visibleContentHeight = this.visibleItems * this.itemHeight;
    const maxScroll = Math.max(0, totalContentHeight - visibleContentHeight);

    // Draw upgrades
    let y = 60;
    textSize(20);
    for (let i = 0; i < this.visibleItems; i++) {
      const index = i + Math.floor(this.scrollOffset / this.itemHeight);
      if (index >= totalUpgrades) break;

      const [name, upgrade] = upgradeEntries[index];
      fill(index === this.selectedUpgrade ? color(255, 255, 0) : 255);
      textAlign(LEFT, TOP);
      text(`${upgrade.description} - (${upgrade.level} of ${upgrade.maxLevel})`, 20, y);
      textAlign(RIGHT, TOP);
      
      //If option is too expensive or at max - make it red
      if ((upgrade.cost > money)||(upgrade.level >= upgrade.maxLevel)){
        fill(255,100,0);
      }else{
        fill(255);
      }
      
      text(`Cost: ${upgrade.cost}`, this.menuWidth - this.scrollBarWidth - 20, y);
      y += this.itemHeight;
    }

    // Draw scroll bar if necessary
    if (totalContentHeight > visibleContentHeight) {
      const scrollBarHeight = (visibleContentHeight / totalContentHeight) * visibleContentHeight;
      const scrollBarY = 60 + (this.scrollOffset / maxScroll) * (visibleContentHeight - scrollBarHeight);
      fill(200);
      rect(this.menuWidth - this.scrollBarWidth, 60, this.scrollBarWidth, visibleContentHeight);
      fill(150);
      rect(this.menuWidth - this.scrollBarWidth + this.scrollBarPadding, scrollBarY + this.scrollBarPadding, 
           this.scrollBarWidth - 2 * this.scrollBarPadding, scrollBarHeight - 2 * this.scrollBarPadding);
    }

    // Draw instructions
    textAlign(CENTER, BOTTOM);
    fill(255);
    textSize(16);
    text("ENTER to purchase, U to close", this.menuWidth / 2, this.menuHeight - 10);

    pop();
  }

  handleInput(keyCode) {
    if (!this.isOpen) return;

    const totalUpgrades = Object.keys(this.upgrades.availableUpgrades).length;
    if (totalUpgrades === 0) return;

    switch (keyCode) {
      case UP_ARROW:
        this.selectedUpgrade = (this.selectedUpgrade - 1 + totalUpgrades) % totalUpgrades;
        this.adjustScroll();
        break;
      case DOWN_ARROW:
        this.selectedUpgrade = (this.selectedUpgrade + 1) % totalUpgrades;
        this.adjustScroll();
        break;
      case ENTER:
        const upgradeName = Object.keys(this.upgrades.availableUpgrades)[this.selectedUpgrade];
        const upgrade = this.upgrades.availableUpgrades[upgradeName];
        if (upgrade.level >= upgrade.maxLevel) {
          announcer.speak(`${upgradeName} at maximum level`,0, 2);
        } else if (money < upgrade.cost) {
          announcer.speak(`Not enough money`,0, 2);
        } else if (this.upgrades.purchase(upgradeName)) {
          //announcer.speak(`${upgradeName} upgraded`,0, 2);
        } else {
          announcer.speak(`Unable to upgrade ${upgradeName}`,0, 2);
        }
        break;
      case ESCAPE:
        this.toggle();
        break;
    }
  }

  adjustScroll() {
    const totalUpgrades = Object.keys(this.upgrades.availableUpgrades).length;
    const totalContentHeight = totalUpgrades * this.itemHeight;
    const visibleContentHeight = this.visibleItems * this.itemHeight;
    const maxScroll = Math.max(0, totalContentHeight - visibleContentHeight);
    
    // Adjust scroll to keep the selected item in view
    if (this.selectedUpgrade * this.itemHeight < this.scrollOffset) {
      this.scrollOffset = this.selectedUpgrade * this.itemHeight;
    } else if ((this.selectedUpgrade + 1) * this.itemHeight > this.scrollOffset + visibleContentHeight) {
      this.scrollOffset = (this.selectedUpgrade + 1) * this.itemHeight - visibleContentHeight;
    }
    
    // Ensure scroll doesn't go out of bounds
    this.scrollOffset = constrain(this.scrollOffset, 0, maxScroll);
  }

  refresh() {
    this.selectedUpgrade = 0;
    this.scrollOffset = 0;
    this.isOpen = false;
  }
}

class Debug {
  constructor() {
    if (Debug.instance) {
      return Debug.instance;
    }
    Debug.instance = this;
    
    this.isEnabled = false;
    this.startTime = Date.now();
    this.logHistory = [];
    this.maxLogHistory = 10000;
    this.visualDebugs = {};
  }

  static getInstance() {
    if (!Debug.instance) {
      Debug.instance = new Debug();
    }
    return Debug.instance;
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    console.log(`Debug mode is now ${this.isEnabled ? 'ON' : 'OFF'}`);
    this.log(`Debug mode is now ${this.isEnabled ? 'ON' : 'OFF'}`);
  }

  log(message, ...args) {
    if (!this.isEnabled) return;
    const logEntry = `[${this.getTimestamp()}] ${message}`;
    console.log(logEntry, ...args);
    this.addToLogHistory(logEntry);
  }

  warn(message, ...args) {
    if (!this.isEnabled) return;
    const logEntry = `[${this.getTimestamp()}] WARNING: ${message}`;
    console.warn(logEntry, ...args);
    this.addToLogHistory(logEntry);
  }

  error(message, ...args) {
    if (!this.isEnabled) return;
    const logEntry = `[${this.getTimestamp()}] ERROR: ${message}`;
    console.error(logEntry, ...args);
    this.addToLogHistory(logEntry);
  }

  getTimestamp() {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const milliseconds = elapsed % 1000;
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
  }

  addToLogHistory(logEntry) {
    this.logHistory.push(logEntry);
    if (this.logHistory.length > this.maxLogHistory) {
      this.logHistory.shift();
    }
  }

  saveLogsToFile() {
    console.log("Attempting to save logs to file...");
    if (this.logHistory.length === 0) {
      console.warn("No logs to save.");
      return;
    }

    try {
      const blob = new Blob([this.logHistory.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug_log_${new Date().toISOString()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("Debug logs saved to file successfully.");
    } catch (error) {
      console.error("Error saving logs to file:", error);
    }
  }

  setVisualDebug(key, value) {
    this.visualDebugs[key] = value;
  }

  getVisualDebug(key) {
    return this.visualDebugs[key];
  }

  drawOnScreen() {
    push();
    textAlign(LEFT, TOP);
    textSize(12);
    fill(255);
    
    // Draw visual debugs
    let yOffset = 10;
    for (const [key, value] of Object.entries(this.visualDebugs)) {
      text(`${key}: ${value}`, 10, yOffset);
      yOffset += 20;
    }

    // Draw last few log entries
    yOffset = height - 100;
    for (let i = this.logHistory.length - 1; i >= Math.max(0, this.logHistory.length - 5); i--) {
      text(this.logHistory[i], 10, yOffset);
      yOffset -= 20;
    }

    pop();
  }

  measureExecutionTime(func, label) {
    const start = performance.now();
    const result = func();
    const end = performance.now();
    this.log(`${label} execution time: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  drawHitbox(entity) {
    push();
    noFill();
    stroke(255, 0, 0);
    if (entity.size) {
      ellipse(entity.pos.x, entity.pos.y, entity.size, entity.size);
    } else if (entity.width && entity.height) {
      rect(entity.pos.x, entity.pos.y, entity.width, entity.height);
    }
    pop();
  }
}

class AmbientMusicGenerator {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.baseVolume = 0.15;
    this.energyFactor = 1;

    // Musical parameters
    this.scale = [0, 2, 4, 5, 7, 9, 11]; // Major scale
    this.baseNote = 48; // C2 for a deeper sound
    this.chordProgression = [0, 5, 3, 4]; // I-VI-IV-V progression
    this.currentChordIndex = 0;

    this.pads = [];
    this.melody = null;

    this.createPads();
    this.createMelody();
    this.isPlaying = false;
  }

  createPads() {
    for (let i = 0; i < 4; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();

      osc.type = 'sine';
      gain.gain.value = this.baseVolume * 0.25;

      lfo.type = 'sine';
      lfo.frequency.value = 0.01 + Math.random() * 0.02; // 0.01 to 0.03 Hz (30 to 100 seconds per cycle)
      lfoGain.gain.value = 0.1 + Math.random() * 0.1; // 0.1 to 0.2 Hz depth

      osc.connect(gain);
      gain.connect(this.masterGain);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      this.pads.push({ osc, gain, lfo, lfoGain });
    }
  }

  createMelody() {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc.type = 'sine';
    gain.gain.value = 0;
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    this.melody = { osc, gain, filter };
  }

  start() {
    if (this.isPlaying) return;
    
    const now = this.audioContext.currentTime;
    this.pads.forEach(pad => {
      pad.osc.start(now);
      pad.lfo.start(now);
    });
    this.melody.osc.start(now);
    this.playChordProgression();
    this.playMelody();
    this.isPlaying = true;
  }

  stop() {
    if (!this.isPlaying) return;
    
    const now = this.audioContext.currentTime;
    this.pads.forEach(pad => {
      pad.osc.stop(now);
      pad.lfo.stop(now);
    });
    this.melody.osc.stop(now);
    this.isPlaying = false;
  }

  reset() {
    this.stop();
    this.pads = [];
    this.melody = null;
    this.currentChordIndex = 0;
    this.energyFactor = 1;
    this.createPads();
    this.createMelody();
  }

  playChordProgression() {
    const now = this.audioContext.currentTime;
    const chordRoot = this.baseNote + this.chordProgression[this.currentChordIndex];
    
    this.pads.forEach((pad, i) => {
      const noteInChord = chordRoot + this.scale[i * 2 % this.scale.length];
      const freq = this.midiToFreq(noteInChord);
      pad.osc.frequency.setTargetAtTime(freq, now, 5); // Slow transition over 5 seconds
    });

    this.currentChordIndex = (this.currentChordIndex + 1) % this.chordProgression.length;
    setTimeout(() => this.playChordProgression(), 30000); // Change chord every 30 seconds
  }

  playMelody() {
    const now = this.audioContext.currentTime;
    const noteIndex = Math.floor(Math.random() * this.scale.length);
    const note = this.baseNote + this.scale[noteIndex] + 12; // One octave higher
    const freq = this.midiToFreq(note);

    this.melody.osc.frequency.setTargetAtTime(freq, now, 2);
    this.melody.gain.gain.setTargetAtTime(this.baseVolume * 0.1, now, 2);
    this.melody.gain.gain.setTargetAtTime(0, now + 5, 3);

    const nextNoteTime = 10 + Math.random() * 10; // Play a note every 10-20 seconds
    setTimeout(() => this.playMelody(), nextNoteTime * 1000);
  }

  setEnergyFactor(factor) {
    this.energyFactor = factor;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.setTargetAtTime(this.baseVolume * factor, now, 5);

    // Adjust LFO depths based on energy
    this.pads.forEach(pad => {
      const newDepth = (0.1 + Math.random() * 0.1) * factor;
      pad.lfoGain.gain.setTargetAtTime(newDepth, now, 5);
    });

    // Adjust melody filter frequency
    const newFilterFreq = 500 * factor;
    this.melody.filter.frequency.setTargetAtTime(newFilterFreq, now, 5);
  }

  newLevel() {
    const now = this.audioContext.currentTime;
    
    // Gentle swell
    this.masterGain.gain.setTargetAtTime(this.baseVolume * 1.5, now, 5);
    
    // Return to normal after swell
    setTimeout(() => {
      this.masterGain.gain.setTargetAtTime(this.baseVolume * this.energyFactor, now + 10, 5);
    }, 15000);

    // Slowly change the base note
    this.baseNote = 48 + Math.floor(Math.random() * 7) * 2; // Random even number between 48 and 60
    this.playChordProgression();
  }

  mute() {
    this.masterGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 2);
  }

  unmute() {
    this.masterGain.gain.setTargetAtTime(this.baseVolume * this.energyFactor, this.audioContext.currentTime, 2);
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}

class Wingman extends Ship {
  static wingmen = [];
  static MAX_WINGMEN = 0;
  static spawnCooldown = 300; // 5 seconds at 60 fps
  static canSpawn = true;

  constructor(pos, vel, size) {
    super(pos, vel, size);
    this.targetPosition = null;
    this.state = 'follow';
    this.attackRange = 300;
    this.defendRange = 200;
    this.shootCooldown = 0;
    this.bombCooldown = 0;
    this.bombCooldownTime = 300;
    this.health = 150;
    this.maxHealth = 150;
    this.isActive = false;
    this.maxSpeed = random(1.8, 2.3);
    this.cautionDistance = 200;
    this.minAltitude = 30;
    this.arrivalThreshold = 5;
    this.maxForce = 0.09;
    this.thrustPower = 0.09;
    this.isThrusting = false;
    this.stuckTimer = 0;
    this.stuckThreshold = 60;
    this.correctionDuration = 30;
    this.isCorrectingStuckState = false;
    
    this.hoverOffset = createVector(0, 0);
    this.hoverAngle = 0;
    this.hoverSpeed = 0.05;
    this.hoverRadius = 30;
    this.wingmanIndex = 0;
    
    this.currentTarget = null;
    this.targetAngle = 0;
    this.bulletSpeed = 10;
    
    this.healthBarWidth = 30;
    this.healthBarHeight = 3;
    this.healthBarOffset = 20; // Distance above the wingman
  }

  static updateWingmen() {
    for (let wingman of Wingman.wingmen) {
      wingman.update();
    }
  }

  static drawWingmen() {
    for (let wingman of Wingman.wingmen) {
      wingman.draw();
    }
  }

handleInput() {}

  update() {
    if (this.isActive) {
      this.updateAI();
      this.applyBehaviors();
      this.checkIfStuck();
      this.ensureAboveSurface();
      super.update();
      
      if (this.shootCooldown > 0) this.shootCooldown--;
      if (this.bombCooldown > 0) this.bombCooldown--;

      this.checkCollisions();
      this.performAction();
    }
  }

  updateAI() {
    let playerPos = this.getPlayerPosition();

    if (ship.isLanded) {
      this.state = 'hover';
      this.targetPosition = this.calculateHoverPosition(playerPos);
    } else {
      const nearestEnemy = this.findNearestEnemy();
      // Use squared distance for comparisons to avoid sqrt
      const dx = this.pos.x - playerPos.x;
      const dy = this.pos.y - playerPos.y;
      const distSqToPlayer = dx * dx + dy * dy;

      if (nearestEnemy) {
        const dxEnemy = this.pos.x - nearestEnemy.pos.x;
        const dyEnemy = this.pos.y - nearestEnemy.pos.y;
        const distSqToEnemy = dxEnemy * dxEnemy + dyEnemy * dyEnemy;
        const attackRangeSq = this.attackRange * this.attackRange;
        
        if (distSqToEnemy < attackRangeSq) {
          this.state = 'attack';
          this.targetPosition = nearestEnemy.pos;
        } else if (distSqToPlayer > this.defendRange * this.defendRange) {
          this.state = 'follow';
          this.targetPosition = playerPos; 
        } else {
          this.state = 'defend';
          this.targetPosition = this.calculateDefendPosition(playerPos); 
        }
      } else if (distSqToPlayer > this.defendRange * this.defendRange) {
        this.state = 'follow';
        this.targetPosition = playerPos; 
      } else {
        this.state = 'defend';
        this.targetPosition = this.calculateDefendPosition(playerPos); 
      }

      const bombTarget = this.findBombTarget();
      if (bombTarget) {
        this.state = 'bomb';
        let targetPos = bombTarget instanceof AlienWorm ? bombTarget.segments[1].pos : bombTarget.pos;
        this.targetPosition = createVector(targetPos.x, targetPos.y - 100);
      }
    }
    
  if (this.currentTarget) {
    let angleToTarget = p5.Vector.sub(this.currentTarget.pos, this.pos).heading();
    let angleDifference = angleToTarget - this.angle;
    angleDifference = (angleDifference + PI) % TWO_PI - PI; // Normalize to -PI to PI
    this.angle += angleDifference * 0.1; // Gradually turn towards target
  }
    
    this.updateTargeting();
  }

  updateTargeting() {
    this.currentTarget = this.findNearestEnemy();
    if (this.currentTarget) {
      let targetDirection = p5.Vector.sub(this.currentTarget.pos, this.pos);
      this.targetAngle = targetDirection.heading();
    } else {
      this.targetAngle = this.state === 'hover' ? this.angle : this.vel.heading();
    }
  }

  getPlayerPosition() {
    return (isWalking && !astronaut.isInShip) ? astronaut.pos : ship.pos;
  }

  calculateHoverPosition(playerPos) {
    const hoverDistance = ship.size * 2;
    const baseAngle = this.wingmanIndex * PI / 2;
    const x = playerPos.x + cos(baseAngle) * hoverDistance;
    const y = playerPos.y + sin(baseAngle) * hoverDistance;
    return createVector(x, y);
  }

applyBehaviors() {
  let desiredVelocity;

  if (this.state === 'hover') {
    desiredVelocity = this.hover(this.targetPosition);
  } else {
    desiredVelocity = this.seek(this.targetPosition);
  }

  desiredVelocity.add(this.separate());
  
  // Apply terrain avoidance with higher priority
  let terrainAvoidance = this.avoidTerrain();
  terrainAvoidance.mult(2); // Increase the weight of terrain avoidance
  desiredVelocity.add(terrainAvoidance);
  
  let steer = p5.Vector.sub(desiredVelocity, this.vel);
  steer.limit(this.maxForce);
  
  this.vel.add(steer);
  
  // Apply minimum altitude constraint
  this.ensureAboveSurface();
    
    if (this.state !== 'hover') {
      if (this.vel.mag() < this.maxSpeed * 0.8) {
        this.applyThrust();
      } else {
        this.isThrusting = false;
      }
    }
    
    this.vel.limit(this.state === 'hover' ? this.maxSpeed * 0.5 : this.maxSpeed);

    let angleDiff = this.targetAngle - this.angle;
    angleDiff = (angleDiff + PI) % TWO_PI - PI;
    this.angle += angleDiff * 0.1;
  }

  hover(target) {
    let desired = p5.Vector.sub(target, this.pos);
    let d = desired.mag();
    
    if (d < this.arrivalThreshold) {
      this.hoverAngle += this.hoverSpeed;
      this.hoverOffset.x = cos(this.hoverAngle) * this.hoverRadius;
      this.hoverOffset.y = sin(this.hoverAngle) * this.hoverRadius;
      desired.add(this.hoverOffset);
    }
    
    desired.setMag(this.maxSpeed * 0.5);
    return desired;
  }

  seek(target) {
    let desired = p5.Vector.sub(target, this.pos);
    let d = desired.mag();
    
    if (d < this.arrivalThreshold) {
      return createVector(0, 0);
    } else if (d < this.cautionDistance) {
      let m = map(d, 0, this.cautionDistance, 0, this.maxSpeed);
      desired.setMag(m);
    } else {
      desired.setMag(this.maxSpeed);
    }
    
    return desired;
  }

  separate() {
    let desiredSeparation = this.size * 2;
    let sum = createVector();
    let count = 0;
    
    // Pre-calculate squared separation distance to avoid sqrt in distance checks
    let separationSq = desiredSeparation * desiredSeparation;
    
    for (let other of [...Alien.aliens, ...Hunter.hunters, ...Zapper.zappers, ...Destroyer.destroyers]) {
      // Use squared distance for performance (avoids expensive sqrt)
      let dx = this.pos.x - other.pos.x;
      let dy = this.pos.y - other.pos.y;
      let distSq = dx * dx + dy * dy;
      
      if (distSq > 0 && distSq < separationSq) {
        let d = Math.sqrt(distSq); // Only calculate sqrt when needed
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize();
        diff.div(d);
        sum.add(diff);
        count++;
      }
    }
    
    if (count > 0) {
      sum.div(count);
      sum.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(sum, this.vel);
      steer.limit(0.3);
      return steer;
    }
    return createVector();
  }

avoidTerrain() {
  const lookAhead = this.vel.copy().setMag(100); // Increased look-ahead distance
  const futurePos = p5.Vector.add(this.pos, lookAhead);
  const surfaceY = getCachedSurfaceYAtX(futurePos.x);
  
  if (futurePos.y > surfaceY - this.minAltitude * 2) { // Increased safety margin
    let avoidForce = createVector(0, -1).setMag(this.maxSpeed);
    return avoidForce;
  }

  return createVector(0, 0); // No force if not near terrain
}



  performAction() {
    if (this.currentTarget && this.canShootTarget()) {
      this.attackBehavior();
    }

    if (this.state === 'bomb') {
      this.bombBehavior();
    }
  }

canShootTarget() {
  if (!this.currentTarget) {
    return false;
  }
 
  // Use squared distance to avoid sqrt
  const dx = this.currentTarget.pos.x - this.pos.x;
  const dy = this.currentTarget.pos.y - this.pos.y;
  const distanceToTargetSq = dx * dx + dy * dy;
  const attackRangeSq = this.attackRange * this.attackRange;
  
  let angleToTarget = p5.Vector.sub(this.currentTarget.pos, this.pos).heading();
  let angleDifference = (angleToTarget - this.angle + TWO_PI) % TWO_PI;
  if (angleDifference > PI) angleDifference = TWO_PI - angleDifference;
 
  return distanceToTargetSq <= attackRangeSq && angleDifference < 0.3;
}

  attackBehavior() {
    if (this.shootCooldown <= 0) {
      this.shoot();
      this.shootCooldown = 30;
    }
  }

  shoot() {
    if (this.currentTarget) {
      let bulletSpawnPos = this.calculateBulletSpawnPosition();
      let targetPos = this.currentTarget.pos.copy();
      
      targetPos.x += random(-20, 20);
      targetPos.y += random(-20, 20);

      let bulletVel = p5.Vector.sub(targetPos, bulletSpawnPos).normalize().mult(this.bulletSpeed);
      Bullet.addBullet(bulletSpawnPos, bulletVel, 5, true);
    }
  }

  bombBehavior() {
    if (this.bombCooldown <= 0) {
      let targetBelow = this.findBombTarget();
      if (targetBelow) {
        this.dropBomb(targetBelow);
        this.bombCooldown = this.bombCooldownTime;
      }
    }
  }

  dropBomb(target) {
    let bombPos = this.pos.copy();
    let bombVel = createVector(0, 2);
    bombVel.x = random(-0.5, 0.5);
    bombs.push(new Bomb(bombPos, bombVel, 10));
  }

  checkCollisions() {
    for (let alien of Alien.aliens) {
      // Use squared distance to avoid sqrt
      const dx = this.pos.x - alien.pos.x;
      const dy = this.pos.y - alien.pos.y;
      const minDist = (this.size + alien.size) / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        this.takeDamage(10);
        break;
      }
    }
  
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.crash();
    }
  }

  crash() {
    if (this.isActive) {
      this.isActive = false;
      explosions.push(new Explosion(this.pos, this.size * 2));
      soundManager.play('shipDestruction');
      let index = Wingman.wingmen.indexOf(this);
      if (index > -1) {
        Wingman.wingmen.splice(index, 1);
      }
      announcer.speak(`Wingman down`, 0, 1);
      
      // Start the spawn cooldown when the wingman is destroyed
      Wingman.canSpawn = false;
      setTimeout(() => { Wingman.canSpawn = true; }, Wingman.spawnCooldown * 16.67);
    }
  }

  draw() {
    if (this.isActive) {
      push();
      translate(this.pos.x, this.pos.y);
      rotate(this.angle);
      
      fill(200);
      triangle(-this.size / 2, -this.size / 2, this.size, 0, -this.size / 2, this.size / 2);
      
      if (this.state === 'bomb') {
        fill(0, 0, 255);
        //line(0, 0, this.size, 0);
        ellipse(0, 0, this.size / 4);
      }
             
      
      if (this.currentTarget) {
        fill(255, 0, 0);
        //line(0, 0, this.size, 0);
        ellipse(0, 0, this.size / 4);
      }
      pop();
      
      this.drawHealthBar();
 
    }
  }


  drawHealthBar() {
    
    
    push();
    translate(this.pos.x, this.pos.y - this.size -this.healthBarOffset);


    // Draw background of health bar
    fill(255,0,0);
    rect(0, 0, this.healthBarWidth, this.healthBarHeight);
    // Draw health
    fill(200); 
    let healthWidth = map(this.health, 0, this.maxHealth, 0, this.healthBarWidth);
    rect(0, 0, healthWidth, this.healthBarHeight);

    pop();
  }



  checkIfStuck() {
  const nearSurface = this.pos.y + this.size / 2 > getCachedSurfaceYAtX(this.pos.x) - 10;
    const movingSlowly = this.vel.mag() < 0.2;
    const velocityStagnant = this.vel.mag() < 0.2 && this.stuckTimer > 20;

    if ((nearSurface && movingSlowly) || velocityStagnant) {
      this.stuckTimer++;
      if (this.stuckTimer >= this.stuckThreshold) {
        this.initiateStuckCorrection();
      }
    } else {
      this.stuckTimer = 0;
    }
  }

  initiateStuckCorrection() {
    this.isCorrectingStuckState = true;
    this.correctionDuration = 30;
  }

  correctStuckState() {
    if (this.correctionDuration > 0) {
      this.vel.y = -this.maxSpeed;
      this.vel.x = 0;
      this.correctionDuration--;
    } else {
      this.isCorrectingStuckState = false;
      this.stuckTimer = 0;
    }
  }

  findNearestEnemy() {
    let nearest = null;
    let minDistSq = Infinity;
    const attackRangeSq = this.attackRange * this.attackRange;
    const enemies = [...Alien.aliens, ...Hunter.hunters, ...Zapper.zappers, ...Destroyer.destroyers, ...AlienFortress.fortresses];
    
    for (let enemy of enemies) {
      // Use squared distance to avoid sqrt
      const dx = this.pos.x - enemy.pos.x;
      const dy = this.pos.y - enemy.pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq && distSq < attackRangeSq) {
        minDistSq = distSq;
        nearest = enemy;
      }
    }
    
    return nearest;
  }

  findBombTarget() {
    let targets = [...Nest.nests, ...AlienFortress.fortresses, ...AlienWorm.worms];
    let nearestTarget = null;
    let minDistSq = Infinity;
    const attackRangeSq = this.attackRange * this.attackRange;

    for (let target of targets) {
      let targetPos = target instanceof AlienWorm ? target.segments[1].pos : target.pos;
      // Use squared distance to avoid sqrt
      const dx = this.pos.x - targetPos.x;
      const dy = this.pos.y - targetPos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq && distSq < attackRangeSq) {
        minDistSq = distSq;
        nearestTarget = target;
      }
    }

    return nearestTarget;
  }

  calculateDefendPosition(playerPos) {
    const angle = random(TWO_PI);
    const x = playerPos.x + cos(angle) * this.defendRange;
    const y = playerPos.y + sin(angle) * this.defendRange;
    return createVector(x, y);
  }

  calculateBulletSpawnPosition() {
    let spawnPos = this.pos.copy();
    spawnPos.add(p5.Vector.fromAngle(this.angle, this.size));
    return spawnPos;
  }

applyThrust() {
    if (!this.isZapped) {
      const thrust = p5.Vector.fromAngle(this.angle, this.thrustPower);
      this.vel.add(thrust);
      
      if (this.isLanded) {
        this.takeOff();
      }
      
      this.isThrusting = true;
    } else {
      this.isThrusting = false;
    }
  }

  takeOff() {
    this.isLanded = false;
    this.vel.set(0, -1); // Initial upward velocity
    this.pos.y -= 1; // Slight boost to ensure takeoff
  }

  land(surfaceY) {
    this.pos.y = surfaceY - this.size / 2;
    this.vel.set(0, 0);
    this.isLanded = true;
  }

  getSurfaceY() {
  return getCachedSurfaceYAtX(this.pos.x);
  }

  aCrashOrAlanding() {
    return this.vel.mag() < 1; // Consider it a landing if velocity is low
  }

  checkImpact() {
    const surfaceY = this.getSurfaceY();
    if (this.pos.y + this.size / 2 > surfaceY) {
      if (this.aCrashOrAlanding()) {
        this.land(surfaceY);
        return true;
      } else {
        this.crash();
        return false;
      }
    }
    return false;
  }

ensureAboveSurface() {
  const surfaceY = getCachedSurfaceYAtX(this.pos.x);
  const minHeight = surfaceY - this.minAltitude;
  
  if (this.pos.y > minHeight) {
    this.pos.y = minHeight;
    if (this.vel.y > 0) {
      this.vel.y = -this.vel.y; // Bounce off the surface
    }
  }
}

  handlePodInteraction() {
    // Wingmen don't interact with pods
  }
  
  shootBomb() {
    // Wingmen don't shoot bombs directly
  }

static spawnWingman() {
  if (Wingman.canSpawn && Wingman.wingmen.length < Wingman.MAX_WINGMEN) {
    energy -= 200;
    let spawnPos;
    
    if (isWalking && !astronaut.isInShip) {
      // Spawn near astronaut
      spawnPos = createVector(
        astronaut.pos.x + random(-50, 50),
        astronaut.pos.y - 50 // Spawn slightly above the astronaut
      );
    } else {
      // Spawn near ship
      spawnPos = createVector(ship.pos.x, ship.pos.y);
    }
    
    let newWingman = new Wingman(spawnPos, createVector(0, 0), 14);
    newWingman.health = newWingman.maxHealth;
    newWingman.isActive = true;
    newWingman.wingmanIndex = Wingman.wingmen.length;
    Wingman.wingmen.push(newWingman);
    
    announcer.speak(`Wingman deployed`, 0, 1);
  }
}

  static missionSpawn() {
    for (let i = 0; i < 10; i++) {
      let spawnPos = createVector(ship.pos.x, ship.pos.y);
      let newWingman = new Wingman(spawnPos, createVector(0, 0), 14);
      newWingman.health = newWingman.maxHealth;
      newWingman.isActive = true;
      newWingman.wingmanIndex = i;
      Wingman.wingmen.push(newWingman);
    }
  }

  static resetSpawnCooldown() {
    Wingman.canSpawn = true;
  }

  static resetWingmen() {
    Wingman.wingmen = [];
    Wingman.canSpawn = true;
  }
}

class DrillRig extends Entity {
  static rigs = [];
  static MAX_RIGS = Object.freeze(4);
  static ENERGY_GENERATION_RATE = 0.1; // Energy units per frame

  constructor(pos) {
    super(pos, createVector(0, 0), 30);
    this.health = 100;
    this.isInCluster = false;
    this.energyGenerated = 0;
    this.placementTime = millis(); // Record the time when the rig was placed
  }

  update() {
    if (this.health > 0) {
      if (this.isInCluster) {
        this.generateEnergy();
      }
      this.checkCollisions();
    }
  }

draw() {
  push();
  translate(this.pos.x, this.pos.y);
  
  // Base - rectangular shape
  fill(200, 200, 255);
  rect(-15, 0, 30, 15)
  let energyFillHeight = map(this.energyGenerated, 0, 100, 0, 15); // Base filling as energy is extracted  
  fill(255,0,0);
  rect(-15, 15 - energyFillHeight, 30, energyFillHeight); // Energy indicator in the base

  // Trapezoid on top
  fill(200, 200, 255);
  let topOffset = this.isInCluster ? sin(millis() / 200) * 5 : 0; // Animate top points if extracting energy
  beginShape();
  vertex(-10, 1); // Bottom-left of trapezoid
  vertex(10, 1);  // Bottom-right of trapezoid
  vertex(6, -20+ topOffset); // Top-right, animated
  vertex(-6, -20+ topOffset); // Top-left, animated
  endShape(CLOSE);
  
  pop();
  
  //this.drawHealthBar();
}


  drawHealthBar() {
    push();
    translate(this.pos.x, this.pos.y - 45);
    fill(255, 0, 0);
    rect(-15, 0, 30, 5);
    fill(0, 255, 0);
    rect(-15, 0, map(this.health, 0, 100, 0, 30), 5);
    pop();
  }

  generateEnergy() {
    this.energyGenerated += DrillRig.ENERGY_GENERATION_RATE;
    if (this.energyGenerated >= 100) {
      energy = Math.min(energy + 100, maxEnergy);
      this.energyGenerated = 0;
    }
  }

  checkCollisions() {
    // Check collisions with AlienWorms
    for (let worm of AlienWorm.worms) {
      for (let segment of worm.segments) {
        // Use squared distance to avoid sqrt
        const dx = this.pos.x - segment.pos.x;
        const dy = this.pos.y - segment.pos.y;
        const minDist = (this.size + segment.size) / 2;
        if (dx * dx + dy * dy < minDist * minDist) {
          this.takeDamage(1);
          break;
        }
      }
    }

    // Check collisions with alien bullets
    for (let bullet of Bullet.activeObjects) {
      if (!bullet.isPlayerBullet) {
        // Use squared distance to avoid sqrt
        const dx = this.pos.x - bullet.pos.x;
        const dy = this.pos.y - bullet.pos.y;
        const minDist = (this.size + bullet.size) / 2;
        if (dx * dx + dy * dy < minDist * minDist) {
          this.takeDamage(10);
          Bullet.recycle(bullet);
        }
      }
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.destroy();
    }
  }

  destroy() {
    let index = DrillRig.rigs.indexOf(this);
    if (index !== -1) {
      DrillRig.rigs.splice(index, 1);
      explosions.push(new Explosion(this.pos, this.size, color(100, 100, 100), color(50, 50, 50)));
    }
  }

  static placeRig(pos) {
    if (DrillRig.rigs.length >= DrillRig.MAX_RIGS) {
      // Remove the oldest rig
      DrillRig.rigs.sort((a, b) => a.placementTime - b.placementTime);
      const oldestRig = DrillRig.rigs.shift();
      // Create explosion directly without calling destroy() since we already removed it
      explosions.push(new Explosion(oldestRig.pos, oldestRig.size, color(100, 100, 100), color(50, 50, 50)));
    }

    let rig = new DrillRig(pos);
    DrillRig.rigs.push(rig);
    rig.isInCluster = AlienPlant.isInCluster(pos);
    return true;
  }

  static updateRigs() {
    for (let rig of DrillRig.rigs) {
      rig.update();
    }
  }

  static drawRigs() {
    for (let rig of DrillRig.rigs) {
      if (isInView(rig.pos, rig.size)) {
        rig.draw();
      }
    }
  }
}

class WalkerRobot extends Entity {
  static walkerCounter = 0;
  static walkers = [];
  static MAX_WALKERS = 0;
  static spawnCooldown = 0;
  static SPAWN_COOLDOWN_TIME = 600; // 10 seconds at 60 fps
  static SHOOT_SPEED = 40;

  constructor(pos) {
    super(pos, createVector(0, 0), 60);
    this.uniqueId = `walker-${++WalkerRobot.walkerCounter}`;
    this.health = 300;
    this.maxHealth = 300;
    this.speed = 0.5;
    this.direction = random() < 0.5 ? -1 : 1; // -1 for left, 1 for right
    this.legAngle = 0;
    this.legSpeed = 0.03;
    this.shootCooldown = 0;
    this.shootRange = 250;
    this.bodyHeight = 20;
    this.legLength = 20;
    this.footLength = 10;
    this.stepHeight = 5;
    this.legPhase = 0;
    this.rotationAngle = 0;
    this.targetRotationAngle = 0;
    this.rotationDamping = 0.1; // Adjust this value to change dampening strength
    this.maxRotationAngle = PI / 6; // Maximum rotation angle (30 degrees)
    this.rider = null;
    this.surfacePoints = []; // Store surface points for smooth movement

      // Freeze Burst properties
  this.burstDefenseRadius = 200; // Range of the freeze burst
  this.burstDefenseCooldown = 0; // Current cooldown timer
  this.burstDefenseMaxCooldown = 300; // Cooldown time (5 seconds at 60 fps)
  this.freezeDuration = 180; // Duration of the freeze effect (3 seconds at 60 fps)
  this.burstDefenseAnimationFrames = 30; // Number of frames for the animation
  this.currentBurstFrame = 0; // Current frame of the animation
  }

  update() {
    this.move();
    this.shoot();
    this.checkBulletCollision();
    this.updateLegPhase();

  if (this.burstDefenseCooldown > 0) {
    this.burstDefenseCooldown--;
  }
  if (this.currentBurstFrame > 0) {
    this.currentBurstFrame--;
  }
    
    if (this.rider) {
      this.updateRiderPosition();
    }  
  }

move() {
    if (this.rider) {
        // If there's a rider and the camera is NOT following a missile or drone, allow control
        if (!(cameraFollowsMissile || cameraFollowsDrone)) {
            if (keyIsDown(LEFT_ARROW)) {
                this.direction = -1;
            } else if (keyIsDown(RIGHT_ARROW)) {
                this.direction = 1;
            }
        }
    }

    // Calculate new position
    let moveAmount = this.speed * this.direction;
    let newX = this.pos.x + moveAmount;

    // Handle world wrapping
    if (newX < 0) {
        newX = worldWidth;
    } else if (newX > worldWidth) {
        newX = 0;
    }

    // Get surface points for new position
    this.updateSurfacePoints(newX);

    // Calculate new Y position based on surface points
    let newY = this.calculateNewYPosition(newX);

    // Check if the new position is valid (not too steep)
    let currentY = this.calculateNewYPosition(this.pos.x);
    let slope = Math.abs(newY - currentY) / Math.abs(newX - this.pos.x);

    if (slope > 12) { // If slope is too steep
        this.direction *= -1;
        newX = this.pos.x + (this.speed * this.direction);
        if (newX < 0) newX = worldWidth;
        if (newX > worldWidth) newX = 0;
        this.updateSurfacePoints(newX);
        newY = this.calculateNewYPosition(newX);
    }

    // Update position
  this.pos.x = newX;
  // Smooth vertical motion to avoid small bucket-induced steps
  this.pos.y = lerp(this.pos.y, newY, 0.5);

    // Update rotation angle
    this.updateRotationAngle();
}

  calculateSurfaceDistance(x1, y1, x2, y2) {
    // Calculate the straight-line distance
    let dx = x2 - x1;
    let dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  updateSurfacePoints(centerX) {
    this.surfacePoints = [];
    for (let i = -30; i <= 30; i += 10) {
      let x = (centerX + i + worldWidth) % worldWidth;
  this.surfacePoints.push({x: x, y: getCachedSurfaceYAtX(x)});
    }
  }

  calculateNewYPosition(newX) {
    // Find the two closest points
    let leftPoint = this.surfacePoints[2]; // Center point
    let rightPoint = this.surfacePoints[3];
    
    // Interpolate Y position
    let xDiff = rightPoint.x - leftPoint.x;
    if (xDiff === 0) {
      // If points are at same x position, just use leftPoint y
      return leftPoint.y - this.size / 2;
    }
    let t = (newX - leftPoint.x) / xDiff;
    return lerp(leftPoint.y, rightPoint.y, t) - this.size / 2;
  }

  updateRotationAngle() {
    let leftPoint = this.surfacePoints[2];
    let rightPoint = this.surfacePoints[3];
    let angle = atan2(rightPoint.y - leftPoint.y, rightPoint.x - leftPoint.x);
    
    // Clamp the target rotation angle
    this.targetRotationAngle = constrain(angle, -this.maxRotationAngle, this.maxRotationAngle);
    
    // Smoothly interpolate between current rotation and target rotation
    let rotationDifference = this.targetRotationAngle - this.rotationAngle;
    this.rotationAngle += rotationDifference * this.rotationDamping;
  }

  updateLegPhase() {
    this.legPhase = (this.legPhase + this.legSpeed * this.direction) % (2 * Math.PI);
  }

  updateRiderPosition() {
    let riderOffsetY = -this.bodyHeight - this.rider.size / 2;
    
    // Apply rotation to the offset
    let rotatedOffsetX = cos(this.rotationAngle) - riderOffsetY * sin(this.rotationAngle);
    let rotatedOffsetY = sin(this.rotationAngle) + riderOffsetY * cos(this.rotationAngle);
    
    this.rider.pos.x = this.pos.x + rotatedOffsetX;
    this.rider.pos.y = this.pos.y + rotatedOffsetY;
  }

  activateBurstDefense() {
  this.burstDefenseCooldown = this.burstDefenseMaxCooldown;
  this.currentBurstFrame = this.burstDefenseAnimationFrames;

  // Create an array of all alien types
  let allAliens = [
    ...Alien.aliens,
    ...Hunter.hunters,
    ...Zapper.zappers,
    ...Destroyer.destroyers,
  ];

  // Apply freeze effect to all aliens within range
  for (let alien of allAliens) {
    let d = dist(this.pos.x, this.pos.y, alien.pos.x, alien.pos.y);
    if (d < this.burstDefenseRadius) {
      alien.freeze(this.freezeDuration);
    }
  }

  
  // Freeze AlienWorms (check head segment)
  for (let worm of AlienWorm.worms) {
    if (worm && worm.segments && worm.segments.length > 0) {
      let head = worm.segments[0]; // Head segment
      let d = dist(this.pos.x, this.pos.y, head.pos.x, head.pos.y);
      if (d < this.burstDefenseRadius) {
        worm.freeze(this.freezeDuration);
      }
    }
  }

  soundManager.play('turretFreezeBurst'); // Play the freeze burst sound
}

  shoot() {
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
      return;
    }

    let target = this.findTarget();
    if (target && target.pos && ((target.pos.x - this.pos.x) * this.direction > 0)) {
      let bulletVel = p5.Vector.sub(target.pos, this.pos).normalize().mult(8);
      Bullet.addBullet(this.pos.copy(), bulletVel, 5, true);
      this.shootCooldown = WalkerRobot.SHOOT_SPEED;
      soundManager.play('walkerShoot');

        // Activate freeze burst if cooldown is ready
  if (this.burstDefenseCooldown <= 0) {
    this.activateBurstDefense();
  }
    }
  }

  findTarget() {
    let targets = [
      ...(Alien.aliens || []),
      ...(Nest.nests || []),
      ...(AlienFortress.fortresses || [])
    ];
    
    // Include worm segments as individual targets
    for (let worm of AlienWorm.worms) {
      targets.push(...worm.segments);
    }

    let closestTarget = null;
    let closestDistanceSq = this.shootRange * this.shootRange;

    for (let target of targets) {
      if (target && target.pos) {
        // Use squared distance to avoid sqrt
        const dx = this.pos.x - target.pos.x;
        const dy = this.pos.y - target.pos.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < closestDistanceSq) {
          closestTarget = target;
          closestDistanceSq = distanceSq;
        }
      }
    }

    return closestTarget;
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotationAngle);
    scale(this.direction, 1);

    // Draw legs
    this.drawLegs();

    // Draw main body (cockpit)
    fill(200);
    beginShape();
    vertex(-15, -this.bodyHeight);
    vertex(15, -this.bodyHeight);
    vertex(18, -this.bodyHeight/2);
    vertex(12, -5);
    vertex(-12, -5);
    vertex(-18, -this.bodyHeight/2);
    endShape(CLOSE);

    // Draw chin
    fill(180);
    beginShape();
    vertex(-12, -5);
    vertex(12, -5);
    vertex(10, 0);
    vertex(-10, 0);
    endShape(CLOSE);

    // Draw front viewport (circular)
    fill(100);
    ellipse(0, -this.bodyHeight * 0.6, 15, 15);

    // Draw top hatch
    fill(170);
    rect(-10, -this.bodyHeight - 5, 20, 5);

    pop();
    
    this.drawHealthBar();


  // Draw freeze burst animation
  if (this.currentBurstFrame > 0) {
    let progress = this.currentBurstFrame / this.burstDefenseAnimationFrames;
    let radius = this.burstDefenseRadius * (1 - progress);
    noFill();
    stroke(100, 100, 255, 255 * progress); // Blue freeze burst effect
    strokeWeight(3 * progress);
    ellipse(this.pos.x, this.pos.y, radius * 2);
    noStroke();
  }
  }

  drawLegs() {
    this.drawLeg(-10, 0, this.legPhase);
    this.drawLeg(10, 0, this.legPhase - Math.PI);
    this.drawLeg(10, 0, this.legPhase - Math.PI/2);
    this.drawLeg(-10, 0, this.legPhase - Math.PI/2);
  }

  drawLeg(startX, startY, phase) {
    const footForward = 15;
    const footBackward = -15;

    let footX = map(cos(phase), -1, 1, footBackward, footForward);
    let footY = abs(sin(phase)) * this.stepHeight;

    let kneeX = footX / 2;
    let kneeY = this.legLength / 2 - footY / 2;

    stroke(160);
    strokeWeight(4);

    // Draw thigh
    line(startX, startY, startX + kneeX, startY + kneeY);

    // Draw shin
    line(startX + kneeX, startY + kneeY, startX + footX, startY + this.legLength - footY);

    // Draw foot
    let footAngle = atan2(footY, footX) + PI / 2;
    let toeX = startX + footX + cos(footAngle) * this.footLength;
    let toeY = startY + this.legLength - footY + sin(footAngle) * this.footLength;
    line(startX + footX, startY + this.legLength - footY, toeX, toeY);

    // Draw joints
    fill(140);
    noStroke();
    ellipse(startX, startY, 8, 8); // Hip joint
    ellipse(startX + kneeX, startY + kneeY, 6, 6); // Knee joint
  }

  drawHealthBar() {
    push();
    translate(this.pos.x, this.pos.y);
    translate(0, -this.size - 10);
    
    const barWidth = 40;  // Total width of the health bar
    const barHeight = 3;  // Height of the health bar

    fill(255,0,0);
    let fillWidth = map(this.health, 0, this.maxHealth, 0, barWidth);
    rect(-fillWidth/2, 0, barWidth, barHeight);
    fill(200);
    rect(-fillWidth/2, 0, fillWidth, barHeight);
    
    pop();
  }

  mount(astronaut) {
    astronaut.mountWalker(this);
  }

  dismount() {
    if (this.rider) {
      this.rider.dismountWalker();
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.destroy();
    }
  }

  checkBulletCollision() {
    for (let bullet of Bullet.activeObjects) {
      if (!bullet.isPlayerBullet) {
        // Use squared distance to avoid sqrt
        const dx = this.pos.x - bullet.pos.x;
        const dy = this.pos.y - bullet.pos.y;
        const minDist = (this.size + bullet.size) / 2;
        if (dx * dx + dy * dy < minDist * minDist) {
          this.takeDamage(10);
          Bullet.recycle(bullet);
          return true;
        }
      }
    }
    return false;
  }

  destroy() {
    let index = WalkerRobot.walkers.indexOf(this);
    if (index !== -1) {
      
      if (astronaut.ridingWalker === this) {
        astronaut.dismountWalker();
      }
      
      WalkerRobot.walkers.splice(index, 1);
      explosions.push(new Explosion(this.pos, this.size, color(150, 150, 150), color(100, 100, 100)));
      soundManager.play('walker');
    }
  }


  static spawnWalker(spawnPos) {
    if (WalkerRobot.walkers.length < WalkerRobot.MAX_WALKERS && WalkerRobot.spawnCooldown <= 0) {
      let newWalker = new WalkerRobot(spawnPos);
      WalkerRobot.walkers.push(newWalker);
      newWalker.direction = astronaut.facing;
      soundManager.play('walker');
      WalkerRobot.spawnCooldown = WalkerRobot.SPAWN_COOLDOWN_TIME;
      return newWalker;
    }
    return null;
  }

  static updateWalkers() {
    if (WalkerRobot.spawnCooldown > 0) {
      WalkerRobot.spawnCooldown--;
    }
    for (let i = WalkerRobot.walkers.length - 1; i >= 0; i--) {
      WalkerRobot.walkers[i].update();
    }
  }

  static drawWalkers() {
    for (let walker of WalkerRobot.walkers) {
      if (isInView(walker.pos, walker.size)) {
        walker.draw();
      }
    }
  }

  static resetWalkers() {
    WalkerRobot.walkers = [];
    WalkerRobot.spawnCooldown = 0;
    WalkerRobot.walkerCounter = 0;
  }
}
