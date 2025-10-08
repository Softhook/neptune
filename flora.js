// flora.js - isolated flora entities (WindReed prototype)
// Loaded after classes.js to ensure Entity and globals exist.

class WindReed extends Entity {
  static reeds = [];
  static MAX_REEDS = 110;                 // Slightly higher for clusters
  static BASE_SPACING = 140;
  static SEGMENT_MIN = 5;
  static SEGMENT_MAX = 9;
  static SEG_LEN_MIN = 16;
  static SEG_LEN_MAX = 30;                // Allow a little taller
  static GROW_CHANCE = 0.00025;
  static CLUSTER_GROW_MULT = 4;           // Growth acceleration near plant cluster
  static CLUSTER_RADIUS = 100;            // Influence radius around AlienPlant clusters
  static GROUP_SPAWN_CHANCE = 0.25;       // Chance to spawn a small local group
  static GROUP_SIZE_RANGE = [2,4];        // Members per cluster spawn
  static WIND_SCALE = 0.55;               // Wind influence
  static NOISE_SCALE = 0.0035;
  static NOISE_TIME_SCALE = 0.0018;
  static TAPER_FACTOR = 0.55;             // How thin tip becomes (0-1)

  constructor(pos, subterranean=false, variant=1, clusterColor=null) {
    super(pos.copy(), createVector(0,0), 4);
    this.surfaceAttached = !subterranean;
    // Variant influences height & thickness (1 = normal, >1 = tall / thicker)
    this.variant = variant;
    const segMin = WindReed.SEGMENT_MIN + (variant > 1 ? 1 : 0);
    const segMax = WindReed.SEGMENT_MAX + (variant > 1 ? 2 : 0);
    this.segments = floor(random(segMin, segMax));
    this.maxSegments = this.segments + floor(random(0, 3 + (variant>1?1:0)));
    const lenScale = variant > 1 ? random(1.05, 1.25) : 1;
    this.segmentLength = random(WindReed.SEG_LEN_MIN, WindReed.SEG_LEN_MAX) * lenScale;
    this.baseThickness = random(2.2, 3.8) * (variant > 1 ? 1.25 : 1);
    this.phase = random(1000);
    // Color: derive from cluster color if provided, else fallback neutral
    if (clusterColor) {
      const baseR = red(clusterColor);
      const baseG = green(clusterColor);
      const baseB = blue(clusterColor);
      // Subtle variation (avoid drifting far from cluster tone)
      const vr = constrain(baseR + random(-15, 15), 0, 255);
      const vg = constrain(baseG + random(-25, 25), 0, 255);
      const vb = constrain(baseB + random(-15, 15), 0, 255);
      this.color = color(vr, vg, vb);
    } else {
      // Fallback (should rarely happen now)
      const gBase = 140 + random(40);
      const hueShift = random(-25, 25);
      this.color = color(90 + hueShift, gBase, 80 + random(35));
    }
    this.tipGlow = random(15, 70);
    this.cached = [];
    this._clusterBoost = 1; // updated each update
  }

  static spawnInitial() {
    // Only spawn if clusters exist
    if (!AlienPlant || !AlienPlant.clusterCenters || !AlienPlant.clusterCenters.length) return;
    if (WindReed.reeds.length) return;
    let x = 0;
    while (x < worldWidth && WindReed.reeds.length < WindReed.MAX_REEDS) {
      if (random() < 0.7) WindReed.spawnOneDistributed(x + random(-30, 30));
      x += random(WindReed.BASE_SPACING * 0.6, WindReed.BASE_SPACING * 1.4);
    }
  }

  static spawnOneDistributed(rawX) {
    const baseX = ((rawX % worldWidth) + worldWidth) % worldWidth;
    let baseY = getCachedSurfaceYAtX(baseX);
    const subterranean = random() < 0.18;
    if (subterranean) baseY += random(6,14);
    // Determine proximity to nearest plant cluster
    const nearCluster = WindReed.isNearPlantCluster(baseX, baseY);
    if (!nearCluster) return; // Abort spawn entirely if not within cluster influence
    const nearestCluster = WindReed.getNearestCluster(baseX, baseY);
    const variant = nearCluster && random() < 0.4 ? 2 : 1; // tall variant near clusters sometimes
    const w = new WindReed(createVector(baseX, baseY), subterranean, variant, nearestCluster ? nearestCluster.color : null);
    WindReed.reeds.push(w);
    // Possibly spawn a small local group (natural clustering) near clusters
    if (nearCluster && random() < WindReed.GROUP_SPAWN_CHANCE) {
      const groupSize = floor(random(WindReed.GROUP_SIZE_RANGE[0], WindReed.GROUP_SIZE_RANGE[1]+1));
      for (let i=0;i<groupSize && WindReed.reeds.length < WindReed.MAX_REEDS;i++) {
        const offsetX = random(-25,25);
        const gx = (baseX + offsetX + worldWidth) % worldWidth;
        let gy = getCachedSurfaceYAtX(gx);
        if (random()<0.15) gy += random(6,14); // subterranean occasional
        const v2 = random()<0.3?2:1;
        const r2 = new WindReed(createVector(gx,gy), false, v2, nearestCluster ? nearestCluster.color : null);
        WindReed.reeds.push(r2);
      }
    }
  }

  static getNearestCluster(x,y) {
    if (!AlienPlant || !AlienPlant.clusterCenters || !AlienPlant.clusterCenters.length) return null;
    let nearest = null;
    let bestDistSq = Infinity;
    for (let i=0;i<AlienPlant.clusterCenters.length;i++) {
      const c = AlienPlant.clusterCenters[i];
      const dx = c.x - x;
      const dy = c.y - y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestDistSq) { bestDistSq = d2; nearest = c; }
    }
    return nearest;
  }

  static isNearPlantCluster(x,y) {
    if (!AlienPlant || !AlienPlant.clusterCenters || !AlienPlant.clusterCenters.length) return false;
    for (let i=0;i<AlienPlant.clusterCenters.length;i++) {
      const c = AlienPlant.clusterCenters[i];
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx*dx + dy*dy < WindReed.CLUSTER_RADIUS * WindReed.CLUSTER_RADIUS) return true;
    }
    return false;
  }

  static updateReeds() {
    const hasClusters = (AlienPlant && AlienPlant.clusterCenters && AlienPlant.clusterCenters.length);
    if (!hasClusters) {
      // Purge all reeds if clusters vanished
      if (WindReed.reeds.length) WindReed.reeds.length = 0;
      return;
    }
    if (WindReed.reeds.length < WindReed.MAX_REEDS && random() < 0.0009) {
      const cc = random(AlienPlant.clusterCenters);
      const spread = 180;
      const dirX = (cc.x + random(-spread, spread) + worldWidth) % worldWidth;
      WindReed.spawnOneDistributed(dirX);
    }
    for (let i = 0; i < WindReed.reeds.length; i++) WindReed.reeds[i].update();
  }

  static tooClose(pos) {
    for (let i = 0; i < WindReed.reeds.length; i += 5) {
      const r = WindReed.reeds[i];
      if (abs(r.pos.x - pos.x) < 35) return true;
    }
    return false;
  }

  update() {
    if (this.surfaceAttached) {
      const targetY = getCachedSurfaceYAtX(this.pos.x);
      this.pos.y = lerp(this.pos.y, targetY, 0.12);
    }
    // Cluster proximity growth boost
    const nearCluster = WindReed.isNearPlantCluster(this.pos.x, this.pos.y);
    this._clusterBoost = nearCluster ? WindReed.CLUSTER_GROW_MULT : 1;
    if (!nearCluster) return; // No growth at all outside cluster range
    const growChance = WindReed.GROW_CHANCE * this._clusterBoost;
    if (this.segments < this.maxSegments && random() < growChance) this.segments++;
  }

  buildGeometry() {
    this.cached.length = 0;
    const base = this.pos.copy();
    this.cached.push(base);
    const windMag = (typeof windForce !== 'undefined' && maxWindForce) ? windForce / maxWindForce : 0;
    const t = frameCount * WindReed.NOISE_TIME_SCALE;
    let prev = base;
    let baseAngle = -PI/2; // straight up
    for (let i = 1; i <= this.segments; i++) {
      const n = noise(this.pos.x * WindReed.NOISE_SCALE, i * 0.25, t + this.phase) - 0.5;
      const sway = n * PI * 0.35; // local wiggle
      const windDir = wind ? atan2(wind.y, wind.x) : 0;
      const windPush = cos(windDir) * windMag * WindReed.WIND_SCALE * (i / this.segments);
      baseAngle += (sway + windPush) * 0.5; // incremental
      const segLen = this.segmentLength * (0.95 + 0.1 * sin(i + this.phase));
      const nx = prev.x + cos(baseAngle) * segLen;
      const ny = prev.y + sin(baseAngle) * segLen;
      const p = createVector(nx, ny);
      this.cached.push(p);
      prev = p;
    }
  }

  draw() {
    this.buildGeometry();
    const tip = this.cached[this.cached.length - 1];
    if (!isInView(this.pos, this.segmentLength * this.segments) && !isInView(tip, 10)) return;
    push();
    noFill();
    // Draw tapered multi-pass stroke for natural look
    const baseW = this.baseThickness;
    for (let i = 0; i < this.cached.length - 1; i++) {
      const p1 = this.cached[i];
      const p2 = this.cached[i+1];
      const t = i / (this.cached.length - 1);
      const w = lerp(baseW, baseW * WindReed.TAPER_FACTOR, t);
      stroke(this.color);
      strokeWeight(w);
      line(p1.x, p1.y, p2.x, p2.y);
    }
    if (windForce > 0) {
      const a = map(windForce, 0, maxWindForce, 0, this.tipGlow);
      noStroke();
      fill(180,255,180,a * (this.variant>1?1:0.8));
      ellipse(tip.x, tip.y, 5 + (this.variant>1?2:0));
    }
    pop();
  }

  static drawReeds() {
    for (let i = 0; i < WindReed.reeds.length; i++) {
      const r = WindReed.reeds[i];
      r.draw();
    }
  }
}
