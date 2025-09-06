class Meteor extends Entity {
  constructor(pos, vel, size) {
    super(pos, vel, size);
    this.explosionRadius = 40;
    this.damage = 100;
  }

  update() {
    super.update();
    this.vel.y += 0.05; // Gravity effect
    this.vel.add(wind.copy().mult(0.5)); // Reduced wind effect
    return this.checkCollision();
  }

  draw() {
    push();
    fill(200, 100, 0);
    noStroke();
    ellipse(this.pos.x, this.pos.y, this.size);
    // Draw a fiery tail
    for (let i = 0; i < 5; i++) {
      let tailPos = p5.Vector.sub(this.pos, p5.Vector.mult(this.vel, i * 2));
      fill(255, 100 + i * 30, 0, 200 - i * 40);
      ellipse(tailPos.x, tailPos.y, this.size - i * 2);
    }
    pop();
  }

  checkCollision() {  // Check collision wile inflight
    
    if (!ship.isLanded && this.pos.dist(ship.pos) < (this.size + ship.size) / 2) {
      energy -= 2000; // High damage to flying ship
      soundManager.play('shipHit');
      return true;
    }

    // Check collision with shields
    for (let shield of Shield.shields) {
      if (this.pos.dist(shield.pos) < shield.radius) {
        shield.takeDamage(this.damage);
        return true; // Meteor disappears without exploding
      }
    }

    // Check collision with aliens
    let alienTypes = [Alien.aliens, Hunter.hunters, Zapper.zappers, Destroyer.destroyers];
    for (let alienGroup of alienTypes) {
      for (let i = alienGroup.length - 1; i >= 0; i--) {
        let alien = alienGroup[i];
        if (this.pos.dist(alien.pos) < (this.size + alien.size) / 2) {
          alien.health -= 30;
          
          // Don't return true here, allow the meteor to continue its flight
        }
      }
    }

    // Check collision with moon surface
    for (let i = 0; i < moonSurface.length - 1; i++) {
      let start = moonSurface[i];
      let end = moonSurface[i + 1];
      if (distToSegment(this.pos, start, end) < this.size / 2) {
        return true;
      }
    }

    return false;
  }

  explode() {
    explosions.push(new Explosion(this.pos, this.explosionRadius * 2, color(255, 100, 0), color(200, 50, 0)));
    soundManager.play('meteorImpact');
    this.reshapeMoonSurface();
    this.damageEntities();
  }

reshapeMoonSurface() {
  let impactPoint = this.pos.x;
  let craterWidth = this.explosionRadius * 2;
  let craterDepth = this.explosionRadius / 2;
  let craterLeft = max(0, impactPoint - craterWidth / 2);
  let craterRight = min(worldWidth, impactPoint + craterWidth / 2);
  const minHeight = height; // Minimum height for the surface

  let startIndex = moonSurface.findIndex(point => point.x >= craterLeft);
  let endIndex = moonSurface.findIndex(point => point.x > craterRight);
  if (endIndex === -1) endIndex = moonSurface.length;

  let newSurfacePoints = [];
  for (let i = startIndex; i < endIndex; i++) {
    let point = moonSurface[i];
    let distanceFromImpact = abs(point.x - impactPoint);
    let depthFactor = 1 - (distanceFromImpact / (craterWidth / 2));
    depthFactor = max(0, depthFactor);
    let craterDepthAtPoint = craterDepth * depthFactor;
    craterDepthAtPoint *= sin((distanceFromImpact / (craterWidth / 2)) * PI);
    
    // Ensure the new point is not below minHeight
    point.y = min(point.y + craterDepthAtPoint, minHeight);
    newSurfacePoints.push(point);
  }

  moonSurface.splice(startIndex, endIndex - startIndex, ...newSurfacePoints);
  this.smoothCraterEdges(startIndex, newSurfacePoints.length);
  // Terrain changed by meteor impact
  if (typeof clearTerrainCache === 'function') clearTerrainCache();
  
  RuinedShip.updatePositions();
}

  smoothCraterEdges(startIndex, newPointsCount) {
    let smoothingRange = 1;
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

damageEntities() { //ground impact
    
    if (ship.isLanded && dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y) < this.explosionRadius) {
      energy -= 1000;
      soundManager.play('shipHit');
    }

    // Damage astronaut
    if (isWalking && dist(this.pos.x, this.pos.y, astronaut.pos.x, astronaut.pos.y) < this.explosionRadius) {
      energy -= 1000;
    }

    // Damage moon bases
    for (let base of MoonBase.moonBases) {
      if (this.pos.x > base.pos.x && this.pos.x < base.pos.x + base.width &&
          Math.abs(this.pos.y - base.pos.y) < this.explosionRadius) {
        base.health -= this.damage;
      }
    }

    // Damage plants
    for (let i = AlienPlant.plants.length - 1; i >= 0; i--) {
      let plant = AlienPlant.plants[i];
      if (dist(this.pos.x, this.pos.y, plant.pos.x, plant.pos.y) < this.explosionRadius) {
        if (plant.takeDamage(this.damage)) {
          AlienPlant.destroyPlant(i);
        }
      }
    }

    // Damage nests
    for (let nest of Nest.nests) {
      if (dist(this.pos.x, this.pos.y, nest.pos.x, nest.pos.y) < this.explosionRadius) {
        nest.health -= this.damage;
      }
    }

    // Damage turrets
    for (let i = turrets.length - 1; i >= 0; i--) {
      let turret = turrets[i];
      if (dist(this.pos.x, this.pos.y, turret.pos.x, turret.pos.y) < this.explosionRadius) {
        turret.health -= this.damage;
        if (turret.health <= 0) {
          explosions.push(new Explosion(turret.pos, 30, color(0, 255, 255), color(0, 100, 100)));
          turrets.splice(i, 1);
        }
      }
    }

    // Damage aliens
    this.damageAlienEntities(Alien.aliens);
    this.damageAlienEntities(Hunter.hunters);
    this.damageAlienEntities(Zapper.zappers);
    this.damageAlienEntities(Destroyer.destroyers);

    // Damage alien worms
    for (let worm of AlienWorm.worms) {
      if (dist(this.pos.x, this.pos.y, worm.segments[0].pos.x, worm.segments[0].pos.y) < this.explosionRadius) {
        worm.takeDamage(this.damage);
      }
    }

    // Adjust positions of game objects
    this.adjustGameObjectPositions();
  }

    damageAlienEntities(entities) {
    for (let i = entities.length - 1; i >= 0; i--) {
      let entity = entities[i];
      if (dist(this.pos.x, this.pos.y, entity.pos.x, entity.pos.y) < this.explosionRadius) {
        entity.health -= this.damage;
        if (entity.health <= 0) {
          explosions.push(new Explosion(entity.pos, entity.size, color(0, 255, 0), color(0, 100, 0)));
          soundManager.play('alienDestruction');
        }
      }
    }
  }
  
  adjustGameObjectPositions() {
    for (let base of MoonBase.moonBases) {
      let newY = min(this.getNewSurfaceY(base.pos.x), height);
      base.pos.y = newY - base.height;
    }
    for (let nest of Nest.nests) {
      let newY = min(this.getNewSurfaceY(nest.pos.x), height);
      nest.pos.y = newY - nest.size / 2;
    }
    for (let turret of turrets) {
      let newY = min(this.getNewSurfaceY(turret.pos.x), height);
      turret.pos.y = newY - turret.size / 2;
    }
    
  for (let plant of AlienPlant.plants) {
    let newY = min(this.getNewSurfaceY(plant.pos.x), height);
    plant.targetPos.y = newY - plant.size / 2;
  }

    if (ship.isLanded) {
      let newY = min(this.getNewSurfaceY(ship.pos.x), height);
      ship.pos.y = newY - ship.size / 2;
    }
  }

  getNewSurfaceY(x) {
    for (let i = 0; i < moonSurface.length - 1; i++) {
      if (x >= moonSurface[i].x && x < moonSurface[i + 1].x) {
        let t = (x - moonSurface[i].x) / (moonSurface[i + 1].x - moonSurface[i].x);
        return lerp(moonSurface[i].y, moonSurface[i + 1].y, t);
      }
    }
    return height;
  }

  static meteors = [];
  static meteorShowerActive = false;
  static meteorShowerDuration = 0;
  static meteorShowerCooldown = 0;
  static meteorShowerWarningTime = 600; // 10 seconds at 60 fps

  static updateMeteors() {
    // Update existing meteors
    for (let i = Meteor.meteors.length - 1; i >= 0; i--) {
      let meteor = Meteor.meteors[i];
      if (meteor.update()) {
        if (meteor.checkCollision()) {
          meteor.explode();
        }
        Meteor.meteors.splice(i, 1);
      } else if (meteor.pos.y > height) {
        Meteor.meteors.splice(i, 1);
      }
    }

    // Handle meteor shower
    if (Meteor.meteorShowerActive) {
      if (frameCount % 8 === 0) { // Spawn a new meteor every 8 frames during shower
        Meteor.spawnMeteor();
      }
      Meteor.meteorShowerDuration--;
      if (Meteor.meteorShowerDuration <= 0) {
        Meteor.meteorShowerActive = false;
        Meteor.meteorShowerCooldown = floor(random(7200, 21600)); // 3-6 minutes at 60 fps
      }
    } else {
      Meteor.meteorShowerCooldown--;
      if (Meteor.meteorShowerCooldown === Meteor.meteorShowerWarningTime) {
        announcer.speak("Commander a Meteor shower is incoming in 10 seconds",0, 2);
      }
      if (Meteor.meteorShowerCooldown <= 0) {
        Meteor.startMeteorShower();
      }
    }
  }

  static drawMeteors() {
    for (let meteor of Meteor.meteors) {
      if (isInView(meteor.pos, meteor.size)) {
        meteor.draw();
      }
    }
  }

  static spawnMeteor() {
    let pos = createVector(random(worldWidth), -50);
    let vel = p5.Vector.random2D().mult(random(2, 5));
    vel.y = abs(vel.y); // Ensure downward motion
    let size = random(10, 30);
    Meteor.meteors.push(new Meteor(pos, vel, size));
  }

  static startMeteorShower() {
    Meteor.meteorShowerActive = true;
    Meteor.meteorShowerDuration = floor(random(600, 1800));
  }
}

class DiamondRain {
  static diamonds = [];
  static isActive = false;
  static duration = 0;
  static cooldown = 0;
  static spawnRate = 5; // Spawn a diamond every 5 frames
  static warningTime = 300; // 5 seconds warning at 60 fps

  constructor(pos, vel, size) {
    this.pos = pos;
    this.vel = vel;
    this.size = size;
    this.color = color(200, 200, 255, 200); // Slightly transparent light blue
    this.buildHeight = random(10, 30); // Increased build height for more dramatic spikes
  }

  update() {
    this.pos.add(this.vel);
    this.vel.add(gravity);
    this.vel.add(wind.copy().mult(0.2)); // Reduced wind effect
    return this.checkCollision();
  }

  draw() {
    push();
    fill(this.color);
    //noStroke();
    beginShape();
    vertex(this.pos.x, this.pos.y - this.size / 2);
    vertex(this.pos.x - this.size / 2, this.pos.y);
    vertex(this.pos.x, this.pos.y + this.size / 2);
    vertex(this.pos.x + this.size / 2, this.pos.y);
    endShape(CLOSE);
    pop();
  }

  checkCollision() {
    for (let i = 0; i < moonSurface.length - 1; i++) {
      let start = moonSurface[i];
      let end = moonSurface[i + 1];
      if (distToSegment(this.pos, start, end) < this.size / 2) {
        soundManager.play('diamondImpact');
        return true;
      }
    }
    return false;
  }

  buildSurface() {
    let impactPoint = this.pos.x;
    let buildWidth = this.size * 2;
    let buildLeft = max(0, impactPoint - buildWidth / 2);
    let buildRight = min(worldWidth, impactPoint + buildWidth / 2);

    let startIndex = moonSurface.findIndex(point => point.x >= buildLeft);
    let endIndex = moonSurface.findIndex(point => point.x > buildRight);
    if (endIndex === -1) endIndex = moonSurface.length;

    // Create a single spike at the impact point
    let spikeIndex = floor((startIndex + endIndex) / 2);
    moonSurface[spikeIndex].y -= this.buildHeight;

    // Create smaller spikes around the main spike
    for (let i = startIndex; i < endIndex; i++) {
      if (i !== spikeIndex) {
        let distanceFromImpact = abs(moonSurface[i].x - impactPoint);
        let spikeFactor = 1 - (distanceFromImpact / (buildWidth / 2));
        spikeFactor = max(0, spikeFactor);
        let spikeHeight = this.buildHeight * spikeFactor * random(0.3, 0.7);
        moonSurface[i].y -= spikeHeight;
      }
    }
    // Surface altered; invalidate cached heights
    if (typeof clearTerrainCache === 'function') clearTerrainCache();
  }

  static updateDiamonds() {
    // Initialize cooldown if it's 0
    if (DiamondRain.cooldown === 0) {
      DiamondRain.cooldown = floor(random(3600, 7200)); // 1-2 minutes at 60 fps
    }

    // Update existing diamonds
    for (let i = DiamondRain.diamonds.length - 1; i >= 0; i--) {
      let diamond = DiamondRain.diamonds[i];
      if (diamond.update()) {
        diamond.buildSurface();
        DiamondRain.diamonds.splice(i, 1);
      } else if (diamond.pos.y > height) {
        DiamondRain.diamonds.splice(i, 1);
      }
    }

    // Handle diamond rain event
    if (DiamondRain.isActive) {
      if (frameCount % DiamondRain.spawnRate === 0) {
        DiamondRain.spawnDiamond();
      }
      DiamondRain.duration--;
      if (DiamondRain.duration <= 0) {
        DiamondRain.isActive = false;
        DiamondRain.cooldown = floor(random(3600, 7200)); // 1-2 minutes at 60 fps
      }
    } else {
      DiamondRain.cooldown--;
      if (DiamondRain.cooldown === DiamondRain.warningTime) {
        announcer.speak("Diamond rain is approaching.",0, 1);
      }
      if (DiamondRain.cooldown <= 0) {
        DiamondRain.startDiamondRain();
      }
    }

    // Adjust game object positions after updating
    DiamondRain.adjustGameObjectPosititions();
  }

  static drawDiamonds() {
    for (let diamond of DiamondRain.diamonds) {
      if (isInView(diamond.pos, diamond.size)) {
        diamond.draw();
      }
    }
  }

  static spawnDiamond() {
    let pos = createVector(random(worldWidth), -50);
    let vel = createVector(random(-1, 1), random(2, 4));
    let size = random(5, 15);
    DiamondRain.diamonds.push(new DiamondRain(pos, vel, size));
  }

  static startDiamondRain() {
    DiamondRain.isActive = true;
    DiamondRain.duration = floor(random(600, 1200)); // 10-20 seconds at 60 fps
  }

  static adjustGameObjectPosititions() {
    for (let base of MoonBase.moonBases) {
      let newY = DiamondRain.getNewSurfaceY(base.pos.x);
      base.pos.y = newY - base.height;
    }
    for (let nest of Nest.nests) {
      let newY = DiamondRain.getNewSurfaceY(nest.pos.x);
      nest.pos.y = newY - nest.size / 2;
    }
    for (let turret of turrets) {
      let newY = DiamondRain.getNewSurfaceY(turret.pos.x);
      turret.pos.y = newY - turret.size / 2;
    }
    
  for (let plant of AlienPlant.plants) {
    let newY = min(DiamondRain.getNewSurfaceY(plant.pos.x), height);
    plant.targetPos.y = newY - plant.size / 2;
  }
    
    if (ship.isLanded) {
      let newY = DiamondRain.getNewSurfaceY(ship.pos.x);
      ship.pos.y = newY - ship.size / 2;
    }
  }

  static getNewSurfaceY(x) {
    for (let i = 0; i < moonSurface.length - 1; i++) {
      if (x >= moonSurface[i].x && x < moonSurface[i + 1].x) {
        let t = (x - moonSurface[i].x) / (moonSurface[i + 1].x - moonSurface[i].x);
        return lerp(moonSurface[i].y, moonSurface[i + 1].y, t);
      }
    }
    return height;
  }
}

class EarthquakeManager {
  constructor() {
    this.cameraShake = createVector(0, 0);
    this.isEarthquake = false;
    this.earthquakeIntensity = 0;
    this.earthquakeWarningTimer = 0;
    this.earthquakeDuration = 0;
    this.maxEarthquakeIntensity = 10;
    this.earthquakeProbability = 0.00005; // Adjust as needed
  }

  update() {
    if (this.earthquakeWarningTimer > 0) {
      this.earthquakeWarningTimer--;
      if (this.earthquakeWarningTimer === 0) {
        this.startEarthquake();
      }
    }

    if (this.isEarthquake) {
      this.earthquakeDuration--;
      if (this.earthquakeDuration <= 0) {
        this.isEarthquake = false;
      }
      this.updateCameraShake();
    } else {
      this.cameraShake.set(0, 0);
    }

    this.checkForRandomEarthquake();
  }

  startEarthquakeWarning() {
    this.earthquakeWarningTimer = 600; // 10 seconds at 60 fps
    announcer.speak("Earthquake imminent!", 0, 2);
  }

  startEarthquake() {
    this.isEarthquake = true;
    this.earthquakeDuration = random(100, 400);
    this.earthquakeIntensity = random(1, this.maxEarthquakeIntensity); // Random intensity
    soundManager.play('earthquake');
    this.damageSurfaceEntities();
  }

  damageSurfaceEntities() {
    let damageFactor = this.earthquakeIntensity / this.maxEarthquakeIntensity;
    for (let i = MoonBase.moonBases.length - 1; i >= 0; i--) {
      let base = MoonBase.moonBases[i];
      base.health -= 50 * damageFactor;
    }
    for (let nest of Nest.nests) {
      nest.health -= 2 * damageFactor;
    }
    for (let rig of DrillRig.rigs) {
      rig.health -= 50 * damageFactor;
    }
    if (RescueMission.strandedAstronaut) {
      RescueMission.strandedAstronaut.takeDamage(50 * damageFactor);
    }
  }

  updateCameraShake() {
    let currentIntensity = this.calculateShakeIntensity();
    this.cameraShake.set(
      random(-currentIntensity, currentIntensity),
      random(-currentIntensity, currentIntensity)
    );
  }

  calculateShakeIntensity() {
    let progress = 1 - (this.earthquakeDuration / 300); // Assuming 300 is the total duration
    if (progress < 0.2) {
      // Ramp up
      return this.earthquakeIntensity * (progress / 0.2);
    } else if (progress > 0.8) {
      // Ramp down
      return this.earthquakeIntensity * (1 - (progress - 0.8) / 0.2);
    } else {
      // Peak intensity
      return this.earthquakeIntensity;
    }
  }

  checkForRandomEarthquake() {
    if (!this.isEarthquake && this.earthquakeWarningTimer === 0 && random() < this.earthquakeProbability) {
      this.startEarthquakeWarning();
    }
  }

  getCameraShake() {
    return this.cameraShake;
  }
}

class MagneticStorm {
  constructor() {
    this.particles = [];
    this.numParticles = 2000;
    this.isActive = false;
    this.duration = 0;
    this.fadeDuration = 180; // 3 seconds for fade in/out
    this.alpha = 0;
    this.magneticStormProbability = 0.00002; // Adjust as needed
    this.initializeParticles();
  }

  initializeParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(new MagneticParticle(random(worldWidth), random(height)));
    }
  }

  activate() {
    this.isActive = true;
    this.duration = 600; // 10 seconds
    this.alpha = 0;
    this.initializeParticles();
    soundManager.play('magneticStorm');
    announcer.speak("Warning: Magnetic Anomaly! Navigation Inverted", 0, 2);
  }

  update() {
    
    if (!magneticStorm.isActive && random() < this.magneticStormProbability) { 
       magneticStorm.activate();
      }
    
    
    if (this.isActive) {
      this.duration--;
      
      // Fade in
      if (this.duration > 600 - this.fadeDuration) {
        this.alpha = map(600 - this.duration, 0, this.fadeDuration, 0, 255);
      }
      // Fade out
      else if (this.duration < this.fadeDuration) {
        this.alpha = map(this.duration, 0, this.fadeDuration, 0, 255);
      }
      // Full opacity
      else {
        this.alpha = 255;
      }

      if (this.duration <= 0) {
        this.deactivate();
      }

      for (let particle of this.particles) {
        particle.update();
      }
    }
  }

  draw() {
    if (this.isActive) {
      push();
      colorMode(HSB, 360, 100, 100, 255);
      strokeWeight(2);
      
      for (let i = 0; i < this.particles.length; i++) {
        let particle = this.particles[i];
        if (isInView(particle.pos, particle.size)) {
          let hue = (noise(particle.pos.x * 0.01, particle.pos.y * 0.01, frameCount * 0.02) * 360 + frameCount * 0.5) % 360;
          stroke(hue, 80, 100, this.alpha);
          line(particle.pos.x, particle.pos.y, particle.prevPos.x, particle.prevPos.y);
        }
      }
      
      pop();
    }
  }

  deactivate() {
    this.isActive = false;
    announcer.speak("Magnetic Anomaly has gone.", 0, 2);
  }

  isStormActive() {
    return this.isActive;
  }
}

class MagneticParticle extends Entity {
  constructor(x, y) {
    super(createVector(x, y), createVector(0, 0), 2);
    this.prevPos = this.pos.copy();
    this.noiseScale = 0.005;
    this.noiseStrength = 5;
    this.maxSpeed = 3;
  }

  update() {
    this.prevPos = this.pos.copy();
    
    let n = noise(this.pos.x * this.noiseScale, this.pos.y * this.noiseScale, frameCount * 0.01);
    let angle = TWO_PI * n;
    let force = p5.Vector.fromAngle(angle).mult(this.noiseStrength);
    
    this.vel.add(force);
    this.vel.limit(this.maxSpeed);
    
    super.update();
    
    this.pos.x = (this.pos.x + worldWidth) % worldWidth;
    this.pos.y = (this.pos.y + height) % height;
  }
}

class MethaneBlizzard {
  constructor() {
    this.isActive = false;
    this.fadeDuration = 180;
    this.totalDuration = 3200;
    this.duration = this.totalDuration; // Initialize duration to totalDuration
    this.alpha = 0;
    this.blizzardProbability = 0.00002;
    this.windStrength = 0;
    this.visibility = 1;
    this.particles = [];
    this.maxParticles = 1000;
    this.slowdownFactor = 0.98;
    this.recoveryFactor = 1 / this.slowdownFactor;

  }
  
  activate() {
    this.isActive = true;
    this.duration = this.totalDuration; // Reset duration when activating
    this.alpha = 0;
    this.windStrength = random(2, 5);
    this.initializeParticles();
    soundManager.play('methane');
    announcer.speak("Planetary Methane Release! Stagnation and Corrosion.", 0, 2);
  }
  
  initializeParticles() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        pos: createVector(random(worldWidth), random(height)),
        vel: createVector(0, -random(1, 3)), // Changed to move upwards
        size: random(1, 3),
        alpha: random(100, 200)
      });
    }
  }
  
  update() {
    if (!this.isActive && random() < this.blizzardProbability) {
      this.activate();
    }
    if (this.isActive) {
      this.duration--;
      this.updateAlpha();
      this.updateParticles();
      this.applyBlizzardEffects();
      if (this.duration <= 0) {
        this.deactivate();
      }
    }
  }
  
  updateAlpha() {
    if (this.duration > 3200 - this.fadeDuration) {
      this.alpha = map(3200 - this.duration, 0, this.fadeDuration, 0, 255);
    } else if (this.duration < this.fadeDuration) {
      this.alpha = map(this.duration, 0, this.fadeDuration, 0, 255);
    } else {
      this.alpha = 255;
    }
    this.visibility = map(this.alpha, 0, 255, 1, 0.3);
  }
  
  updateParticles() {
    for (let particle of this.particles) {
      particle.pos.add(particle.vel);
      this.wrapParticle(particle);
    }
  }
  
  wrapParticle(particle) {
    if (particle.pos.x > worldWidth) particle.pos.x = 0;
    if (particle.pos.x < 0) particle.pos.x = worldWidth;
    if (particle.pos.y > height) particle.pos.y = 0;
    if (particle.pos.y < 0) particle.pos.y = height;
  }
  draw() {
    if (this.isActive) {
      this.drawBackgroundTint();
      this.drawParticles();
    }
  }
  drawBackgroundTint() {
    fill(100, 150, 255, this.alpha * 0.3);
    rect(0, 0, worldWidth, height);
  }
  drawParticles() {
    noStroke();
    for (let particle of this.particles) {
      fill(200, 220, 255, particle.alpha * (this.alpha / 255));
      ellipse(particle.pos.x, particle.pos.y, particle.size);
    }
  }
  
  applyBlizzardEffects() {
  // Slow down ship
  ship.vel.mult(this.slowdownFactor);
  
  // Slow down all types of aliens
  for (let alien of Alien.aliens) {
    alien.vel.mult(this.slowdownFactor);
  }
  for (let hunter of Hunter.hunters) {
    hunter.vel.mult(this.slowdownFactor);
  }
  for (let zapper of Zapper.zappers) {
    zapper.vel.mult(this.slowdownFactor);
  }
  for (let destroyer of Destroyer.destroyers) {
    destroyer.vel.mult(this.slowdownFactor);
  }
    
    // Apply damage every second
    if (frameCount % 60 === 0) {
      
      if (!ship.isLanded) {// Damage ship if not landed
        energy -= 10;
      }
      
      for (let base of MoonBase.moonBases) {
        base.health -= 1;
      }
      
      for (let turret of turrets) {
        turret.health -= 1;
      }
      
      for (let rig of DrillRig.rigs) {
        rig.health -= 1;
      }
      
      for (let walker of WalkerRobot.walkers) {
        walker.health -= 1;
      }
    }
  }
  
  applyRecoveryEffects() {
  // Restore ship speed
  ship.vel.mult(this.recoveryFactor);
  
  // Restore all types of aliens speed
  for (let alien of Alien.aliens) {
    alien.vel.mult(this.recoveryFactor);
  }
  for (let hunter of Hunter.hunters) {
    hunter.vel.mult(this.recoveryFactor);
  }
  for (let zapper of Zapper.zappers) {
    zapper.vel.mult(this.recoveryFactor);
  }
  for (let destroyer of Destroyer.destroyers) {
    destroyer.vel.mult(this.recoveryFactor);
  }
}
  
  deactivate() {
    this.isActive = false;
    this.particles = [];
    this.applyRecoveryEffects();
    announcer.speak("Methane Release stopped.", 0, 2);
    // Reset duration for the next activation
    this.duration = this.totalDuration;
  }
  
  isBlizzardActive() {
    return this.isActive;
  }
}

class HeliumBlizzard {
  constructor() {
    this.isActive = false;
    this.fadeDuration = 180;
    this.totalDuration = 3200;
    this.duration = this.totalDuration;
    this.alpha = 0;
    this.blizzardProbability = 0.00002;
    this.windStrength = 0;
    this.visibility = 1;
    this.particles = [];
    this.maxParticles = 6000;
    this.speedupFactor = 6;
    this.recoveryFactor = 1 / this.speedupFactor;
  }

  activate() {
    gravity.y = -gravity.y;
    this.isActive = true;
    this.duration = this.totalDuration;
    this.alpha = 0;
    this.windStrength = random(2, 5);
    this.initializeParticles();
    soundManager.play('helium');
    announcer.speak("Helium Storm! Acceleration and Euphoria.", 0, 2);   
  }

  initializeParticles() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        pos: createVector(random(worldWidth), random(height)),
        vel: createVector(random(-1, 1), -random(1, 3)), // Moves downward
        size: random(1, 3),
        alpha: random(100, 200)
      });
    }
  }

  update() {
    if (!this.isActive && random() < this.blizzardProbability) {
      this.activate();
    }
    if (this.isActive) {
      this.duration--;
      this.updateAlpha();
      this.updateParticles();
      this.applyBlizzardEffects();
      if (this.duration <= 0) {
        this.deactivate();
      }
    }
  }

  updateAlpha() {
    if (this.duration > 3200 - this.fadeDuration) {
      this.alpha = map(3200 - this.duration, 0, this.fadeDuration, 0, 200);
    } else if (this.duration < this.fadeDuration) {
      this.alpha = map(this.duration, 0, this.fadeDuration, 0, 200);
    } else {
      this.alpha = 200;
    }
    this.visibility = map(this.alpha, 0, 200, 1, 0.7);
  }

  updateParticles() {
    for (let particle of this.particles) {
       particle.pos.add(particle.vel);
      this.wrapParticle(particle);
    }
  }

  wrapParticle(particle) {
    if (particle.pos.x > worldWidth) particle.pos.x = 0;
    if (particle.pos.x < 0) particle.pos.x = worldWidth;
    if (particle.pos.y > height) particle.pos.y = 0;
    if (particle.pos.y < 0) particle.pos.y = height;
  }

  draw() {
    if (this.isActive) {
      this.drawBackgroundTint();
      this.drawParticles();
    }
  }

  drawBackgroundTint() {
    fill(255, 255, 200, this.alpha * 0.3);
    rect(0, 0, worldWidth, height);
  }

  drawParticles() {
    noStroke();
    for (let particle of this.particles) {
      fill(255, 240, 200, particle.alpha * (this.alpha / 200));
      ellipse(particle.pos.x, particle.pos.y, particle.size);
    }
  }

  applyBlizzardEffects() {
    ship.vel.limit(ship.baseSpeed * this.speedupFactor);
    for (let alien of Alien.aliens) {
      alien.vel.limit(alien.baseSpeed * this.speedupFactor);
    }
    for (let hunter of Hunter.hunters) {
      hunter.vel.limit(hunter.baseSpeed * this.speedupFactor);
    }
    for (let zapper of Zapper.zappers) {
      zapper.vel.limit(zapper.baseSpeed * this.speedupFactor);
    }
    for (let destroyer of Destroyer.destroyers) {
      destroyer.vel.limit(destroyer.baseSpeed * this.speedupFactor);
    }
  }

  applyRecoveryEffects() {
    ship.vel.mult(this.recoveryFactor);
    for (let alien of Alien.aliens) {
      alien.vel.mult(this.recoveryFactor);
    }
    for (let hunter of Hunter.hunters) {
      hunter.vel.mult(this.recoveryFactor);
    }
    for (let zapper of Zapper.zappers) {
      zapper.vel.mult(this.recoveryFactor);
    }
    for (let destroyer of Destroyer.destroyers) {
      destroyer.vel.mult(this.recoveryFactor);
    }
  }

  deactivate() {
    this.isActive = false;
    this.particles = [];
    this.applyRecoveryEffects();
    announcer.speak("Helium Storm dissipated.", 0, 2);
    this.duration = this.totalDuration;
    gravity.y = -gravity.y;
  }

  isBlizzardActive() {
    return this.isActive;
  }
}


class Storm {
  constructor() {
    this.isActive = false;
    this.isWarning = false;
    this.warningDuration = 180; // 3 seconds
    this.stormDuration = 1800; // 30 seconds total
    this.fadeDuration = 180; // 3-second visual fade-out
    this.windFadeInDuration = 180; // 3 seconds to reach max wind
    this.windFadeOutDuration = 180; // 3 seconds to fade wind out
    this.alpha = 0;
    this.maxWindForce = 0.01;
    this.previousWindForce = 0;
    this.visibility = 1;
    this.stormProbability = 0.00002;
    this.warningTimer = 0;
    this.windFadeInTimer = 0;
    this.windFadeOutTimer = 0;
  }

  activate() {
    this.previousWindForce = windForce;
    this.isWarning = true;
    this.warningTimer = this.warningDuration;
    this.isActive = false;
    this.alpha = 0;
    announcer.speak("Storm warning!", 0, 2);
  }

  update() {
    if (!this.isActive && !this.isWarning && random() < this.stormProbability) {
      this.activate();
    }

    if (this.isWarning) {
      this.warningTimer--;
      if (this.warningTimer <= 0) {
        this.startStorm();
      }
    }

    if (this.isActive) {
      this.stormTimer--;

      // Wind force increases in first 3 seconds
      if (this.windFadeInTimer > 0) {
        let t = 1 - this.windFadeInTimer / this.windFadeInDuration;
        windForce = lerp(this.previousWindForce, this.maxWindForce, t);
        this.windFadeInTimer--;
      }

      // Wind force decreases in last 3 seconds
      if (this.windFadeOutTimer > 0) {
        let t = this.windFadeOutTimer / this.windFadeOutDuration;
        windForce = lerp(this.previousWindForce, this.maxWindForce, t);
        this.windFadeOutTimer--;
      }

      // Start fade-out when nearing end
      if (this.stormTimer === this.windFadeOutDuration) {
        this.windFadeOutTimer = this.windFadeOutDuration;
      }

      this.updateAlpha();

      if (this.stormTimer <= 0) {
        this.deactivate();
      }
    }
  }

  startStorm() {
    this.isWarning = false;
    this.isActive = true;
    this.stormTimer = this.stormDuration;
    this.windFadeInTimer = this.windFadeInDuration;
    this.windFadeOutTimer = 0;
  }

  updateAlpha() {
    if (this.isWarning) {
      this.alpha = map(this.warningTimer, this.warningDuration, 0, 0, 255);
    } else if (this.isActive) {
      if (this.windFadeInTimer > 0) {
        this.alpha = map(this.windFadeInTimer, this.windFadeInDuration, 0, 0, 255);
      } else if (this.windFadeOutTimer > 0) {
        this.alpha = map(this.windFadeOutTimer, this.windFadeOutDuration, 0, 255, 0);
      } else {
        this.alpha = 255;
      }
    }
    this.visibility = map(this.alpha, 0, 255, 1, 0.3);
  }

  draw() {
    if (this.isWarning || this.isActive) {
      this.drawBackgroundTint();
    }
  }

  drawBackgroundTint() {
    fill(100, 50, 50, this.alpha * 0.3);
    rect(0, 0, worldWidth, height);
  }

  deactivate() {
    this.isActive = false;
    windForce = this.previousWindForce;
  }

  isStormActive() {
    return this.isActive;
  }
}

class QuantumStorm {
  constructor() {
    this.quantumParticles = [];
    this.numParticles = 100;
    this.isActive = false;
    this.duration = 0;
    this.fadeDuration = 360;
    this.alpha = 0;
    this.stormProbability = 0.00002;
    this.vortexPoints = [];
    this.quantumRotation = 0;
    this.initializeParticles();
  }

  initializeParticles() {
    this.quantumParticles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.quantumParticles.push(new QuantumParticle(
        random(worldWidth), 
        random(height),
        random(360)
      ));
    }
    
    // Create 3 floating vortex points
    this.vortexPoints = [
      createVector(random(worldWidth), random(height)),
      createVector(random(worldWidth), random(height)),
      createVector(random(worldWidth), random(height))
    ];
  }

  activate() {
    this.isActive = true;
    this.duration = random(1000, 4000);
    this.alpha = 0;
    this.initializeParticles();
    soundManager.play('quantumRift');
    announcer.speak("Quantum Rift Detected!", 0, 2);
  }

  update() {
    if (!this.isActive && random() < this.stormProbability) {
      this.activate();
    }

    if (this.isActive) {
      this.duration--;
      this.quantumRotation += 0.02;

      // Update fade
      this.alpha = map(
        constrain(this.duration, 0, this.fadeDuration), 
        0, this.fadeDuration, 
        0, 255, 
        true
      );

      // Move vortex points in random patterns
      this.vortexPoints.forEach(v => {
        v.add(p5.Vector.random2D().mult(0.5));
        v.x = constrain(v.x, 0, worldWidth);
        v.y = constrain(v.y, 0, height);
      });

      // Update particles with quantum behavior
      this.quantumParticles.forEach(particle => {
        // Chance to teleport when near vortex points
        this.vortexPoints.forEach(vortex => {
          if (particle.pos.dist(vortex) < 50 && random() < 0.1) {
            particle.teleport();
          }
        });
        
        particle.update(this.vortexPoints, this.quantumRotation);

        // Check if player's ship is near a particle and teleport
        if (this.isShipNearParticle(particle)) {
          this.teleportPlayerShip();
        }

        if (this.isAstronautNearParticle(particle)) {
          this.teleportAstronaut();
        }

      });

      if (this.duration <= 0) this.deactivate();
    }
  }

  draw() {
    if (this.isActive) {
      push();
      blendMode(ADD);
      noFill();
      strokeWeight(1.5);
      
      this.quantumParticles.forEach(particle => {
        if (isInView(particle.pos, particle.size)) {
          // Draw glowing triangle with rotation
          push();
          translate(particle.pos.x, particle.pos.y);
          rotate(particle.rotation);
          stroke(190, 100, 100, this.alpha * 0.8);
          triangle(
            -particle.size, -particle.size,
            particle.size, -particle.size,
            0, particle.size
          );
          pop();
          
          // Draw connection lines to vortices
          this.vortexPoints.forEach(vortex => {
            if (particle.pos.dist(vortex) < 150) {
              stroke(
                280, 
                100, 
                map(particle.pos.dist(vortex), 0, 150, 100, 30), 
                this.alpha * 0.3
              );
              line(particle.pos.x, particle.pos.y, vortex.x, vortex.y);
            }
          });
        }
      });
      
      // Draw vortex effects
      this.vortexPoints.forEach(vortex => {
        fill(280, 100, 100, this.alpha * 0.2);
        noStroke();
        ellipse(vortex.x, vortex.y, 30, 30);
      });
      
      pop();
    }
  }

  isShipNearParticle(particle) {
    // Check if the ship is near the particle
    return dist(ship.pos.x, ship.pos.y, particle.pos.x, particle.pos.y) < 50;
  }

  isAstronautNearParticle(particle) {
    // Check if the astronaut is near the particle
    return dist(astronaut.pos.x, astronaut.pos.y, particle.pos.x, particle.pos.y) < 50;
  }

  teleportPlayerShip() {
    // Teleport the ship to a random position in the upper third of the screen
    ship.pos.y = random(0, height / 3);
    ship.pos.x = random(worldWidth); // Random x position across the world width
  }

  teleportAstronaut() {
    // Teleport the astronaut to a random position in the upper third of the screen
    astronaut.pos.y = random(0, height / 3);
    astronaut.pos.x = random(worldWidth); // Random x position across the world width
  }

  deactivate() {
    this.isActive = false;
    announcer.speak("Quantum Rift stabilised", 0, 2);
  }
}

class QuantumParticle {
  constructor(x, y, rotation) {
    this.pos = createVector(x, y);
    this.rotation = rotation;
    this.size = random(2, 5);
    this.velocity = p5.Vector.random2D().mult(random(0.5, 2));
    this.trail = [];
  }

  teleport() {
    this.pos = createVector(random(worldWidth), random(height));
    this.trail = []; // Reset trail
  }

  update(vortexPoints, globalRotation) {
    this.trail.push(this.pos.copy());
    if (this.trail.length > 10) this.trail.shift();

    // Apply multiple vortex influences
    vortexPoints.forEach(vortex => {
      let force = p5.Vector.sub(vortex, this.pos);
      let distance = force.mag();
      if (distance < 200) {
        force.setMag(map(distance, 0, 200, 2, 0.1));
        this.velocity.add(force);
      }
    });

    this.velocity.limit(3);
    this.pos.add(this.velocity);
    this.rotation += 0.1 + noise(this.pos.x * 0.01, this.pos.y * 0.01) * 0.3;

    // Bounce off edges
    if (this.pos.x < 0 || this.pos.x > worldWidth) this.velocity.x *= -1;
    if (this.pos.y < 0 || this.pos.y > height) this.velocity.y *= -1;
  }
}

class Eclipse {
  constructor() {
    this.isActive = false;
    this.duration = 0;
    this.warningDuration = 600; // 10 seconds (60fps)
    this.fadeInDuration = 600;  // 10 seconds
    this.darkDuration = 60;    // 1 seconds
    this.fadeOutDuration = 600; // 10 seconds
    this.totalDuration = this.warningDuration + this.fadeInDuration + this.darkDuration + this.fadeOutDuration;
    this.alpha = 0;
    this.warningMessage = "";

    // Added probability for an eclipse to occur
    this.eclipseProbability = 0.00002;
  }

  activate() {
    this.isActive = true;
    this.duration = this.totalDuration;
    this.alpha = 0;
    this.warningMessage = "Eclipse in 10 seconds!";
    soundManager.play('eclipseWarning');
    announcer.speak(this.warningMessage, 0, 2);
  }

  update() {
    // Check if eclipse should start
    if (!this.isActive && random() < this.eclipseProbability) {
      this.activate();
    }

    if (this.isActive) {
      this.duration--;

      const timeLeft = this.duration;
      const transitionStart = this.fadeInDuration + this.darkDuration + this.fadeOutDuration;
      const darkStart = this.darkDuration + this.fadeOutDuration;

      if (timeLeft > transitionStart) {
      } else if (timeLeft > darkStart) {
        // Fade to dark phase
        const fadeProgress = timeLeft - darkStart;
        this.alpha = map(fadeProgress, this.fadeInDuration, 0, 0, 255);
        this.warningMessage = "";
      } else if (timeLeft > this.fadeOutDuration) {
        // Darkness phase
        this.alpha = 255;
      } else {
        // Fade back phase
        this.alpha = map(timeLeft, this.fadeOutDuration, 0, 255, 0);
      }

      if (this.duration <= 0) this.deactivate();
    }
  }

  draw() {
    if (this.isActive) {
      fill(0, 0, 0, this.alpha);
      noStroke();
      rect(0, 0, worldWidth, height);
    }
  }

  deactivate() {
    this.isActive = false;
  }
}

class RainbowRain {
  constructor() {
    this.isActive = false;
    this.fadeDuration = 240;
    this.totalDuration = 4000;
    this.duration = this.totalDuration;
    this.alpha = 0;
    this.rainProbability = 0.00001;
    this.threads = [];
    this.maxThreads = 300;
    this.swirlIntensity = 0.1;
  }

  activate() {
    this.isActive = true;
    this.duration = this.totalDuration;
    this.alpha = 0;
    this.initializeThreads();
    announcer.speak("Psychotropic Exposure detected!", 0, 1);
  }

  initializeThreads() {
    this.threads = [];
    for (let i = 0; i < this.maxThreads; i++) {
      let red = noise(i * 0.1); // Simulating red channel extraction
      let bucketedRed = floor(red / 0.05) * 0.05;
      let randomValue = noise(bucketedRed * 10.0);
      let hue = (randomValue * 360 + millis() / 30) % 360;

      this.threads.push({
        pos: createVector(random(worldWidth), -random(50)),
        vel: createVector(random(-0.5, 0.5), random(0.5, 2.5)),
        length: random(30, 200),
        hue: hue,
        saturation: random(50, 100),
        brightness: random(20, 40),
        alpha: random(10, 100),
        sway: random(0.2, 0.5),
        noiseOffset: random(1000),
        thickness: random(30, 200)
      });
    }
  }

  update() {
    if (!this.isActive && random() < this.rainProbability) {
      this.activate();
    }
    if (this.isActive) {
      this.duration--;
      this.updateAlpha();
      this.updateThreads();
      if (this.duration <= 0) {
        this.deactivate();
      }
    }
  }

  updateAlpha() {
    if (this.duration > this.totalDuration - this.fadeDuration) {
      this.alpha = map(this.totalDuration - this.duration, 0, this.fadeDuration, 0, 255);
    } else if (this.duration < this.fadeDuration) {
      this.alpha = map(this.duration, 0, this.fadeDuration, 0, 255);
    } else {
      this.alpha = 255;
    }
  }

  updateThreads() {
    for (let thread of this.threads) {
      let swirl = map(noise(thread.noiseOffset + frameCount * 0.01), 0, 1, -1, 1);
      thread.vel.x += swirl * this.swirlIntensity;
      thread.vel.x += sin(frameCount * thread.sway) * 0.2;
      thread.pos.add(thread.vel);
      thread.noiseOffset += 0.01;

      if (thread.pos.y > height * 0.6) {
        thread.vel.x += random(-0.3, 0.3);
        thread.vel.y *= 0.95;
      }

      if (thread.pos.y > height + thread.length) {
        this.resetThread(thread);
      }
    }
  }

  draw() {
    if (this.isActive) {
      this.drawBackgroundEffect();
      this.drawThreads();
    }
  }

drawBackgroundEffect() {
  noStroke();
  blendMode(ADD);
  let gridSize = 40; // Control how fine the grid is

  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < worldWidth; x += gridSize) {
      let uvX = x / worldWidth;
      let uvY = y / height;
      let distToCenter = dist(uvX, uvY, 0.5, 0.5);
      let curvy = sin(frameCount * 0.05 + distToCenter * 10.0);
      let col = color(map(curvy, -1, 1, 0, 255), 100, 255, 80);

      fill(col);
      rect(x, y, gridSize, gridSize);
    }
  }
  blendMode(BLEND);
}

  drawThreads() {
    blendMode(ADD);
    noStroke();
    for (let thread of this.threads) {
      colorMode(HSB);
      let alpha = thread.alpha * (this.alpha / 255);
      let hueShifted = (thread.hue + millis() / 100) % 360;

      for (let i = 0; i < 3; i++) {
        let offset = i * 2;
        fill((hueShifted + i * 5) % 360, thread.saturation, thread.brightness, alpha * 0.7);
        
        beginShape();
        for (let j = 0; j < thread.length; j += 2) {
          let x = thread.pos.x + sin(j * 0.1 + frameCount * 0.05) * thread.thickness;
          let y = thread.pos.y + j;
          vertex(x, y);
        }
        endShape();
      }
    }
    blendMode(BLEND);
    colorMode(RGB);
  }

  resetThread(thread) {
    thread.pos.y = -thread.length;
    thread.pos.x = random(worldWidth);
    thread.vel.set(random(-0.5, 0.5), random(1.0, 3.0));
    thread.hue = (thread.hue + 30) % 360;
    thread.sway = random(0.2, 0.5);
  }

  deactivate() {
    this.isActive = false;
    this.threads = [];
    this.duration = this.totalDuration;
    announcer.speak("Psychotropics have worn off", 0, 1);
  }

  isRainActive() {
    return this.isActive;
  }
}
