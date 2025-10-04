class AlienPlant extends Entity {
  static plants = [];
  static maxPlants = 70;
  static clusterCenters = [];
  static maxClusters = 10;
  static spawnInterval = 5000; // ms
  static lastSpawnTime = 0;
  static normalGrowthRate = [0.01, 0.03];
  static enhancedGrowthRate = [0.04, 0.08]; // faster growth during diamond rain

  constructor(pos, size, clusterColor) {
    super(pos, createVector(0, 0), size);
    this.maxSize = size;
    this.currentSize = 10;
    this.growthRate = random(AlienPlant.normalGrowthRate[0], AlienPlant.normalGrowthRate[1]);
    this.health = 100;
    this.decayRate = random(0.01, 0.03);
    this.color = this.generateColor(clusterColor);
    this.shape = this.generateShape();
    this.fullyGrown = false;
    this.isDecaying = false;
    this.decayChance = 0.0004; // 0.05% chance to start decaying each update
    this.targetPos = pos.copy();
  }

  generateColor(clusterColor) {
    if (!clusterColor) {
      return color(
        random(100, 255),
        random(100, 255),
        random(100, 255),
        random(200, 255)
      );
    }
    
    return color(
      constrain(red(clusterColor) + random(-70, 70), 100, 255),
      constrain(green(clusterColor) + random(-70, 70), 100, 255),
      constrain(blue(clusterColor) + random(-70, 70), 100, 255),
      random(200, 255)
    );
  }

  generateShape() {
    let points = [];
    let numPoints = floor(random(5, 15));
    for (let i = 0; i < numPoints; i++) {
      let angle = map(i, 0, numPoints, 0, TWO_PI);
      let r = this.maxSize * random(0.5, 1) * (1 + 0.3 * sin(angle * random(2, 5)));
      points.push(createVector(r * cos(angle), r * sin(angle)));
    }
    return points;
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(this.color);
    beginShape();
    for (let point of this.shape) {
      vertex(point.x * (this.currentSize / this.maxSize), point.y * (this.currentSize / this.maxSize));
    }
    endShape(CLOSE);
    pop();
  }

  updatePosition() {
  // Use cached terrain lookup for performance
  this.targetPos.y = getCachedSurfaceYAtX(this.pos.x) - this.currentSize / 2;
    // Smoothly interpolate towards the target position
    this.pos.y = lerp(this.pos.y, this.targetPos.y, 0.1);
  }

  update() {
    if (this.currentSize < this.maxSize) {
      this.currentSize += DiamondRain.isActive 
        ? random(AlienPlant.enhancedGrowthRate[0], AlienPlant.enhancedGrowthRate[1])
        : this.growthRate;
      if (!this.isDecaying && random() < this.decayChance) this.isDecaying = true;
      if (!this.fullyGrown && this.currentSize >= this.maxSize) {
        this.fullyGrown = true;
        this.createNest();
      }
    }
    
    
    if (this.isDecaying || this.currentSize >= this.maxSize) this.health -= this.decayRate;
    if (this.health <= 0) this.destroy();
    this.updatePosition();
  }

  createNest() {
    let nestPos = this.pos.copy();
  nestPos.y = getCachedSurfaceYAtX(nestPos.x) - 30; // Place nest on surface
    Nest.nests.push(new Nest(nestPos, 40, this.color)); // Pass the plant's color
    
    // Destroy the plant after creating a nest
    this.destroy();
  }

static isInCluster(pos) {
  for (let center of AlienPlant.clusterCenters) {
    if (pos.dist(createVector(center.x, center.y)) < 200) {
      return true;
    }
  }
  return false;
}

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  destroy() {
    let index = AlienPlant.plants.indexOf(this);
    if (index !== -1) {
      AlienPlant.plants.splice(index, 1);
    }
  }

  static update() {
    for (let plant of AlienPlant.plants) {
      plant.update();
    }

    // Spawn new plants
    let currentTime = millis();
    if (currentTime - AlienPlant.lastSpawnTime > AlienPlant.spawnInterval && AlienPlant.plants.length < AlienPlant.maxPlants) {
      AlienPlant.spawnNewPlant();
      AlienPlant.lastSpawnTime = currentTime;
    }
  }


  static spawnNewPlant() {
    if (AlienPlant.clusterCenters.length === 0 || random() < 0.1) {
      AlienPlant.createNewCluster();
    }

    let clusterCenter = random(AlienPlant.clusterCenters);
    let pos = createVector(
      clusterCenter.x + random(-100, 100),
      0
    );
    let size = random(40, 130);
  pos.y = getCachedSurfaceYAtX(pos.x) - size; // Position the bottom of the plant on the surface

    // Prefer lower areas
    let attempts = 0;
    while (attempts < 5 && pos.y < clusterCenter.y - size) {
      pos.x = clusterCenter.x + random(-100, 100);
  pos.y = getCachedSurfaceYAtX(pos.x) - size;
      attempts++;
    }

    AlienPlant.plants.push(new AlienPlant(pos, size, clusterCenter.color));
  }

  static createNewCluster() {
    if (AlienPlant.clusterCenters.length >= AlienPlant.maxClusters) return;

    let pos = createVector(random(worldWidth), 0);
  pos.y = getCachedSurfaceYAtX(pos.x);

    // Find a low point
    let attempts = 0;
    let lowestY = pos.y;
    let lowestPos = pos.copy();
    while (attempts < 10) {
      pos.x = random(worldWidth);
  pos.y = getCachedSurfaceYAtX(pos.x);
      if (pos.y > lowestY) {
        lowestY = pos.y;
        lowestPos = pos.copy();
      }
      attempts++;
    }

    // Generate a new random color for this cluster
    let clusterColor = color(
      random(100, 255),
      random(100, 255),
      random(100, 255),
      255
    );

    AlienPlant.clusterCenters.push({
      x: lowestPos.x,
      y: lowestPos.y,
      color: clusterColor
    });
  }

  static drawPlants() {
    for (let plant of AlienPlant.plants) {
      if (isInView(plant.pos, plant.currentSize)) {
        plant.draw();
      }
    }
  }

  static checkCollisionWithAstronaut(astronaut) {
    for (let plant of AlienPlant.plants) {
      if (plant.pos.dist(astronaut.pos) < plant.currentSize / 2 + astronaut.size / 2) {
        return true;
      }
    }
    return false;
  }

  static checkCollisionWithBullet(bullet) {
    for (let i = AlienPlant.plants.length - 1; i >= 0; i--) {
      let plant = AlienPlant.plants[i];
      if (plant.pos.dist(bullet.pos) < plant.currentSize / 2 + bullet.size / 2) {
        if (plant.takeDamage(10)) {
          AlienPlant.destroyPlant(i);
        }
        return true;
      }
    }
    return false;
  }

  static checkCollisionWithBomb(bomb) {
    for (let i = AlienPlant.plants.length - 1; i >= 0; i--) {
      let plant = AlienPlant.plants[i];
      if (plant.pos.dist(bomb.pos) < bomb.explosionRadius + plant.currentSize / 2) {
        AlienPlant.destroyPlant(i);
      }
    }
  }

  static checkCollisionWithWorm(worm) {
    for (let i = AlienPlant.plants.length - 1; i >= 0; i--) {
      let plant = AlienPlant.plants[i];
      if (plant.pos.dist(worm.segments[0].pos) < worm.segments[0].size / 2 + plant.currentSize / 2) {
        if (plant.takeDamage(1)) {
          AlienPlant.destroyPlant(i);
        }
      }
    }
  }

  static destroyPlant(index) {
    let plant = AlienPlant.plants[index];
    explosions.push(new Explosion(plant.pos, plant.currentSize, plant.color, color(50, 50, 50)));
    AlienPlant.plants.splice(index, 1);
  }
}

class Nest extends Entity {
  static nests = [];

  constructor(pos, size, colory) {
    super(pos, createVector(0, 0), size);
    this.health = 5;
    this.shootCooldown = 0;
    this.podsCollected = 0;
    this.blobPoints = this.generateBlobPoints();
    this.maxShootCooldown = 60;
    this.bulletVelocity = 6;
    this.bulletSize = 8;
    this.wormSpawnChance = 0.001;
    this.color = colory || color(0, 255, 0); // Use passed color or default
    this.color.setAlpha(255);

    // Burst defense properties
    this.burstDefenseRadius = 200;
    this.burstDefenseCooldown = 0;
    this.burstDefenseMaxCooldown = 300; // 5 seconds at 60 fps
    this.burstDefenseForce = 3;
    this.burstDefenseAnimationFrames = 30;
    this.currentBurstFrame = 0;
  }

  generateBlobPoints() {
    let points = [];
    let numPoints = floor(random(5, 8));
    for (let i = 0; i < numPoints; i++) {
      let angle = map(i, 0, numPoints, 0, TWO_PI);
      let r = this.size / 2 * random(0.8, 1.2);
      let x = r * cos(angle);
      let y = r * sin(angle);
      points.push(createVector(x, y));
    }
    return points;
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y + 10);
    fill(this.color);

    // Draw the blobby shape
    beginShape();
    for (let i = 0; i < this.blobPoints.length; i++) {
      let p = this.blobPoints[i];
      curveVertex(p.x, p.y);
    }
    // Add the first two points again to close the shape smoothly
    curveVertex(this.blobPoints[0].x, this.blobPoints[0].y);
    curveVertex(this.blobPoints[1].x, this.blobPoints[1].y);
    endShape(CLOSE);

    // Draw health bar
    //noStroke();
    fill(0, 255, 0);
    rect(-this.size / 2, -this.size / 2 - 10, this.size * (this.health / 5), 5);

    pop();

    // Draw burst defense animation
    if (this.currentBurstFrame > 0) {
      let progress = this.currentBurstFrame / this.burstDefenseAnimationFrames;
      let radius = this.burstDefenseRadius * (1 - progress);
      noFill();
      stroke(255, 100, 100, 255 * progress);
      strokeWeight(3 * progress);
      ellipse(this.pos.x, this.pos.y, radius * 2);
      noStroke();
    }
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

  let distToPlayer = dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y);
  let distToAstronaut = isWalking && !astronaut.isInShip ? dist(this.pos.x, this.pos.y, astronaut.pos.x, astronaut.pos.y) : Infinity;
  
  if (distToPlayer < 500 || distToAstronaut < 500) {
    this.shoot();
    this.spawnWorm();
  }

    // Check for burst defense activation
    if (distToPlayer < this.burstDefenseRadius && this.burstDefenseCooldown <= 0) {
      this.activateBurstDefense();
    }
  }

  activateBurstDefense() {
    this.burstDefenseCooldown = this.burstDefenseMaxCooldown;
    this.currentBurstFrame = this.burstDefenseAnimationFrames;
    
    let awayVector = p5.Vector.sub(ship.pos, this.pos).normalize().mult(this.burstDefenseForce);
    ship.vel.add(awayVector);
    
    soundManager.play('nestBurstDefense');
  }

  spawnWorm() {
    if (random() < this.wormSpawnChance) {
      AlienWorm.spawnWorm(this,this.colour);
    }
  }

shoot() {
  if (this.shootCooldown <= 0) {
    let target;
    if (isWalking && !astronaut.isInShip && dist(this.pos.x, this.pos.y, astronaut.pos.x, astronaut.pos.y) < 500) {
      target = astronaut;
    } else {
      target = ship;
    }
    
    let bulletVel = p5.Vector.sub(target.pos, this.pos).normalize().mult(this.bulletVelocity);
    Bullet.addBullet(this.pos.copy(), bulletVel, this.bulletSize, false);
    this.shootCooldown = random(90, this.maxShootCooldown);
  }
}

  static updateNests() {
    for (let i = Nest.nests.length - 1; i >= 0; i--) {
      let nest = Nest.nests[i];
      nest.update();
      
      if (nest.health <= 0) {
        soundManager.play('nestDestruction');
        Nest.nests.splice(i, 1);
        money += 300;
      }
    }
  }

static createNests(count) {
  const minDistanceFromPlayer = 1000; // Minimum distance for the first nest
  let playerX = isWalking ? astronaut.pos.x : ship.pos.x;

  for (let i = 0; i < count; i++) {
    let nestPos;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      nestPos = createVector(random(worldWidth), 0);
  nestPos.y = getCachedSurfaceYAtX(nestPos.x) - 30; // Place nest on surface
      attempts++;

      // Only check distance for the first nest
      if (i === 0 && attempts < maxAttempts) {
        let distanceOk = abs(nestPos.x - playerX) >= minDistanceFromPlayer;
        let otherNestsOk = Nest.nests.every(nest => 
          dist(nestPos.x, nestPos.y, nest.pos.x, nest.pos.y) >= 200
        );
        if (distanceOk && otherNestsOk) break;
      } else if (attempts >= maxAttempts || i > 0) {
        // For subsequent nests or if max attempts reached, use original logic
        if (Nest.nests.every(nest => 
          dist(nestPos.x, nestPos.y, nest.pos.x, nest.pos.y) >= 200
        )) break;
      }
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      debug.log(`Couldn't find a suitable position for nest ${i + 1} after maximum attempts.`);
    }

    Nest.nests.push(new Nest(nestPos, 40));
  }

  if (debug) {
    debug.log(`Created ${count} nests. Total nests: ${Nest.nests.length}`);
    Nest.nests.forEach((nest, index) => {
      debug.log(`Nest ${index + 1} position: x=${nest.pos.x.toFixed(0)}, y=${nest.pos.y.toFixed(0)}`);
    });
  }
}


  static drawNests() {
    for (let nest of Nest.nests) {
      if (isInView(nest.pos, nest.size)) {
        nest.draw();
      }
    }
  }
}

class Alien extends Entity {
  static totalAliens = 0;
  static MAX_ALIENS = 100;
  static aliens = [];
  static defaultAttackFrequency = 8200;
  static lastAttackAnnouncementTime = 0;
  static ATTACK_ANNOUNCEMENT_COOLDOWN = 3600;
  static defaultDefensiveFrequency = 12000;
  static lastDefensiveAnnouncementTime = 0;
  static DEFENSIVE_ANNOUNCEMENT_COOLDOWN = 3600;

  constructor(pos, vel, size, shootingRange = 300, colory) {
    super(pos, vel, size);
    this.id = Alien.totalAliens++;
    this.uniqueId = `alien-${this.id}`;
    this.shootCooldown = 0;
    this.hasGrabbedPod = false;
    this.health = 1 + level;
    this.randomTarget = null;
    this.shootingRange = shootingRange;
    this.speed = random(1.5, 2.5);
    this.color = colory || color(0, 255, 0);

    // Dodge and prediction based on level
    this.dodgeChance = constrain(0.0 + (level - 1) * 0.01, 0, 0.3);
    this.predictionFactor = constrain(0 + (level - 1) * 0.01, 0, 0.5);

    this.attackMode = false;
    this.attackDuration = 0;
    this.lastDodgeTime = 0;
    this.dodgeCooldown = 60;

    // Defensive behavior properties
    this.defensiveMode = false;
    this.defensiveDuration = 0;
    this.assignedNest = null;
    this.defensiveOrbitAngle = random(TWO_PI);
    this.defensiveOrbitRadius = random(80, 150);

    // Freeze burst slow effect tracking
    this.isFrozen = false; // Represents an active slow debuff
    this.freezeTimer = 0;
    this.slowMovementFactor = 1;
    this.slowFireRecoveryFactor = 1;
    this.baseShootCooldownRecovery = 1;
  }

  freeze(duration) {
    this.isFrozen = true;
    this.freezeTimer = Math.max(this.freezeTimer, duration);
    this.slowMovementFactor = 0.45;
    this.slowFireRecoveryFactor = 0.5;
  }

  update() {
    const moveFactor = this.preUpdateMovement();

    super.update();
    this.vel.mult(0.98);
    this.pos.y = constrain(this.pos.y, 0, height);

    if (this.attackMode) {
      if (--this.attackDuration <= 0) {
        this.attackMode = false;
      }
    }

    if (this.defensiveMode) {
      if (--this.defensiveDuration <= 0) {
        this.defensiveMode = false;
        this.assignedNest = null;
      }
    }

    if (!this.dodgeBullets(moveFactor)) {
      this.updateBehavior();
    }

    if (this.health > 0) {
      this.checkInteractions();
    }
  }

  getStateString() {
    if (this.attackMode) return "Attacking";
    if (this.defensiveMode) return "Defending Nest";
    if (this.hasGrabbedPod) return "Carrying Pod";
    if (this.isClosestToPod()) return "Pursuing Pod";
    return "Roaming";
  }

  updateBehavior() {
    const moveFactor = this.getMovementSlowFactor();
    const targetPos = this.determineTargetPosition();
    if (!targetPos) return;

    let direction = p5.Vector.sub(targetPos, this.pos).normalize();

    if (this.attackMode) {
      const distanceToTarget = this.pos.dist(targetPos);
      const desiredDistance = random(150, 220);
      const speedFactor = 0.5 * this.speed * moveFactor;

      if (distanceToTarget > desiredDistance + 50) {
        direction.mult(speedFactor);
      } else if (distanceToTarget < desiredDistance - 50) {
        direction.mult(-speedFactor);
      } else {
        direction.rotate(HALF_PI).mult(speedFactor);
      }
    } else if (this.defensiveMode) {
      // Defensive behavior: orbit around assigned nest
      const distanceToNest = this.pos.dist(targetPos);
      const speedFactor = 0.4 * this.speed * moveFactor;

      if (distanceToNest > this.defensiveOrbitRadius + 30) {
        // Too far, move closer
        direction.mult(speedFactor);
      } else if (distanceToNest < this.defensiveOrbitRadius - 30) {
        // Too close, move away
        direction.mult(-speedFactor);
      } else {
        // Orbit around the nest
        this.defensiveOrbitAngle += 0.02;
        direction.rotate(HALF_PI).mult(speedFactor);
      }
    } else {
      direction.mult(0.5 * this.speed * moveFactor);
    }

    this.vel.add(direction).limit((this.speed + 3 * Math.tanh(0.2 * (level - 1))) * moveFactor);
  }

  preUpdateMovement() {
    this.updateFreezeState();
    const moveFactor = this.getMovementSlowFactor();
    if (moveFactor < 1) {
      this.vel.mult(moveFactor);
    }
    return moveFactor;
  }

  updateFreezeState() {
    if (!this.isFrozen) {
      return;
    }
    this.freezeTimer--;
    if (this.freezeTimer <= 0) {
      this.resetSlow();
    }
  }

  resetSlow() {
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.slowMovementFactor = 1;
    this.slowFireRecoveryFactor = 1;
  }

  getMovementSlowFactor() {
    return this.slowMovementFactor;
  }

  getShootCooldownRecovery() {
    return this.baseShootCooldownRecovery * this.slowFireRecoveryFactor;
  }

  updateShootCooldown() {
    const recovery = this.getShootCooldownRecovery();
    if (recovery <= 0) {
      return;
    }
    this.shootCooldown = Math.max(0, this.shootCooldown - recovery);
  }

  dodgeBullets(moveFactor = 1) {
    const currentTime = frameCount;
    if (currentTime - this.lastDodgeTime < this.dodgeCooldown) {
      return false;
    }

    // Throttle expensive bullet checking to every 3rd frame for better performance
    if (frameCount % 3 !== 0) {
      return false;
    }

    for (const bullet of Bullet.activeObjects) {
      if (bullet.isPlayerBullet && this.pos.dist(bullet.pos) < 100 && random() < this.dodgeChance) {
        const timeToImpact = this.pos.dist(bullet.pos) / bullet.vel.mag();
        const futurePos = p5.Vector.add(bullet.pos, p5.Vector.mult(bullet.vel, timeToImpact));
        this.vel.add(p5.Vector.sub(this.pos, futurePos).normalize().mult(3 * moveFactor)).limit(this.speed * 2 * moveFactor);
        this.lastDodgeTime = currentTime;
        return true;
      }
    }
    return false;
  }


  determineTargetPosition() {
    if (this.attackMode) {
      return (isWalking && astronaut) ? astronaut.pos : (ship ? ship.pos : null);
    }
    if (this.defensiveMode && this.assignedNest && this.assignedNest.pos) {
      // Calculate orbital position around the nest
      const nestPos = this.assignedNest.pos.copy();
      const orbitOffset = p5.Vector.fromAngle(this.defensiveOrbitAngle).mult(this.defensiveOrbitRadius);
      return nestPos.add(orbitOffset);
    }
    if (this.hasGrabbedPod) {
      return this.findNearestNest();
    }
    if (!pod.pickedUpByAlien) {
      if (this.isClosestToPod()) {
        return pod.pos ? pod.pos.copy() : null;
      }
    }
    return this.getRandomTarget();
  }


  shoot(target) {
    if (this.shootCooldown <= 0 && this.isAboveSurface() && target && target.pos) {
      const predictedPos = this.predictTargetPosition(target);
      const bulletVel = p5.Vector.sub(predictedPos, this.pos).normalize().mult(5);
      Bullet.addBullet(this.pos.copy(), bulletVel, 5, false);
      soundManager.play('alienShooting');
      this.shootCooldown = random(60, 120);
    }
  }

  predictTargetPosition(target) {
    if (!target || !target.pos) {
      return this.pos.copy();
    }
    const distance = this.pos.dist(target.pos);
    const timeToReach = distance / 5;
    return target.vel ? target.pos.copy().add(target.vel.copy().mult(timeToReach * this.predictionFactor)) : target.pos.copy();
  }

  isAboveSurface() {
  return this.pos.y < getCachedSurfaceYAtX(this.pos.x);
  }

  findNearestNest() {
    return Nest.nests.reduce((nearest, nest) => {
      if (nest && nest.pos) {
        const d = p5.Vector.dist(this.pos, nest.pos);
        return d < nearest.dist ? { nest, dist: d } : nearest;
      }
      return nearest;
    }, { nest: null, dist: Infinity }).nest?.pos?.copy();
  }

  getRandomTarget() {
    if (!this.randomTarget || p5.Vector.dist(this.pos, this.randomTarget) < 50) {
      this.randomTarget = createVector(random(worldWidth), random(height / 4, 3 * height / 4));
    }
    return this.randomTarget;
  }


  checkInteractions() {
    this.checkPodInteraction();
    this.checkNestInteraction();
    this.checkShootingOpportunity();
  }

  checkPodInteraction() {
    if (!pod || !pod.pos) {
      this.hasGrabbedPod && (this.hasGrabbedPod = false);
      return;
    }

    if (!this.hasGrabbedPod && !pod.isPickedUp() && this.pos.dist(pod.pos) < (this.size + pod.size) / 2) {
      this.hasGrabbedPod = true;
      pod.updatePickupState('alien');
      soundManager.play('alienPodPickup');
      pod.pos = this.pos.copy();
    } else if (this.hasGrabbedPod) {
      pod.pos = this.pos.copy();
    }
  }

  checkNestInteraction() {
    if (!this.hasGrabbedPod) return;

    for (const nest of Nest.nests) {
      if (!nest || !nest.pos) continue;

      if (this.pos.dist(nest.pos) < (this.size + nest.size) / 2) {
        this.hasGrabbedPod = false;
        soundManager.play('alienPodDropOff');
        nest.podsCollected++;


        if (nest.podsCollected % 3 === 0) {
          const aliensToSpawn = level * 2;
          Alien.createAliensAtNest(aliensToSpawn, nest);
          nest.podsCollected = 0;
        }

        placePodOnSurface();
        break;
      }
    }
  }


  checkShootingOpportunity() {
    if (this.shootCooldown <= 0 && this.isAboveSurface()) {
      const target = this.findNearestTarget();
      target && this.shoot(target);
    }
    this.updateShootCooldown();
  }


  findNearestTarget() {
    let nearestTarget = null;
    let nearestDistance = Infinity;

    const checkTarget = (target) => {
      if (target && target.pos) {
        const distance = this.pos.dist(target.pos);
        if (distance < this.shootingRange && distance < nearestDistance) {
          nearestTarget = target;
          nearestDistance = distance;
        }
      }
    };

    checkTarget(ship);

    for (const wingman of Wingman.wingmen) {
      wingman.isActive && checkTarget(wingman);
    }

    isWalking && !astronaut.isInShip && checkTarget(astronaut);

    // Check active player drone
    if (activeDrone && activeDrone.active) {
      checkTarget(activeDrone);
    }

    for (const base of MoonBase.moonBases) {
      if (base) {
        checkTarget(base);
        for (const balloon of base.balloons) {
          checkTarget(balloon);
        }
        // Check base's defense drone
        if (base.drone && base.drone.active) {
          checkTarget(base.drone);
        }
      }
    }

    for (const turret of turrets) {
      checkTarget(turret);
    }

    return nearestTarget;
  }



  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  isClosestToPod() {
    return Alien.getClosestAlienToPod() === this;
  }

  static calculateAttackInterval() {
    return Math.max(Alien.defaultAttackFrequency - level * 500, 1200);
  }

  static calculateDefensiveInterval() {
    return Math.max(Alien.defaultDefensiveFrequency - level * 600, 2000);
  }

  static updateAliens() {
    // Group attack trigger (unchanged cadence)
    if (frameCount % this.calculateAttackInterval() === 0) {
      this.organizeGroupAttack();
    }

    // Improved defensive trigger logic
    // Replace single-frame modulus window with elapsed-time + fallback probability + threat trigger.
    if (typeof Alien.lastDefensiveTriggerFrame === 'undefined') {
      Alien.lastDefensiveTriggerFrame = 0;
    }
    const defensiveInterval = this.calculateDefensiveInterval();
    const framesSinceDefense = frameCount - Alien.lastDefensiveTriggerFrame;

    let defenseTriggered = false;

    // Threat reactive trigger: if player (ship/astronaut) near any nest and enough cooldown passed.
    if (Nest.nests.length) {
      const playerEntity = (isWalking && astronaut) ? astronaut : ship;
      if (playerEntity && playerEntity.pos) {
        const THREAT_RADIUS = 260; // proximity that provokes defense early
        // Find the nest that is being threatened
        const threatenedNest = Nest.nests.find(n => n?.pos && n.pos.dist(playerEntity.pos) < THREAT_RADIUS);
        if (threatenedNest && framesSinceDefense > defensiveInterval * 0.35) {
          this.organizeDefensiveBehavior(threatenedNest);
          Alien.lastDefensiveTriggerFrame = frameCount;
          defenseTriggered = true;
          if (debug?.isEnabled) debug.log(`[DEFENSE] Threat trigger at frame ${frameCount} for nest at x=${threatenedNest.pos.x.toFixed(0)}`);
        }
      }
    }

    // Scheduled trigger (elapsed time >= interval)
    if (!defenseTriggered && Nest.nests.length && framesSinceDefense >= defensiveInterval) {
      this.organizeDefensiveBehavior();
      Alien.lastDefensiveTriggerFrame = frameCount;
      defenseTriggered = true;
      if (debug?.isEnabled) debug.log(`[DEFENSE] Interval trigger at frame ${frameCount}`);
    }

    // Fallback probabilistic trigger if we are midway to interval and nothing happened yet
    if (!defenseTriggered && Nest.nests.length && framesSinceDefense > defensiveInterval * 0.55) {
      // Probability scales up the closer we get to full interval (soft ramp)
      const progress = framesSinceDefense / defensiveInterval; // 0.55 .. 1+
      const baseProb = 0.0004; // baseline
      const scaledProb = baseProb * (1 + (progress - 0.55) * 2.5); // gentle ramp
      if (random() < scaledProb) {
        this.organizeDefensiveBehavior();
        Alien.lastDefensiveTriggerFrame = frameCount;
        defenseTriggered = true;
        if (debug?.isEnabled) debug.log(`[DEFENSE] Probabilistic trigger at frame ${frameCount} (p=${scaledProb.toFixed(5)})`);
      }
    }

    // Debug instrumentation for skipped cases every ~5 seconds
    if (debug?.isEnabled && frameCount % 300 === 0) {
      if (!Nest.nests.length) {
        debug.log('[DEFENSE] Skipped: no nests present');
      } else if (!defenseTriggered) {
        debug.log(`[DEFENSE] Waiting: ${framesSinceDefense}/${defensiveInterval}`);
      }
    }

    for (let i = Alien.aliens.length - 1; i >= 0; i--) {
      const alien = Alien.aliens[i];
      if (alien.update() || alien.health <= 0) {
        if (alien.hasGrabbedPod) {
          pod.carrierKilled(alien.pos.copy());
        }
        explosions.push(new Explosion(alien.pos, alien.size, color(100, 255, 0), color(0, 255, 0)));
        soundManager.play('alienDestruction');
        money += 100;
        Alien.aliens.splice(i, 1);
      }
    }
  }

  static getTotalAlienCount() {
    return Alien.aliens.length + Hunter.hunters.length + Zapper.zappers.length + Destroyer.destroyers.length;
  }

  static organizeGroupAttack() {
    const currentTime = millis();
    if (currentTime - this.lastAttackAnnouncementTime >= this.ATTACK_ANNOUNCEMENT_COOLDOWN) {
      announcer.speak(`Coordinated Attack.`, 0, 1, 0);
      this.lastAttackAnnouncementTime = currentTime;
    }

    const target = isWalking ? astronaut : ship;
    if (!target || !target.pos) return;

    const availableAliens = Alien.aliens.filter(alien => !alien.hasGrabbedPod && alien !== Alien.getClosestAlienToPod());

    for (const alien of availableAliens) {
      if (random() < 0.5) {
        alien.attackMode = true;
        alien.attackDuration = random(500, 1200);
      }
    }
  }

  static organizeDefensiveBehavior(targetNest = null) {
    // Only organize defensive behavior if there are nests to defend
    if (Nest.nests.length === 0) return;

    const currentTime = millis();
    if (currentTime - this.lastDefensiveAnnouncementTime >= this.DEFENSIVE_ANNOUNCEMENT_COOLDOWN) {
      announcer.speak(`Coordinated Defence.`, 0, 1, 0);
      this.lastDefensiveAnnouncementTime = currentTime;
    }

    let availableAliens = Alien.aliens.filter(alien => !alien.hasGrabbedPod && alien !== Alien.getClosestAlienToPod());

    // If a specific nest is threatened, only summon nearby aliens
    if (targetNest && targetNest.pos) {
      const SUMMON_RADIUS = 800; // Only summon aliens within this radius of the threatened nest
      availableAliens = availableAliens.filter(alien => {
        return alien.pos.dist(targetNest.pos) < SUMMON_RADIUS;
      });
      
      if (debug?.isEnabled) {
        debug.log(`[DEFENSE] Summoning ${availableAliens.length} nearby aliens to defend nest at x=${targetNest.pos.x.toFixed(0)}`);
      }
    }

    for (const alien of availableAliens) {
      if (random() < 0.4) { // 40% chance to adopt defensive behavior
        alien.defensiveMode = true;
        alien.defensiveDuration = random(600, 1500); // Longer duration for defensive behavior
        // Assign the target nest if specified, otherwise random nest
        alien.assignedNest = targetNest || Nest.nests[floor(random(Nest.nests.length))];
        // Randomize orbit parameters for variety
        alien.defensiveOrbitAngle = random(TWO_PI);
        alien.defensiveOrbitRadius = random(80, 150);
      }
    }
  }


  static getClosestAlienToPod() {
    if (!pod || !pod.pos) return null;

    return Alien.aliens.reduce((closest, alien) => {
      const distance = alien.pos.dist(pod.pos);
      return distance < closest.distance ? { alien, distance } : closest;
    }, { alien: null, distance: Infinity }).alien;
  }


  static createAliens(count, color) {
    const aliensToCreate = Math.min(count, Alien.MAX_ALIENS - Alien.aliens.length);
    for (let i = 0; i < aliensToCreate; i++) {
      let pos;
      do {
        pos = createVector(random(worldWidth), random(height / 2));
      } while (ship && ship.pos && p5.Vector.dist(pos, ship.pos) < 400);

      const vel = p5.Vector.random2D().mult(2 + (level - 1) * 0.5);
      Alien.aliens.push(new Alien(pos, vel, 30, 300, color));
    }
  }


  static createAliensAtNest(count, nest) {
    if (Alien.aliens.length < Alien.MAX_ALIENS) {
      for (let i = 0; i < count; i++) {
        const pos = nest.pos.copy().add(random(-50, 50), random(-50, 0));
        const vel = p5.Vector.random2D().mult(2 + (level - 1) * 0.5);
        Alien.aliens.push(new Alien(pos, vel, 30, 300, nest.color));
      }
    }
  }

  static drawAliens() {
    for (const alien of Alien.aliens) {
      isInView(alien.pos, alien.size) && alien.draw();
    }
  }

  draw() {
    fill(this.color);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
    if (this.hasGrabbedPod) {
      fill(255, 0, 0);
      ellipse(this.pos.x, this.pos.y - this.size / 2, pod.size / 2, pod.size / 2);
    }
  }
}

class Hunter extends Alien {
  static hunters = [];

  constructor(pos, vel, size = 44, shootingRange = 300) {
    super(pos, vel, size, shootingRange);
    this.uniqueId = `hunter-${this.id}`;
    this.health = 10 + level*2;
    this.circlingRadius = 300;
    this.circlingSpeed = 0.03;
    this.circlingAngle = random(TWO_PI);
    this.state = 'chase';
    this.pulsePhase = random(0,1);
    this.pulseSpeed = 0.05;
    this.maxPulseSize = 1.4;
    this.maxSpeed = 3;
  }

  freeze(duration) {
    super.freeze(duration);
  }

update() {
    const moveFactor = this.preUpdateMovement();

  this.updateTarget();
  let distanceToTarget = p5.Vector.dist(this.pos, this.target.pos);

  if (distanceToTarget > this.circlingRadius * 1.2) {
    this.state = 'chase';
    let direction = p5.Vector.sub(this.target.pos, this.pos).normalize().mult(0.7 * moveFactor);
    this.vel.add(direction).limit(this.maxSpeed * moveFactor);
  } else {
    this.state = 'circle';
    this.circlingAngle += this.circlingSpeed;
    
    let targetPos = p5.Vector.add(
      this.target.pos,
      p5.Vector.fromAngle(this.circlingAngle).mult(this.circlingRadius)
    );
    
    let direction = p5.Vector.sub(targetPos, this.pos).normalize().mult(0.7 * moveFactor);
    this.vel.add(direction).limit(this.maxSpeed * 0.8 * moveFactor);
  }

    this.pos.add(this.vel);
    this.pos.x = (this.pos.x + worldWidth) % worldWidth;
    this.pos.y = constrain(this.pos.y, 0, height);
    this.checkShootingOpportunity();
  }

updateTarget() {
  if (isWalking && !astronaut.isInShip) {
    this.target = astronaut;
  } else {
    this.target = ship;
  }
}

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
 
    let pulseSize = map(sin(this.pulsePhase), -1, 1, 1, this.maxPulseSize);
    let currentSize = this.size * pulseSize;  
    fill(200, 255, 0);
    ellipse(0, 0, currentSize, currentSize);

    pop();

    this.pulsePhase += this.pulseSpeed;
    if (this.pulsePhase > TWO_PI) {
      this.pulsePhase -= TWO_PI;
    }
  }

checkShootingOpportunity() {
  if (this.shootCooldown <= 0 && p5.Vector.dist(this.pos, this.target.pos) < this.shootingRange) {
    this.shoot(this.target);
  }
  this.updateShootCooldown();
}

  shoot(target) {
    if (this.shootCooldown <= 0 && this.isAboveSurface()) {
      let bulletVel = p5.Vector.sub(target.pos, this.pos).normalize().mult(5);
      Bullet.addBullet(this.pos.copy(), bulletVel, 8, false);
      soundManager.play('alienShooting');
      this.shootCooldown = random(60, 120);
    }
  }

  static spawnHunter() {
    let spawnPos = createVector(random(worldWidth), -50);
    let spawnVel = createVector(random(-1, 1), random(1, 2));
    let newHunter = new Hunter(spawnPos, spawnVel);
    Hunter.hunters.push(newHunter);
    soundManager.play('hunterSpawned');
    announcer.speak(`Hunter`,0, 0, 1000);
    debug.log(`Spawned ${newHunter.uniqueId} at position ${newHunter.pos.x.toFixed(0)}, ${newHunter.pos.y.toFixed(0)}`);
    return newHunter;
  }


static updateHunters() {
  for (let i = Hunter.hunters.length - 1; i >= 0; i--) {
    const hunter = Hunter.hunters[i];
    hunter.update();
    
    if (hunter.health <= 0) {
      explosions.push(new Explosion(hunter.pos, hunter.size, color(200, 255, 0), color(0, 255, 0)));
      money += 150;
      soundManager.play('alienDestruction');
      debug.log(`${hunter.uniqueId} destroyed`);
      Hunter.hunters.splice(i, 1);
    }
  }
}

  static drawHunters() {
    for (let hunter of Hunter.hunters) {
      if (isInView(hunter.pos, hunter.size)) {
        hunter.draw();
      }
    }
  }

  static reset() {
    Hunter.hunters = [];
  }
}

class Zapper extends Hunter {
  static zappers = [];

  constructor(pos, vel, size = 25, shootingRange = 100) {
    super(pos, vel, size, shootingRange);
    this.uniqueId = `zapper-${this.id}`;
    this.health = 10;
    this.color = color(255, 205, 255);
    this.zapCooldown = 0;
    this.maxZapCooldown = 600; // 10 seconds at 60 fps
    this.zapDuration = 360; // 6 seconds at 60 fps
    this.zapRadius = 200; // Radius of the forcefield
    this.isZapping = false;
    this.zapExplosionDuration = 50; // Duration of zap explosion effect
    this.zapExplosionTimer = 0;
    this.runAwaySpeed = 3; // Speed at which the Zapper runs away
  }


  freeze(duration) {
    super.freeze(duration);
  }

  update() {
    super.update();

    const moveFactor = this.getMovementSlowFactor();

    if (this.zapCooldown > 0) {
      this.zapCooldown--;
      // Run away from the ship
      let awayFromShip = p5.Vector.sub(this.pos, ship.pos).normalize().mult(this.runAwaySpeed * moveFactor);
      this.vel = awayFromShip;
    } else {
      // Move towards the ship when not on cooldown
      let direction = p5.Vector.sub(ship.pos, this.pos).normalize().mult(0.5 * moveFactor);
      this.vel.add(direction).limit(2 * moveFactor);

      // Check if close enough to zap
      if (p5.Vector.dist(this.pos, ship.pos) < this.zapRadius) {
        this.zap();
      }
    }

    if (this.zapExplosionTimer > 0) {
      this.zapExplosionTimer--;
    }

    // Ensure the Zapper stays within the game world
    this.pos.x = constrain(this.pos.x, 0, worldWidth);
    this.pos.y = constrain(this.pos.y, 0, height);
  }

  zap() {
    ship.applyZapEffect(this.zapDuration);
    this.zapCooldown = this.maxZapCooldown;
    this.isZapping = true;
    this.zapExplosionTimer = this.zapExplosionDuration;
    //soundManager.play('zapperZap'); // Assuming you'll add this sound
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    
    fill(this.color);
    ellipse(0, 0, this.size, this.size);

    // Draw zap explosion effect
    if (this.zapExplosionTimer > 0) {
      let explosionSize = map(this.zapExplosionTimer, this.zapExplosionDuration, 0, 0, this.zapRadius * 2);
      noFill();
      stroke(0, 255, 255, map(this.zapExplosionTimer, this.zapExplosionDuration, 0, 255, 0));
      strokeWeight(2);
      ellipse(0, 0, explosionSize);
    }  
    pop();
  }

  shoot() {} // Overwriting the default hunter shoot to do nothing

  static spawnZapper() {
    let spawnPos = createVector(random(worldWidth), -50);
    let spawnVel = createVector(random(-1, 1), random(1, 2));
    let newZapper = new Zapper(spawnPos, spawnVel);
    Zapper.zappers.push(newZapper);
    soundManager.play('zapperSpawned');
    announcer.speak(`Zapper`,0, 0, 1000);
    debug.log(`Spawned ${newZapper.uniqueId} at position ${newZapper.pos.x.toFixed(0)}, ${newZapper.pos.y.toFixed(0)}`);
    return newZapper;
  }

static updateZappers() {
  for (let i = Zapper.zappers.length - 1; i >= 0; i--) {
    const zapper = Zapper.zappers[i];
    zapper.update();
    
    if (zapper.health <= 0) {
      explosions.push(new Explosion(zapper.pos, zapper.size, color(235, 205, 255), color(235, 255, 100)));
      money += 200;
      soundManager.play('alienDestruction');
      debug.log(`${zapper.uniqueId} destroyed`);
      Zapper.zappers.splice(i, 1);
    }
  }
}

  static drawZappers() {
    for (let zapper of Zapper.zappers) {
      if (isInView(zapper.pos, zapper.size)) {
        zapper.draw();
      }
    }
  }

  static reset() {
    Zapper.zappers = [];
  }
}

class Destroyer extends Hunter {
  static destroyers = [];

  constructor(pos, vel, size = 30, shootingRange = 200) {
    super(pos, vel, size, shootingRange);
    this.uniqueId = `destroyer-${this.id}`;
    this.color = color(153, 255, 204);
    this.target = null;
    this.hoverHeight = 100; // Height to hover above targets
    this.maxSpeed = 2;
    this.acceleration = 0.1;
    this.health = 10; // Keeping original health
    
    // Inherit pulsing behavior from Hunter
    this.pulsePhase = 0;
    this.pulseSpeed = 0.1;
    this.maxPulseSize = 1.2;

    // New properties for shifting behavior
    this.shiftingDistance = 100; // Total distance to shift left and right
    this.shiftingSpeed = 1; // Speed of the shifting movement
    this.shiftPhase = 0; // Phase of the shifting motion
    this.isOverTarget = false; // Flag to check if destroyer is over the target
  }

    freeze(duration) {
    super.freeze(duration);
  }

  update() {
    const moveFactor = this.preUpdateMovement();
    this.updatePulse();
    this.updateMovement(moveFactor);
    this.checkShootingOpportunity();
  }

  updatePulse() {
    this.pulsePhase += this.pulseSpeed;
    if (this.pulsePhase > TWO_PI) {
      this.pulsePhase -= TWO_PI;
    }
  }

  updateMovement(moveFactor = 1) {
    if (!this.target || !this.isValidTarget(this.target)) {
      this.target = this.findNewTarget();
      this.isOverTarget = false;
    }

    if (this.target) {
      let targetPos = this.getTargetPosition();
      let direction = p5.Vector.sub(targetPos, this.pos);
      let distance = direction.mag();

      if (distance > 50) { // Not yet over target
        this.isOverTarget = false;
        direction.normalize();
        direction.mult(this.acceleration * moveFactor);
        this.vel.add(direction);
        this.vel.limit(this.maxSpeed * moveFactor);
        this.pos.add(this.vel);
      } else { // Over target, start shifting
        this.isOverTarget = true;
        this.vel.set(0, 0);
        this.pos.y = targetPos.y; // Maintain hover height

        // Smooth left-right movement using sine function
        this.shiftPhase += this.shiftingSpeed * 0.05 * moveFactor;
        let shiftX = sin(this.shiftPhase) * this.shiftingDistance / 2;
        this.pos.x = targetPos.x + shiftX;
      }
    }
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    
    let pulseSize = map(sin(this.pulsePhase), -1, 1, 1, this.maxPulseSize);
    let currentSize = this.size * pulseSize;
    
    fill(this.color);
    ellipse(0, 0, currentSize, currentSize);
    
    pop();
  }

  findNewTarget() {
    let possibleTargets = [...MoonBase.moonBases, ...turrets, ...Shield.shields, ...DrillRig.rigs];
    
    // Add active player drone
    if (activeDrone && activeDrone.active) {
      possibleTargets.push(activeDrone);
    }
    
    // Add base defense drones
    for (const base of MoonBase.moonBases) {
      if (base.drone && base.drone.active) {
        possibleTargets.push(base.drone);
      }
    }
    
    return possibleTargets.reduce((closest, current) => {
      let d = p5.Vector.dist(this.pos, current.pos);
      return d < closest.dist ? { target: current, dist: d } : closest;
    }, { target: null, dist: Infinity }).target;
  }

  isValidTarget(target) {
    return (target instanceof MoonBase && MoonBase.moonBases.includes(target)) ||
           (target instanceof Turret && turrets.includes(target)) ||
           (target instanceof Shield && Shield.shields.includes(target)) ||
           (target instanceof DrillRig && DrillRig.rigs.includes(target)) ||
           (target instanceof Drone && target.active);
  }

  getTargetPosition() {
    if (!this.target) return null;
    let targetCenter = this.getTargetCenter();
    return createVector(targetCenter.x, targetCenter.y - this.hoverHeight);
  }

  getTargetCenter() {
    if (this.target instanceof MoonBase) {
      return createVector(
        this.target.pos.x + this.target.width / 2,
        this.target.pos.y + this.target.height / 2
      );
    }
    return this.target.pos.copy();
  }

  checkShootingOpportunity() {
    if (this.target && this.shootCooldown <= 0 && this.isOverTarget) {
      this.shoot(this.target);
    }
    this.updateShootCooldown();
  }

  shoot(target) {
    let targetCenter = this.getTargetCenter();
    let bulletVel = p5.Vector.sub(targetCenter, this.pos).normalize().mult(5);
    Bullet.addBullet(this.pos.copy(), bulletVel, 5, false);
    soundManager.play('alienShooting');
    this.shootCooldown = random(60, 120); // Keeping original shooting rate
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  static spawnDestroyer() {
    let spawnPos = createVector(random(worldWidth), -50);
    let spawnVel = createVector(random(-1, 1), random(1, 2));
    let newDestroyer = new Destroyer(spawnPos, spawnVel);
    Destroyer.destroyers.push(newDestroyer);
    soundManager.play('destroyerSpawned');
    announcer.speak(`Destroyer`,0, 0, 1000);
    debug.log(`Spawned ${newDestroyer.uniqueId} at position ${newDestroyer.pos.x.toFixed(0)}, ${newDestroyer.pos.y.toFixed(0)}`);
    return newDestroyer;
  }

static updateDestroyers() {
  for (let i = Destroyer.destroyers.length - 1; i >= 0; i--) {
    const destroyer = Destroyer.destroyers[i];
    destroyer.update();
    
    if (destroyer.health <= 0) {
      explosions.push(new Explosion(destroyer.pos, destroyer.size, color(153, 255, 204), color(0, 255, 0)));
      money += 150;
      soundManager.play('alienDestruction');
      debug.log(`${destroyer.uniqueId} destroyed`);
      Destroyer.destroyers.splice(i, 1);
    }
  }
}

  static drawDestroyers() {
    for (let destroyer of Destroyer.destroyers) {
      if (isInView(destroyer.pos, destroyer.size)) {
        destroyer.draw();
      }
    }
  }

  static reset() {
    Destroyer.destroyers = [];
  }
}

class AlienWorm {
  static worms = [];
  static MAX_WORMS = 10;
  static spawnCooldown = 0;
  static SPAWN_COOLDOWN_TIME = 600; // 10 seconds at 60 fps

  constructor(pos, colory, initialDirection) {
    this.segments = [];
    for (let i = 0; i < 6; i++) {
      this.segments.push({
        pos: createVector(pos.x - i * 20, pos.y),
        size: i === 0 ? 30 : 25,  // Head segment is larger
        angle: 0,
        tentacles: []
      });
      
      // Add tentacles to each segment
      if (i === 0) {  // More tentacles for the head
        for (let j = 0; j < 6; j++) {
          this.segments[i].tentacles.push({
            length: random(10, 20),
            angle: j * TWO_PI / 6
          });
        }
      } else {
        for (let j = 0; j < 3; j++) {
          this.segments[i].tentacles.push({
            length: random(5, 15),
            angle: j * TWO_PI / 3
          });
        }
      }
    }
    this.speed = 0.5;
    this.health = 10;
    this.damageTimer = 0;
    this.direction = initialDirection; // 1 for right, -1 for left
    this.color = colory || color(random(100, 200), random(100, 200), random(100, 200));

    this.isFrozen = false;
    this.freezeTimer = 0;
    this.slowMovementFactor = 1;
  }



  update() {

    if (this.isFrozen) {
      this.freezeTimer--;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
        this.slowMovementFactor = 1;
        this.freezeTimer = 0;
      }
    }

    const speedFactor = this.isFrozen ? this.slowMovementFactor : 1;

    // Move the head
  let surfaceY = getCachedSurfaceYAtX(this.segments[0].pos.x + this.speed * this.direction * speedFactor);
    this.segments[0].pos.x += this.speed * this.direction * speedFactor;
    this.segments[0].pos.y = surfaceY - this.segments[0].size / 2;

    // Update the rest of the body
    for (let i = 1; i < this.segments.length; i++) {
      let dx = this.segments[i-1].pos.x - this.segments[i].pos.x;
      let dy = this.segments[i-1].pos.y - this.segments[i].pos.y;
      let distance = sqrt(dx*dx + dy*dy);
      if (distance > this.segments[i].size) {
        let angle = atan2(dy, dx);
  this.segments[i].pos.x += cos(angle) * (distance - this.segments[i].size) * speedFactor;
  this.segments[i].pos.y += sin(angle) * (distance - this.segments[i].size) * speedFactor;
      }
    }

    // Change direction if at world bounds
    if (this.segments[0].pos.x <= 0 || this.segments[0].pos.x >= worldWidth) {
      this.direction *= -1;
    }

    // Update segment angles
    for (let i = 0; i < this.segments.length; i++) {
      if (i === 0) {
  this.segments[i].angle = atan2(this.speed * this.direction * speedFactor, 0);
      } else {
        let dx = this.segments[i].pos.x - this.segments[i-1].pos.x;
        let dy = this.segments[i].pos.y - this.segments[i-1].pos.y;
        this.segments[i].angle = atan2(dy, dx);
      }
    }

    // Check for collisions
    this.checkCollisions();

    if (this.damageTimer > 0) {
      this.damageTimer--;
    }
  }

  freeze(duration) {
    this.isFrozen = true;
    this.freezeTimer = Math.max(this.freezeTimer, duration);
    this.slowMovementFactor = 0.4;
  }

  draw() {
    push();
    //noStroke();
    
    for (let i = 0; i < this.segments.length; i++) {
      let segment = this.segments[i];
      
      // Draw main body
      fill(this.color);
      ellipse(segment.pos.x, segment.pos.y, segment.size, segment.size * 0.8);
      
      // Draw tentacles
      for (let tentacle of segment.tentacles) {
        let tentacleAngle = segment.angle + tentacle.angle;
        let x1 = segment.pos.x + cos(tentacleAngle) * segment.size * 0.5;
        let y1 = segment.pos.y + sin(tentacleAngle) * segment.size * 0.5;
        let x2 = x1 + cos(tentacleAngle) * tentacle.length;
        let y2 = y1 + sin(tentacleAngle) * tentacle.length;
        
        stroke(this.color);
        strokeWeight(segment.size * 0.1);
        line(x1, y1, x2, y2);
        noStroke();
        ellipse(x2, y2, segment.size * 0.2); // Adjusted circle size
      }
    }
    
    pop();
  }

  checkCollisions() {
    // Check collision with bases
    for (let base of MoonBase.moonBases) {
      for (let segment of this.segments) {
        if (segment.pos.x > base.pos.x && 
            segment.pos.x < base.pos.x + base.width &&
            Math.abs(segment.pos.y - base.pos.y) < segment.size / 2) {
          base.health -= 1;
          break; // Only damage the base once per frame
        }
      }
    }

    // Check collision with ship
    if (ship.isLanded) {
        if (!isWalking && !astronaut.ridingWalker) {
      for (let segment of this.segments) {
        if (Math.abs(segment.pos.x - ship.pos.x) < segment.size / 2) {
          energy -= 800;
          break; // Only damage the ship once per frame
        }
      }
    }
    }

// Check collision with astronaut
if (isWalking && !astronaut.ridingWalker) {
  for (let segment of this.segments) {
    let dx = Math.abs(segment.pos.x - astronaut.pos.x);
    let dy = Math.abs(segment.pos.y - astronaut.pos.y);
    let combinedRadius = (segment.size + astronaut.size) / 2;
    
    if (dx < combinedRadius && dy < combinedRadius) {
      energy -= 800;
      break; // Only damage the astronaut once per frame
    }
  }
}
    
        // Check collision with stranded astronaut
    if (RescueMission.isActive) {
        for (let segment of this.segments) {
          if (RescueMission.strandedAstronaut) {
          if (Math.abs(segment.pos.x - RescueMission.strandedAstronaut.pos.x) < segment.size / 2) {
            RescueMission.strandedAstronaut.takeDamage(50);
            break;           
          }
        }
      }
    }


    // Check collision with pod
    if (!pod.isPickedUp()) {
      for (let segment of this.segments) {
        if (Math.abs(segment.pos.x - pod.pos.x) < segment.size / 2) {
          this.collectPod();
          break;
        }
      }
    }

    // Check collision with turrets
    for (let turret of turrets) {
      for (let segment of this.segments) {
        if (segment.pos.dist(turret.pos) < segment.size / 2 + turret.size / 2) {
          if (this.damageTimer <= 0) {
            turret.health -= 1;
            this.damageTimer = 30; // Set cooldown
          }
          break; // Only damage the turret once per frame
        }
      }
    }
  }

  collectPod() {
    this.grow();
    explosions.push(new Explosion(pod.pos, 30, color(255, 0, 0), color(100, 0, 0)));
    soundManager.play('wormDead');
    placePodOnSurface(); // Respawn the pod
  }

  grow() {
    this.health += this.health;
    // Increase the size of all segments
    for (let segment of this.segments) {
      segment.size += 10;
      // Increase tentacle length
      for (let tentacle of segment.tentacles) {
        tentacle.length += random(2, 5);
      }
    }
    
    // Add a new segment at the end
    let lastSegment = this.segments[this.segments.length - 1];
    let newSegment = {
      pos: createVector(lastSegment.pos.x, lastSegment.pos.y),
      size: 25,
      angle: 0,
      tentacles: []
    };
    // Add tentacles to the new segment
    for (let j = 0; j < 3; j++) {
      newSegment.tentacles.push({
        length: random(5, 15),
        angle: j * TWO_PI / 3
      });
    }
    this.segments.push(newSegment);
    
    // Increase health and speed
    this.health += 5;
    this.speed += 0.1;
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  static spawnWorm(nest) {
    if (AlienWorm.worms.length < AlienWorm.MAX_WORMS && AlienWorm.spawnCooldown <= 0) {
      let wormPos = nest.pos.copy();
  wormPos.y = getCachedSurfaceYAtX(wormPos.x) - 10;

      // Determine player position
      let playerPos;
      if (isWalking && !astronaut.isInShip) {
        playerPos = astronaut.pos.x;
      } else {
        playerPos = ship.pos.x;
      }

      // Determine initial direction towards the player
      let initialDirection = wormPos.x < playerPos ? 1 : -1;

      debug.log(`Spawning worm at (${wormPos.x.toFixed(0)}, ${wormPos.y.toFixed(0)}). Player at ${playerPos.toFixed(0)}. Initial direction: ${initialDirection}`);

      soundManager.play('wormDead');
      announcer.speak(`Worm detected.`, 0,0, 1000);
      AlienWorm.worms.push(new AlienWorm(wormPos, nest.color, initialDirection));
      AlienWorm.spawnCooldown = AlienWorm.SPAWN_COOLDOWN_TIME;
      return true;
    }
    return false;
  }

  static updateWorms() {
    if (AlienWorm.spawnCooldown > 0) {
      AlienWorm.spawnCooldown--;
    }

    for (let i = AlienWorm.worms.length - 1; i >= 0; i--) {
      AlienWorm.worms[i].update();
      if (AlienWorm.worms[i].health <= 0) {
        explosions.push(new Explosion(AlienWorm.worms[i].segments[0].pos, 40, color(0, 255, 0), color(0, 100, 0)));
        
        // Calculate reward based on worm's length
      let reward = AlienWorm.worms[i].segments.length * 150; // Example: 150 money per segment
      money += reward;

        soundManager.play('wormDead');
        AlienWorm.worms.splice(i, 1);
      }
    }
  }

  static drawWorms() {
    for (let worm of AlienWorm.worms) {
      if (isInView(worm.segments[0].pos, worm.segments[0].size * 6)) {
        worm.draw();
      }
    }
  }

  static resetWorms() {
    AlienWorm.worms = [];
    AlienWorm.spawnCooldown = 0;
  }
}