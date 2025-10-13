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
    
    if (!ship.isLanded) {
      const dx = this.pos.x - ship.pos.x;
      const dy = this.pos.y - ship.pos.y;
      const minDist = (this.size + ship.size) / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        energy -= 2000; // High damage to flying ship
        soundManager.play('shipHit');
        return true;
      }
    }

    // Check collision with shields
    for (let shield of Shield.shields) {
      const dx = this.pos.x - shield.pos.x;
      const dy = this.pos.y - shield.pos.y;
      if (dx * dx + dy * dy < shield.radius * shield.radius) {
        shield.takeDamage(this.damage);
        return true; // Meteor disappears without exploding
      }
    }

    // Check collision with aliens
    let alienTypes = [Alien.aliens, Hunter.hunters, Zapper.zappers, Destroyer.destroyers];
    for (let alienGroup of alienTypes) {
      for (let i = alienGroup.length - 1; i >= 0; i--) {
        let alien = alienGroup[i];
        const dx = this.pos.x - alien.pos.x;
        const dy = this.pos.y - alien.pos.y;
        const minDist = (this.size + alien.size) / 2;
        if (dx * dx + dy * dy < minDist * minDist) {
          alien.health -= 30;
          
          // Don't return true here, allow the meteor to continue its flight
        }
      }
    }

    // Check collision with plants (in-flight). Damage but don't explode on contact.
    for (let i = AlienPlant.plants.length - 1; i >= 0; i--) {
      const plant = AlienPlant.plants[i];
      const dx = this.pos.x - plant.pos.x;
      const dy = this.pos.y - plant.pos.y;
      const minDist = (this.size + (plant.currentSize || plant.size)) / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        if (plant.takeDamage(30)) {
          AlienPlant.destroyPlant(i);
        }
        // Continue flight without returning true
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

    // Damage plants (use adjusted radius with plant's current size and squared distance)
    for (let i = AlienPlant.plants.length - 1; i >= 0; i--) {
      const plant = AlienPlant.plants[i];
      const dx = this.pos.x - plant.pos.x;
      const dy = this.pos.y - plant.pos.y;
      const adjustedRadius = this.explosionRadius + (plant.currentSize || plant.size) / 2;
      if (dx * dx + dy * dy < adjustedRadius * adjustedRadius) {
        if (plant.takeDamage(this.damage)) {
          AlienPlant.destroyPlant(i);
        }
      }
    }

    // Damage nests
    for (let nest of Nest.nests) {
      let d = dist(this.pos.x, this.pos.y, nest.pos.x, nest.pos.y);
      let adjustedRadius = this.explosionRadius + nest.size / 2; // Include nest size
      if (d < adjustedRadius) {
        nest.health -= this.damage;
      }
    }

    // Damage fortresses
    for (let fortress of AlienFortress.fortresses) {
      let d = dist(this.pos.x, this.pos.y, fortress.pos.x, fortress.pos.y);
      let adjustedRadius = this.explosionRadius + fortress.size / 2; // Include fortress size
      if (d < adjustedRadius) {
        fortress.health -= this.damage;
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
      if (worm && worm.segments && worm.segments.length > 0) {
        if (dist(this.pos.x, this.pos.y, worm.segments[0].pos.x, worm.segments[0].pos.y) < this.explosionRadius) {
          worm.takeDamage(this.damage);
        }
      }
    }

    // Adjust positions of game objects
    this.adjustGameObjectPositions();
  }

    damageAlienEntities(entities) {
    for (let i = entities.length - 1; i >= 0; i--) {
      let entity = entities[i];
      let d = dist(this.pos.x, this.pos.y, entity.pos.x, entity.pos.y);
      let adjustedRadius = this.explosionRadius + entity.size / 2; // Include entity size
      if (d < adjustedRadius) {
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
      if (nest.isAnchoredToReed) continue; // anchored entities follow reed tips
      let newY = min(this.getNewSurfaceY(nest.pos.x), height);
      nest.pos.y = newY - nest.size / 2;
    }
    for (let fortress of AlienFortress.fortresses) {
      if (fortress.isAnchoredToReed) continue; // anchored entities follow reed tips
      let newY = min(this.getNewSurfaceY(fortress.pos.x), height);
      fortress.pos.y = newY - fortress.size / 2;
    }
    for (let turret of turrets) {
      let newY = min(this.getNewSurfaceY(turret.pos.x), height);
      turret.pos.y = newY - turret.size / 2;
    }
    
  for (let plant of AlienPlant.plants) {
    let newY = min(this.getNewSurfaceY(plant.pos.x), height);
    plant.targetPos.y = newY - (plant.currentSize || plant.size) / 2;
  }

    if (ship.isLanded) {
      let newY = min(this.getNewSurfaceY(ship.pos.x), height);
      ship.pos.y = newY - ship.size / 2;
      // Update pod position if ship is carrying it
      if (ship.hasGrabbedPod) {
        ship.updatePodPosition();
      }
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
      if (nest.isAnchoredToReed) continue; // anchored entities follow reed tips
      let newY = DiamondRain.getNewSurfaceY(nest.pos.x);
      nest.pos.y = newY - nest.size / 2;
    }
    for (let fortress of AlienFortress.fortresses) {
      if (fortress.isAnchoredToReed) continue; // anchored entities follow reed tips
      let newY = DiamondRain.getNewSurfaceY(fortress.pos.x);
      fortress.pos.y = newY - fortress.size / 2;
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
      // Update pod position if ship is carrying it
      if (ship.hasGrabbedPod) {
        ship.updatePodPosition();
      }
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
  this.earthquakeProbability = 0.000025; // Halved from 0.00005
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
    this.smoothMoonSurface();
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

  smoothMoonSurface() {
    // Smooth the moon surface to reduce spikiness
    // The intensity of the earthquake determines how much smoothing occurs
    // Softer smoothing: fewer passes overall
    let smoothingPasses = floor(this.earthquakeIntensity / 3); // dialed back from /2
    smoothingPasses = max(1, smoothingPasses); // At least one pass
    
    for (let pass = 0; pass < smoothingPasses; pass++) {
      // Create a copy of surface heights to avoid feedback during smoothing
      let smoothedHeights = [];
      
      for (let i = 0; i < moonSurface.length; i++) {
        if (i === 0 || i === moonSurface.length - 1) {
          // Keep endpoints unchanged
          smoothedHeights[i] = moonSurface[i].y;
        } else {
          // Average with neighbors to smooth
          let prevY = moonSurface[i - 1].y;
          let currY = moonSurface[i].y;
          let nextY = moonSurface[i + 1].y;
          
          // Gentler weighting: preserve more current detail
          smoothedHeights[i] = (prevY * 0.15 + currY * 0.70 + nextY * 0.15);
        }
      }
      
      // Apply smoothed heights
      for (let i = 0; i < moonSurface.length; i++) {
        moonSurface[i].y = smoothedHeights[i];
      }
    }
    
    // Terrain changed by earthquake
    if (typeof clearTerrainCache === 'function') clearTerrainCache();
    
    // Update positions of game objects on the surface
    this.adjustGameObjectPositions();
  }

  adjustGameObjectPositions() {
    // Update moon bases
    for (let base of MoonBase.moonBases) {
      let newY = this.getNewSurfaceY(base.pos.x);
      base.pos.y = newY - base.height;
    }
    
    // Update nests
    for (let nest of Nest.nests) {
      if (nest.isAnchoredToReed) continue; // anchored entities follow reed tips
      let newY = this.getNewSurfaceY(nest.pos.x);
      nest.pos.y = newY - nest.size / 2;
    }
    
    // Update turrets
    for (let turret of turrets) {
      let newY = this.getNewSurfaceY(turret.pos.x);
      turret.pos.y = newY - turret.size / 2;
    }
    
    // Update alien plants
    for (let plant of AlienPlant.plants) {
      let newY = min(this.getNewSurfaceY(plant.pos.x), height);
      plant.targetPos.y = newY - plant.size / 2;
    }
    
    // Update drill rigs
    for (let rig of DrillRig.rigs) {
      let newY = this.getNewSurfaceY(rig.pos.x);
      rig.pos.y = newY - rig.size / 2;
    }
    
    // Update ship if landed
    if (ship.isLanded) {
      let newY = this.getNewSurfaceY(ship.pos.x);
      ship.pos.y = newY - ship.size / 2;
      // Update pod position if ship is carrying it
      if (ship.hasGrabbedPod) {
        ship.updatePodPosition();
      }
    }
    
    // Update ruined ships
    RuinedShip.updatePositions();
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

class TectonicShiftManager {
  constructor() {
    this.cameraShake = createVector(0, 0);
    this.isTectonicShift = false;
    this.tectonicShiftIntensity = 0;
    this.tectonicShiftWarningTimer = 0;
    this.tectonicShiftDuration = 0;
    this.maxTectonicShiftIntensity = 10;
  this.tectonicShiftProbability = 0.000025; // Halved from 0.00005
  }

  update() {
    if (this.tectonicShiftWarningTimer > 0) {
      this.tectonicShiftWarningTimer--;
      if (this.tectonicShiftWarningTimer === 0) {
        this.startTectonicShift();
      }
    }

    if (this.isTectonicShift) {
      this.tectonicShiftDuration--;
      if (this.tectonicShiftDuration <= 0) {
        this.isTectonicShift = false;
      }
      this.updateCameraShake();
    } else {
      this.cameraShake.set(0, 0);
    }

    this.checkForRandomTectonicShift();
  }

  startTectonicShiftWarning() {
    this.tectonicShiftWarningTimer = 600; // 10 seconds at 60 fps
    announcer.speak("Tectonic shift imminent!", 0, 2);
  }

  startTectonicShift() {
    this.isTectonicShift = true;
    this.tectonicShiftDuration = random(100, 400);
    this.tectonicShiftIntensity = random(1, this.maxTectonicShiftIntensity); // Random intensity
    soundManager.play('earthquake'); // Reuse earthquake sound
    this.damageSurfaceEntities();
    this.spikeMoonSurface();
  }

  damageSurfaceEntities() {
    let damageFactor = this.tectonicShiftIntensity / this.maxTectonicShiftIntensity;
    for (let i = MoonBase.moonBases.length - 1; i >= 0; i--) {
      let base = MoonBase.moonBases[i];
      base.health -= 50 * damageFactor;
    }
    for (let nest of Nest.nests) {
      nest.health -= 2 * damageFactor;
    }
    for (let fortress of AlienFortress.fortresses) {
      fortress.health -= 2 * damageFactor;
    }
    for (let rig of DrillRig.rigs) {
      rig.health -= 50 * damageFactor;
    }
    if (RescueMission.strandedAstronaut) {
      RescueMission.strandedAstronaut.takeDamage(50 * damageFactor);
    }
  }

  spikeMoonSurface() {
    // Spike the moon surface to increase jaggedness (opposite of smoothing)
    // The intensity of the tectonic shift determines how much spiking occurs
    // Softer spiking: fewer passes overall
    let spikingPasses = floor(this.tectonicShiftIntensity / 3); // dialed back from /2
    spikingPasses = max(1, spikingPasses); // At least one pass
    
    for (let pass = 0; pass < spikingPasses; pass++) {
      // Create a copy of surface heights to avoid feedback during spiking
      let spikedHeights = [];
      
      for (let i = 0; i < moonSurface.length; i++) {
        if (i === 0 || i === moonSurface.length - 1) {
          // Keep endpoints unchanged
          spikedHeights[i] = moonSurface[i].y;
        } else {
          // Amplify differences with neighbors to create spikes
          let prevY = moonSurface[i - 1].y;
          let currY = moonSurface[i].y;
          let nextY = moonSurface[i + 1].y;
          
          // Calculate the difference from the average to amplify terrain features
          let avgNeighbors = (prevY + nextY) / 2;
          let difference = currY - avgNeighbors;
          
          // Gentler amplification for spikes to reduce jaggedness
          spikedHeights[i] = currY + difference * 0.2;
        }
      }
      
      // Apply spiked heights
      for (let i = 0; i < moonSurface.length; i++) {
        moonSurface[i].y = spikedHeights[i];
      }
    }
    
    // Terrain changed by tectonic shift
    if (typeof clearTerrainCache === 'function') clearTerrainCache();
    
    // Update positions of game objects on the surface
    this.adjustGameObjectPositions();
  }

  adjustGameObjectPositions() {
    // Update moon bases
    for (let base of MoonBase.moonBases) {
      let newY = this.getNewSurfaceY(base.pos.x);
      base.pos.y = newY - base.height;
    }
    
    // Update nests
    for (let nest of Nest.nests) {
      let newY = this.getNewSurfaceY(nest.pos.x);
      nest.pos.y = newY - nest.size / 2;
    }
    
    // Update turrets
    for (let turret of turrets) {
      let newY = this.getNewSurfaceY(turret.pos.x);
      turret.pos.y = newY - turret.size / 2;
    }
    
    // Update fortresses
    for (let fortress of AlienFortress.fortresses) {
      let newY = this.getNewSurfaceY(fortress.pos.x);
      fortress.pos.y = newY - fortress.size / 2;
    }
    
    // Update alien plants
    for (let plant of AlienPlant.plants) {
      let newY = min(this.getNewSurfaceY(plant.pos.x), height);
      plant.targetPos.y = newY - plant.size / 2;
    }
    
    // Update drill rigs
    for (let rig of DrillRig.rigs) {
      let newY = this.getNewSurfaceY(rig.pos.x);
      rig.pos.y = newY - rig.size / 2;
    }
    
    // Update ship if landed
    if (ship.isLanded) {
      let newY = this.getNewSurfaceY(ship.pos.x);
      ship.pos.y = newY - ship.size / 2;
      // Update pod position if ship is carrying it
      if (ship.hasGrabbedPod) {
        ship.updatePodPosition();
      }
    }
    
    // Update ruined ships
    RuinedShip.updatePositions();
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

  updateCameraShake() {
    let currentIntensity = this.calculateShakeIntensity();
    this.cameraShake.set(
      random(-currentIntensity, currentIntensity),
      random(-currentIntensity, currentIntensity)
    );
  }

  calculateShakeIntensity() {
    let progress = 1 - (this.tectonicShiftDuration / 300); // Assuming 300 is the total duration
    if (progress < 0.2) {
      // Ramp up
      return this.tectonicShiftIntensity * (progress / 0.2);
    } else if (progress > 0.8) {
      // Ramp down
      return this.tectonicShiftIntensity * (1 - (progress - 0.8) / 0.2);
    } else {
      // Peak intensity
      return this.tectonicShiftIntensity;
    }
  }

  checkForRandomTectonicShift() {
    if (!this.isTectonicShift && this.tectonicShiftWarningTimer === 0 && random() < this.tectonicShiftProbability) {
      this.startTectonicShiftWarning();
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
  this.magneticStormProbability = 0.00001; // Halved from 0.00002
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
  this.blizzardProbability = 0.00001; // Halved from 0.00002
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
  this.blizzardProbability = 0.00001; // Halved from 0.00002
    this.windStrength = 0;
    this.visibility = 1;
    this.particles = [];
    this.maxParticles = 6000;
    this.speedupFactor = 6;
    this.recoveryFactor = 1 / this.speedupFactor;
    this.originalGravity = null;
    this.gravityReductionFactor = 0.1; // Reduce gravity to 10% of normal
  }

  activate() {
    this.originalGravity = gravity.copy();
    gravity.y *= this.gravityReductionFactor;
    this.isActive = true;
    this.duration = this.totalDuration;
    this.alpha = 0;
    this.windStrength = random(2, 5);
    this.initializeParticles();
    soundManager.play('helium');
    announcer.speak("Helium Storm! Reduced gravity and acceleration.", 0, 2);   
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
    if (this.originalGravity) {
      gravity.y = this.originalGravity.y;
    }
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
  this.stormProbability = 0.00001; // Halved from 0.00002
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
  this.stormProbability = 0.00001; // Halved from 0.00002
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
        // Chance to teleport when near vortex points - use squared distance
        const teleportDistSq = 50 * 50;
        for (let i = 0; i < this.vortexPoints.length; i++) {
          const vortex = this.vortexPoints[i];
          const dx = vortex.x - particle.pos.x;
          const dy = vortex.y - particle.pos.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq < teleportDistSq && random() < 0.1) {
            particle.teleport();
            break; // Early exit after teleport
          }
        }
        
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
      
      // Pre-calculate triangle stroke color
      const triangleStrokeAlpha = this.alpha * 0.8;
      
      this.quantumParticles.forEach(particle => {
        if (isInView(particle.pos, particle.size)) {
          // Draw glowing triangle with rotation
          push();
          translate(particle.pos.x, particle.pos.y);
          rotate(particle.rotation);
          stroke(190, 100, 100, triangleStrokeAlpha);
          triangle(
            -particle.size, -particle.size,
            particle.size, -particle.size,
            0, particle.size
          );
          pop();
          
          // Draw connection lines to vortices
          const maxDistSq = 150 * 150; // Pre-calculate squared distance for comparison
          for (let i = 0; i < this.vortexPoints.length; i++) {
            const vortex = this.vortexPoints[i];
            const dx = vortex.x - particle.pos.x;
            const dy = vortex.y - particle.pos.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < maxDistSq) {
              const dist = Math.sqrt(distSq);
              stroke(
                280, 
                100, 
                map(dist, 0, 150, 100, 30), 
                this.alpha * 0.3
              );
              line(particle.pos.x, particle.pos.y, vortex.x, vortex.y);
            }
          }
        }
      });
      
      // Draw vortex effects - batch fill/noStroke outside loop
      fill(280, 100, 100, this.alpha * 0.2);
      noStroke();
      for (let i = 0; i < this.vortexPoints.length; i++) {
        const vortex = this.vortexPoints[i];
        ellipse(vortex.x, vortex.y, 30, 30);
      }
      
      pop();
    }
  }

  isShipNearParticle(particle) {
    // Check if the ship is near the particle - use squared distance
    const dx = ship.pos.x - particle.pos.x;
    const dy = ship.pos.y - particle.pos.y;
    return (dx * dx + dy * dy) < 2500; // 50 * 50
  }

  isAstronautNearParticle(particle) {
    // Check if the astronaut is near the particle - use squared distance
    const dx = astronaut.pos.x - particle.pos.x;
    const dy = astronaut.pos.y - particle.pos.y;
    return (dx * dx + dy * dy) < 2500; // 50 * 50
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

    // Apply multiple vortex influences - optimize with squared distance check first
    const maxDistSq = 200 * 200;
    for (let i = 0; i < vortexPoints.length; i++) {
      const vortex = vortexPoints[i];
      const dx = vortex.x - this.pos.x;
      const dy = vortex.y - this.pos.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < maxDistSq) {
        const distance = Math.sqrt(distSq);
        let force = p5.Vector.sub(vortex, this.pos);
        force.setMag(map(distance, 0, 200, 2, 0.1));
        this.velocity.add(force);
      }
    }

    this.velocity.limit(3);
    this.pos.add(this.velocity);
    this.rotation += 0.1 + noise(this.pos.x * 0.01, this.pos.y * 0.01) * 0.3;

    // Bounce off edges or wrap around world
    if (this.pos.x < 0) {
      this.pos.x += worldWidth;
    } else if (this.pos.x > worldWidth) {
      this.pos.x -= worldWidth;
    }
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
  this.eclipseProbability = 0.00001; // Halved from 0.00002
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
  this.rainProbability = 0.000005; // Halved from 0.00001
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
    colorMode(HSB);
    noStroke();
    for (let thread of this.threads) {
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

class LightningStorm {
  constructor() {
    this.isActive = false;
    this.isWarning = false;
    this.warningDuration = 600; // 10 seconds
    this.stormDuration = 1200; // 20 seconds
    this.alpha = 0;
  this.stormProbability = 0.00001; // Halved from 0.00002
    this.warningTimer = 0;
    this.stormTimer = 0;
    this.lightningBolts = []; // Main bolt objects
    this.maxBolts = 3; // Maximum simultaneous lightning bolts
    this.boltCooldown = 0;
    //this.minBoltInterval = 30; // Minimum frames between bolts
    //this.maxBoltInterval = 90; // Maximum frames between bolts
    this.minBoltInterval = 5; // Minimum frames between bolts
    this.maxBoltInterval = 25; // Maximum frames between bolts
    this.flashAlpha = 0;
    this.flashDecay = 30; // How fast the screen flash fades
    // New effect containers
    this.sparks = []; // Small particle sparks at impact points
    this.scorchMarks = []; // Fading ground scorch marks
  }

  activate() {
    this.isWarning = true;
    this.warningTimer = this.warningDuration;
    this.isActive = false;
    this.alpha = 0;
    announcer.speak("Lightning Storm in 10 seconds! Warning your engines will be disabled", 0, 2);
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
      this.updateAlpha();
      
      // Update lightning bolts
      for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
        const bolt = this.lightningBolts[i];
        bolt.life--;
        // Update branch lifetimes
        for (let b = bolt.branches.length - 1; b >= 0; b--) {
          bolt.branches[b].life--;
          if (bolt.branches[b].life <= 0) {
            bolt.branches.splice(b, 1);
          }
        }
        if (bolt.life <= 0) {
          this.lightningBolts.splice(i, 1);
        }
      }

      // Create new lightning bolts
      if (this.boltCooldown <= 0 && this.lightningBolts.length < this.maxBolts) {
        this.createLightningBolt();
        this.boltCooldown = floor(random(this.minBoltInterval, this.maxBoltInterval));
        this.flashAlpha = 100; // Trigger screen flash
        // Lightning sound now handled conditionally inside createLightningBolt() only if bolt is on-screen
      }
      this.boltCooldown--;

      // Fade screen flash
      if (this.flashAlpha > 0) {
        this.flashAlpha = max(0, this.flashAlpha - this.flashDecay);
      }

      // Apply effects to ships and missiles
      this.disableThrust();

      if (this.stormTimer <= 0) {
        this.deactivate();
      }
    }
  }

  startStorm() {
    this.isWarning = false;
    this.isActive = true;
    this.stormTimer = this.stormDuration;
    this.lightningBolts = [];
    this.boltCooldown = 10; // Start quickly
    // Lock all ship and wingman engines
    Ship.enginesLocked = true;
    
    // Auto-deploy player ship parachute
    if (!ship.isLanded && ship.hasParachute && !ship.parachuteDeployed) {
      ship.parachuteDeployed = true;
    }
    
    announcer.speak("Lightning Storm! All engines disabled!", 0, 2);
  }

  updateAlpha() {
    const fadeDuration = 60;
    if (this.stormTimer > this.stormDuration - fadeDuration) {
      this.alpha = map(this.stormDuration - this.stormTimer, 0, fadeDuration, 0, 150);
    } else if (this.stormTimer < fadeDuration) {
      this.alpha = map(this.stormTimer, 0, fadeDuration, 0, 150);
    } else {
      this.alpha = 150;
    }
  }

  createLightningBolt() {
    // Core bolt start/end
    const startX = random(worldWidth);
    const startY = 0;
    const endX = startX + random(-80, 80);
    // Find surface height at endX so bolt always reaches ground
    const surfaceY = getCachedSurfaceYAtX(endX);
    // Slight offset above ground for visual separation
    const endY = surfaceY - random(2, 6);

    const bolt = this.generateFractalBolt(startX, startY, endX, endY);
    // Ensure final point is at (or just above) ground after subdivision jitter
    bolt.points[bolt.points.length - 1].y = getCachedSurfaceYAtX(bolt.points[bolt.points.length - 1].x) - 1;
    this.lightningBolts.push(bolt);
    this.createImpactEffects(bolt);

    // Play sound only if any part of the bolt is within current camera view
    if (soundManager && soundManager.play) {
      const visible = bolt.points.some(p => p.x >= viewLeft && p.x <= viewRight && p.y >= 0 && p.y <= height);
      if (visible) {
        soundManager.play('lightning');
      }
    }
  }

  // --- Fractal Bolt Generation (midpoint displacement + branching) ---
  generateFractalBolt(x1, y1, x2, y2) {
    const basePoints = [createVector(x1, y1), createVector(x2, y2)];
    this.subdivideBolt(basePoints, 80, 0.55, 6); // displacement, roughness, min segment length

    // Build branches off random main path points
    const branches = [];
    const branchCount = floor(random(1, 4));
    for (let i = 0; i < branchCount; i++) {
      const idx = floor(random(2, basePoints.length - 2));
      const anchor = basePoints[idx];
      const branchEnd = p5.Vector.add(
        anchor,
        createVector(random(-120, 120), random(40, 180))
      );
      const bPoints = [anchor.copy(), branchEnd];
      this.subdivideBolt(bPoints, 40, 0.6, 8);
      branches.push({
        points: bPoints,
        life: 10,
        maxLife: 10
      });
    }

    return {
      points: basePoints,
      branches: branches,
      life: 18,
      maxLife: 18,
      thickness: random(2.2, 3.8),
      pulsePhase: random(TWO_PI)
    };
  }

  subdivideBolt(points, displacement, roughness, minSeg) {
    // Recursive midpoint displacement for natural lightning
    for (let i = points.length - 1; i > 0; i--) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minSeg * minSeg) continue; // segment small enough
      const mid = createVector((a.x + b.x) / 2, (a.y + b.y) / 2);
      // Perpendicular jitter
      const perp = createVector(-dy, dx).setMag(random(-displacement, displacement));
      mid.add(perp);
      points.splice(i, 0, mid);
    }
    displacement *= roughness;
    if (displacement > 3) {
      this.subdivideBolt(points, displacement, roughness, minSeg);
    }
  }

  createImpactEffects(bolt) {
    // Determine end point (last point of main bolt)
    const end = bolt.points[bolt.points.length - 1];
    // Re-snap defensively
    end.y = getCachedSurfaceYAtX(end.x) - 1;
    // (Sound handled in createLightningBolt when bolt confirmed visible)
    // Sparks
    const sparkCount = floor(random(4, 10));
    for (let i = 0; i < sparkCount; i++) {
      this.sparks.push({
        pos: end.copy(),
        vel: p5.Vector.random2D().mult(random(1, 3)).add(createVector(0, random(0.5, 2))),
        life: random(15, 35),
        maxLife: 0, // Will set after
        hue: random(190, 230)
      });
      this.sparks[this.sparks.length - 1].maxLife = this.sparks[this.sparks.length - 1].life;
    }
    // Scorch mark
    this.scorchMarks.push({
      x: end.x,
      y: getCachedSurfaceYAtX(end.x),
      alpha: 180,
      size: random(18, 40)
    });

    // Apply destruction at strike location
    this.applyStrikeDestruction(end.x, end.y);
  }

  applyStrikeDestruction(x, y) {
    // Three damage zones for realistic lightning strike
    const lethalRadius = 25;        // Instant death zone (direct strike)
    const severeRadius = 50;        // Severe damage zone (close proximity)
    const moderateRadius = 75;      // Moderate damage zone (shock wave)
    
    const lethalRadiusSq = lethalRadius * lethalRadius;
    const severeRadiusSq = severeRadius * severeRadius;
    const moderateRadiusSq = moderateRadius * moderateRadius;

    // Helper to calculate damage based on distance
    const getDamageMultiplier = (px, py) => {
      const dx = px - x;
      const dy = py - y;
      const distSq = dx*dx + dy*dy;
      
      if (distSq <= lethalRadiusSq) return 1.0;      // 100% damage (lethal)
      if (distSq <= severeRadiusSq) return 0.7;      // 70% damage (severe)
      if (distSq <= moderateRadiusSq) return 0.3;    // 30% damage (moderate)
      return 0;                                       // No damage
    };
    
    // Helper for simple distance check (any damage zone)
    const withinDamageZone = (px, py) => {
      const dx = px - x;
      const dy = py - y;
      return (dx*dx + dy*dy) <= moderateRadiusSq;
    };

    // Ship (only if landed and near surface endpoint)
    if (ship && ship.isLanded) {
      const damageMultiplier = getDamageMultiplier(ship.pos.x, ship.pos.y + ship.size/2);
      if (damageMultiplier > 0) {
        energy -= Math.floor(1500 * damageMultiplier); // Scaled energy damage
        if (soundManager) soundManager.play('shipHit');
      }
    }

    // Astronaut (walking mode)
    if (isWalking && astronaut) {
      const damageMultiplier = getDamageMultiplier(astronaut.pos.x, astronaut.pos.y + astronaut.size/2);
      if (damageMultiplier > 0) {
        energy -= Math.floor(1000 * damageMultiplier); // Scaled energy damage
      }
    }

    // Pod (if present at strike)
    if (pod && !pod.pickedUpByShip && !pod.pickedUpByAstronaut) {
      const damageMultiplier = getDamageMultiplier(pod.pos.x, pod.pos.y);
      if (damageMultiplier > 0) {
        explosions.push(new Explosion(createVector(pod.pos.x, pod.pos.y), 40, color(255,255,255), color(120,120,255)));
        pod.podDropOff(createVector(pod.pos.x, pod.pos.y - 30)); // minor displacement
      }
    }

    // Moon bases
    for (let i = MoonBase.moonBases.length - 1; i >= 0; i--) {
      const base = MoonBase.moonBases[i];
      const bx = base.pos.x + base.width/2;
      const by = base.pos.y + base.height/2;
      const damageMultiplier = getDamageMultiplier(bx, by);
      if (damageMultiplier > 0) {
        base.health -= Math.floor(300 * damageMultiplier); // Scaled damage (increased from 200)
        if (base.health <= 0) {
          explosions.push(new Explosion(createVector(bx, by), 80, color(255,255,255), color(180,180,255)));
          MoonBase.moonBases.splice(i,1);
        }
      }
    }

    // Turrets
    for (let i = turrets.length - 1; i >= 0; i--) {
      const t = turrets[i];
      const damageMultiplier = getDamageMultiplier(t.pos.x, t.pos.y);
      if (damageMultiplier > 0) {
        t.health -= Math.floor(t.health * damageMultiplier); // Proportional damage
        if (t.health <= 0) {
          explosions.push(new Explosion(t.pos.copy(), 50, color(255,255,255), color(150,150,255)));
          turrets.splice(i,1);
        }
      }
    }

    // Drill Rigs
    for (let i = DrillRig.rigs.length - 1; i >= 0; i--) {
      const rig = DrillRig.rigs[i];
      const damageMultiplier = getDamageMultiplier(rig.pos.x, rig.pos.y);
      if (damageMultiplier > 0) {
        rig.health -= Math.floor(rig.health * damageMultiplier); // Proportional damage
        if (rig.health <= 0) {
          explosions.push(new Explosion(rig.pos.copy(), 50, color(255,255,255), color(150,150,255)));
          DrillRig.rigs.splice(i,1);
        }
      }
    }

    // Walkers
    for (let i = WalkerRobot.walkers.length - 1; i >= 0; i--) {
      const walker = WalkerRobot.walkers[i];
      const damageMultiplier = getDamageMultiplier(walker.pos.x, walker.pos.y);
      if (damageMultiplier > 0) {
        walker.health -= Math.floor(walker.health * damageMultiplier); // Proportional damage
        if (walker.health <= 0) {
          explosions.push(new Explosion(walker.pos.copy(), 40, color(255,255,255), color(120,120,255)));
          WalkerRobot.walkers.splice(i,1);
        }
      }
    }

    // Aliens (and special alien types) - apply tiered damage
    const damageAlienArray = arr => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const a = arr[i];
        const damageMultiplier = getDamageMultiplier(a.pos.x, a.pos.y);
        if (damageMultiplier > 0) {
          a.health -= Math.floor((a.health || 100) * damageMultiplier); // Proportional damage
          if (a.health <= 0) {
            explosions.push(new Explosion(a.pos.copy(), a.size || 30, color(255,255,255), color(150,150,255)));
            soundManager && soundManager.play('alienDestruction');
            arr.splice(i,1);
          }
        }
      }
    };
    damageAlienArray(Alien.aliens);
    damageAlienArray(Hunter.hunters);
    damageAlienArray(Zapper.zappers);
    damageAlienArray(Destroyer.destroyers);

    // Plants
    for (let i = AlienPlant.plants.length - 1; i >= 0; i--) {
      const plant = AlienPlant.plants[i];
      const damageMultiplier = getDamageMultiplier(plant.pos.x, plant.pos.y);
      if (damageMultiplier > 0) {
        explosions.push(new Explosion(plant.pos.copy(), plant.size || 30, color(255,255,255), color(150,150,255)));
        AlienPlant.destroyPlant(i);
      }
    }

    // Nests
    for (let i = Nest.nests.length - 1; i >= 0; i--) {
      const nest = Nest.nests[i];
      const damageMultiplier = getDamageMultiplier(nest.pos.x, nest.pos.y);
      if (damageMultiplier > 0) {
        nest.health -= Math.floor((nest.health || 100) * damageMultiplier); // Proportional damage
        if (nest.health <= 0) {
          explosions.push(new Explosion(nest.pos.copy(), nest.size || 40, color(255,255,255), color(150,150,255)));
          Nest.nests.splice(i,1);
        }
      }
    }

    // Fortresses
    for (let i = AlienFortress.fortresses.length - 1; i >= 0; i--) {
      const fort = AlienFortress.fortresses[i];
      const damageMultiplier = getDamageMultiplier(fort.pos.x, fort.pos.y);
      if (damageMultiplier > 0) {
        fort.health -= Math.floor((fort.health || 100) * damageMultiplier); // Proportional damage
        if (fort.health <= 0) {
          explosions.push(new Explosion(fort.pos.copy(), fort.size || 60, color(255,255,255), color(150,150,255)));
          AlienFortress.fortresses.splice(i,1);
        }
      }
    }
    
    // AlienWorms - check each segment
    for (let i = AlienWorm.worms.length - 1; i >= 0; i--) {
      const worm = AlienWorm.worms[i];
      let maxDamageMultiplier = 0;
      for (let segment of worm.segments) {
        const damageMultiplier = getDamageMultiplier(segment.pos.x, segment.pos.y);
        maxDamageMultiplier = Math.max(maxDamageMultiplier, damageMultiplier);
      }
      if (maxDamageMultiplier > 0) {
        worm.health -= Math.floor((worm.health || 100) * maxDamageMultiplier);
        if (worm.health <= 0 && worm.takeDamage) {
          worm.takeDamage(worm.health); // Trigger worm death
        }
      }
    }
    
    // Shields - damage or destroy
    for (let i = Shield.shields.length - 1; i >= 0; i--) {
      const shield = Shield.shields[i];
      const damageMultiplier = getDamageMultiplier(shield.pos.x, shield.pos.y);
      if (damageMultiplier > 0) {
        shield.health -= Math.floor(100 * damageMultiplier); // Heavy damage to shields
        if (shield.health <= 0) {
          Shield.shields.splice(i,1);
        }
      }
    }
    
    // Wingmen - player units are affected
    for (let i = Wingman.wingmen.length - 1; i >= 0; i--) {
      const wingman = Wingman.wingmen[i];
      const damageMultiplier = getDamageMultiplier(wingman.pos.x, wingman.pos.y);
      if (damageMultiplier > 0) {
        wingman.health -= Math.floor((wingman.health || 100) * damageMultiplier);
        if (wingman.health <= 0) {
          explosions.push(new Explosion(wingman.pos.copy(), wingman.size || 30, color(255,255,255), color(150,150,255)));
          Wingman.wingmen.splice(i,1);
        }
      }
    }
    
    // Boss entities - AlienQueen
    if (alienQueen) {
      const damageMultiplier = getDamageMultiplier(alienQueen.pos.x, alienQueen.pos.y);
      if (damageMultiplier > 0) {
        const damage = Math.floor(500 * damageMultiplier); // Heavy damage to boss
        if (alienQueen.takeDamage) {
          alienQueen.takeDamage(damage);
        }
      }
    }
    
    // Boss entities - AlienKing
    if (alienKing) {
      const damageMultiplier = getDamageMultiplier(alienKing.pos.x, alienKing.pos.y);
      if (damageMultiplier > 0) {
        const damage = Math.floor(500 * damageMultiplier); // Heavy damage to boss
        if (alienKing.takeDamage) {
          alienKing.takeDamage(damage);
        }
      }
    }
  }

  draw() {
    if (this.isWarning || this.isActive) {
      this.drawBackgroundTint();
    }

    if (this.isActive) {
      this.drawScreenFlash();
      this.drawLightningBolts();
    }
  }

  drawBackgroundTint() {
    fill(50, 50, 100, this.alpha * 0.4);
    rect(0, 0, worldWidth, height);
  }

  drawScreenFlash() {
    if (this.flashAlpha > 0) {
      fill(255, 255, 255, this.flashAlpha);
      rect(0, 0, worldWidth, height);
    }
  }

  drawLightningBolts() {
    push();
    // Additive blending for glow layering
    blendMode(ADD);
    strokeJoin(ROUND);
    strokeCap(ROUND);

    for (let bolt of this.lightningBolts) {
      const lifeT = bolt.life / bolt.maxLife;
      const pulse = (sin(frameCount * 0.5 + bolt.pulsePhase) * 0.5 + 0.5) * 0.4 + 0.6; // 0.6 - 1.0
      const coreAlpha = 255 * lifeT;
      const glowAlpha = 120 * lifeT * pulse;

      // Translucent tapered ribbon fill (before strokes) to bring back earlier look without harsh polygon
      this.drawBoltRibbon(bolt.points, glowAlpha * 0.22, bolt.thickness, pulse);

      // Outer glow pass
      stroke(180, 200, 255, glowAlpha * 0.35);
      strokeWeight(bolt.thickness * 4.5);
      this.drawBoltPolyline(bolt.points);
      bolt.branches.forEach(br => {
        const t = br.life / br.maxLife;
        stroke(170, 200, 255, glowAlpha * 0.25 * t);
        strokeWeight(bolt.thickness * 2.8);
        this.drawBoltPolyline(br.points);
      });

      // Middle glow
      stroke(200, 230, 255, glowAlpha * 0.6);
      strokeWeight(bolt.thickness * 2.2);
      this.drawBoltPolyline(bolt.points);
      bolt.branches.forEach(br => {
        const t = br.life / br.maxLife;
        stroke(200, 230, 255, glowAlpha * 0.5 * t);
        strokeWeight(bolt.thickness * 1.4);
        this.drawBoltPolyline(br.points);
      });

      // Core
      stroke(255, 255, 255, coreAlpha);
      strokeWeight(bolt.thickness);
      this.drawBoltPolyline(bolt.points);
      bolt.branches.forEach(br => {
        const t = br.life / br.maxLife;
        stroke(255, 255, 255, coreAlpha * 0.7 * t);
        strokeWeight(bolt.thickness * 0.6);
        this.drawBoltPolyline(br.points);
      });
    }

    // Sparks (after main bolts to merge glow nicely)
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      const t = s.life / s.maxLife;
      push();
      colorMode(HSB, 360, 255, 255, 255);
      fill(s.hue, 200, 255, 255 * t);
      noStroke();
      ellipse(s.pos.x, s.pos.y, 3 + (1 - t) * 3);
      pop();
      s.pos.add(s.vel);
      s.vel.mult(0.95);
      s.life--;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    blendMode(BLEND);
    pop();

    // Draw scorch marks (below additive layer, simple dark ellipses)
    push();
    noStroke();
    for (let i = this.scorchMarks.length - 1; i >= 0; i--) {
      const m = this.scorchMarks[i];
      fill(50, 50, 60, m.alpha);
      ellipse(m.x, m.y, m.size, m.size * 0.5);
      m.alpha -= 2;
      if (m.alpha <= 0) this.scorchMarks.splice(i, 1);
    }
    pop();
  }

  drawBoltPolyline(points) {
    // Draw as individual line segments (no fill) to avoid accidental polygon fills
    noFill();
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      // jitter only applied to interior points when computing their displayed position
      const jxA = (i > 0 && i < points.length - 1) ? this._jitter(a.x, a.y).x : a.x;
      const jyA = (i > 0 && i < points.length - 1) ? this._jitter(a.x, a.y).y : a.y;
      const jxB = (i + 1 > 0 && i + 1 < points.length - 1) ? this._jitter(b.x, b.y).x : b.x;
      const jyB = (i + 1 > 0 && i + 1 < points.length - 1) ? this._jitter(b.x, b.y).y : b.y;
      line(jxA, jyA, jxB, jyB);
    }
  }

  _jitter(x, y) {
    const n = noise(x * 0.02, y * 0.02, frameCount * 0.1);
    const angle = n * TWO_PI;
    const mag = 0.6;
    return createVector(x + cos(angle) * mag, y + sin(angle) * mag);
  }

  drawBoltRibbon(points, alpha, baseThickness, pulse) {
    if (points.length < 2) return;
    // Draw a tapered quad strip using two offset polylines; no closing back to start
    noStroke();
    const maxWidth = baseThickness * 3.2 * pulse;
    beginShape(TRIANGLE_STRIP);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      // Normalized position along bolt
      const t = i / (points.length - 1);
      // Taper: wider near middle, narrower at ends (bell curve)
      const bell = sin(t * PI); // 0 -> 1 -> 0
      const width = maxWidth * bell;
      // Direction vector (forward)
      let dir;
      if (i === points.length - 1) {
        dir = p5.Vector.sub(points[i], points[i - 1]);
      } else {
        dir = p5.Vector.sub(points[i + 1], points[i]);
      }
      dir.normalize();
      // Perp
      const perp = createVector(-dir.y, dir.x).mult(width * 0.5);
      // Mild jitter so sides are organic
      const jitter = this._jitter(p.x, p.y);
      const jx = jitter.x - p.x;
      const jy = jitter.y - p.y;
      // Color shift slightly by t for subtle gradient
      const edgeAlpha = alpha * (0.6 + 0.4 * bell);
      fill(190 + 30 * (1 - bell), 210, 255, edgeAlpha); // HSB-like assumption; p5 in RGB so values approximate bluish tint
      vertex(p.x + perp.x + jx * 0.3, p.y + perp.y + jy * 0.3);
      vertex(p.x - perp.x + jx * 0.3, p.y - perp.y + jy * 0.3);
    }
    endShape();
  }

  disableThrust() {
    // Disable player ship thrust
    ship.isThrusting = false;
    // Light damping to prevent indefinite upward drift if already moving
    ship.vel.y *= 0.995;
    
    // Disable all wingmen thrust
    for (let wingman of Wingman.wingmen) {
      wingman.isThrusting = false;
      wingman.vel.y *= 0.995;
    }
    
    // Disable cruise missile thrust (if active)
    if (activeMissile && activeMissile.active) {
      activeMissile.fuel = max(0, activeMissile.fuel - 5); // Rapidly drain fuel
    }
  }

  deactivate() {
    this.isActive = false;
    this.lightningBolts = [];
    // Unlock engines when storm ends
    Ship.enginesLocked = false;
    announcer.speak("Lightning Storm has passed.", 0, 2);
  }

  isStormActive() {
    return this.isActive;
  }
}
