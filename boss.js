class AlienQueen extends Entity {
  constructor(pos, size) {
    super(pos, createVector(0, 0), size);
    this.maxHealth = 350; //350
    this.health = this.maxHealth;
    this.spawnCooldownTime = 250;
    this.movementSpeed = 1.5;
    this.baseColor = color(200, 0, 200);
    this.colorOffset = 0;
    this.direction = random() < 0.5 ? -1 : 1; // Random initial direction
    
    this.radius = size/2;
    this.corners = [];
    this.springs = [];
    this.friction = 0.99;
    this.rollingSensitivity = 0.01;
    
    this.hasDied = false;
    this.isAlive = false;
    this.isLeaving = false;
    this.burstDefenseRadius = 600;
    this.burstDefenseMaxCooldown = 300;
    this.burstDefenseForce = 8;
    this.burstDefenseAnimationFrames = 60;
    this.currentBurstFrame = 0;
    this.numCorners = 50;
    
    this.leavingSpeed = 1;
    this.appearDelay = 60000; // 1 min
    this.leaveDelay = 90000; // 1.5 minutes in milliseconds
    
    this.initializeShape();
  }

  initializeShape() {
    for (let i = 0; i < this.numCorners; i++) {
      let angle = map(i, 0, this.numCorners, 0, TWO_PI);
      let px = this.pos.x + cos(angle) * this.radius;
      let py = this.pos.y + sin(angle) * this.radius;
      this.corners.push(new Corner(px, py));
    }
    
    for (let i = 0; i < this.numCorners; i++) {
      let next = (i + 1) % this.numCorners;
      this.springs.push(new Spring(this.corners[i], this.corners[next], this.radius * sin(PI / this.numCorners)));
    }
    
    for (let i = 0; i < this.numCorners; i++) {
      let across = (i + this.numCorners/2) % this.numCorners;
      this.springs.push(new Spring(this.corners[i], this.corners[across], this.radius * 2, 0.1));
    }
  }

  update() {
    if (!this.isAlive) return;
    
    if (!GameTimer.exists('queenLeave')) {
    this.leavePlanet();
  }
    
    this.updateShape();
    this.updateColor();
    this.checkSpawnOpportunity();
    this.checkBurstDefense();
    this.checkLeaving();
  }

updateShape() {
  let totalForce = createVector(0, 0);
  
  let leftmostX = Infinity;
  let rightmostX = -Infinity;
  
  for (let corner of this.corners) {
    corner.applyForce(gravity);
    let windForce = wind.copy();
    windForce.mult(0.1);
    corner.applyForce(windForce);
    corner.update();
    
    let surfaceY = getSurfaceYAtX(corner.pos.x);
    if (corner.pos.y > surfaceY - 2) {
      corner.pos.y = surfaceY - 2;
      corner.vel.y *= -0.5;
      
      let nextX = corner.pos.x + this.direction;
      let nextY = getSurfaceYAtX(nextX);
      let surfaceAngle = atan2(nextY - surfaceY, this.direction);
      
      let rollForce = createVector(cos(surfaceAngle), sin(surfaceAngle));
      rollForce.mult(this.rollingSensitivity * (1 + random(-0.1, 0.1))); // Add small random factor
      totalForce.add(rollForce);
    }
    
    leftmostX = min(leftmostX, corner.pos.x);
    rightmostX = max(rightmostX, corner.pos.x);
  }
  
  // Gradually slow down as approaching edges
  let edgeProximity = min(leftmostX, worldWidth - rightmostX) / (this.size / 2);
  if (edgeProximity < 1) {
    totalForce.mult(edgeProximity);
  }
  
  // Handle world edges
  if (leftmostX <= 0 || rightmostX >= worldWidth) {
    this.direction *= -1; // Reverse direction
    // Move all corners away from the edge
    let adjustment = this.direction * this.size / 4; // Reduced adjustment for smoother transition
    for (let corner of this.corners) {
      corner.pos.x += adjustment;
    }
  }
  
  // Occasionally change direction
  if (random() < 0.001) { // 0.1% chance each frame to change direction
    this.direction *= -1;
  }
  
  this.vel.add(totalForce);
  this.vel.mult(this.friction);
  
  let movement = this.vel.copy();
  for (let corner of this.corners) {
    corner.pos.add(movement);
  }
  
  for (let spring of this.springs) {
    spring.update();
  }
  
  let avgPos = createVector(0, 0);
  for (let corner of this.corners) {
    avgPos.add(corner.pos);
  }
  avgPos.div(this.corners.length);
  this.pos = avgPos;
}

  updateColor() {
    this.colorOffset += 0.01;
  }

  checkSpawnOpportunity() {
    if (!GameTimer.exists('queenSpawn')) {
      this.spawnMinion();
      GameTimer.create('queenSpawn', () => {}, this.spawnCooldownTime);
    }
  }

  spawnMinion() {
    let spawnX = this.pos.x + random(-300, 300);
    let size = 100;
    let spawnY = getSurfaceYAtX(spawnX) - size / 2;
    let spawnPos = createVector(spawnX, spawnY);
    
    AlienPlant.plants.push(new AlienPlant(spawnPos, size, this.getColor()));
  }

  checkBurstDefense() {
    if (this.currentBurstFrame > 0) {
      this.currentBurstFrame--;
    } else if (!GameTimer.exists('queenBurstDefense')) {
      let distToPlayer = this.getDistanceToPlayer();
      if (distToPlayer < this.burstDefenseRadius) {
        this.activateBurstDefense();
      }
    }
  }

  activateBurstDefense() {
    GameTimer.create('queenBurstDefense', () => {}, this.burstDefenseMaxCooldown);

    this.currentBurstFrame = this.burstDefenseAnimationFrames;
        
    let playerPos = isWalking ? astronaut.pos : ship.pos;
    let awayVector = p5.Vector.sub(playerPos, this.pos).normalize().mult(this.burstDefenseForce);
    
    if (isWalking) {
      astronaut.vel.add(awayVector);
    } else {
      ship.vel.add(awayVector);
    }
    
    soundManager.play('nestBurstDefense');
  }

  checkLeaving() {
    if (this.isLeaving) {
      this.pos.y -= this.leavingSpeed;
      for (let corner of this.corners) {
        corner.pos.y -= this.leavingSpeed;
      }
      if (this.pos.y + this.size < 0) {
        this.isAlive = false;
        this.isLeaving = false;
        announcer.speak("Our scanners have lost track of the Queen.",1, 2, 0);
      }
    }
  }

  getDistanceToPlayer() {
    let playerPos = isWalking ? astronaut.pos : ship.pos;
    return this.pos.dist(playerPos);
  }

  getColor() {
    let r = map(sin(this.colorOffset), -1, 1, 0, 255);
    let g = map(sin(this.colorOffset + PI / 3), -1, 1, 0, 100);
    let b = map(sin(this.colorOffset + (2 * PI) / 3), -1, 1, 100, 255);
    return color(r, g, b);
  }

  takeDamage(amount) {
    if (!this.isAlive) return;
    
    this.health -= amount;
    
    if (this.health <= 0) {
      this.die();
    }
  }
  
die() { 
  debug.log(`Queen died`);
  soundManager.play('queenDeath');
  
    GameTimer.clearTimer('queenLeave');
    GameTimer.clearTimer('queenEnter');
    GameTimer.clearTimer('queenAppear');
    GameTimer.clearTimer('queenSpawn');
    GameTimer.clearTimer('queenBurstDefense');

  // Loop to create explosions
  for (let i = 0; i < 10; i++) {
    const offsetX = random(-200, 200);
    const offsetY = random(-200, 200);
    const explosionPos = createVector(this.pos.x + offsetX, this.pos.y + offsetY);
    setTimeout(() => {
      // Create a new explosion at the randomized position
      explosions.push(new Explosion(explosionPos, this.size * 4, this.getColor(), color(200, 0, 200)));
    }, i * 300); //300 milisecond delay
  }
    
  money += 20000;
  this.pos = createVector(-1000, -1000); //move her out of the way
  this.isAlive = false;
  this.hasDied = true;
  announcer.speak("Congratulations Commander you have protected Earth for now! Unfortunately there is intelligence chatter about an Alien King",1, 2, 4000);
}


appearOnPlanet() {  
   
  if (this.isAlive || this.hasDied || GameTimer.exists('queenAppear')) return; // Exit if already alive, has Died or appearing
  console.log(`Queen appear on planet called - she is not alive, hasnt died and there is no queenAppear timer`);
  
  shootingStarFrequency = 0.02;
  announcer.speak("Commander, we have detected the Alien Queen. She will be entering the atmosphere soon.",1, 2,1000);
  
  GameTimer.create('queenAppear', () => {
    debug.log(`Queen appearing health: ${this.health}`);
    
    shootingStarFrequency = 0.0001;

    announcer.speak("The Alien Queen is here.",1, 2, 0);  
    
    this.enterPlanet();
  }, this.appearDelay);
}

  enterPlanet() {
    this.isAlive = true; // Set this to true when we want the queen to enter the screen
    this.leavePlanet(); // trigger the leaving timer
    
    console.log(`queenAppear timer has run out - Queen enter planet called`);
    GameTimer.create('queenEnter', () => {
      this.pos.y += 1;
      for (let corner of this.corners) {
        corner.pos.y += 1;
      }
      if (this.pos.y >= height / 2) {
        GameTimer.clearTimer('queenEnter');
      }
    }, 1000 / 60, true);
  }

  leavePlanet() {
    GameTimer.clearTimer('queenLeave');
    
    GameTimer.create('queenLeave', () => {
      if (this.isAlive) {
        this.isLeaving = true;
        announcer.speak("The Alien Queen is leaving the Planet.",1, 2, 0);
        debug.log(`Queen leaving health: ${this.health}`);
      }
    }, this.leaveDelay);
  }

  draw() {
    if (!this.isAlive) return;
    
    //these are special canvas effects
    drawingContext.save();
    drawingContext.shadowBlur = 100;
	drawingContext.shadowColor = color(0,255,0);

    
    fill(this.getColor());
    noStroke();
    beginShape();
    for (let corner of this.corners) {
      vertex(corner.pos.x, corner.pos.y);
    }
    endShape(CLOSE);
  
    this.drawHealthBar();

    if (this.currentBurstFrame > 0) {
      this.drawBurstDefense();
    }
    
    drawingContext.restore(); //
  }

  drawHealthBar() {
    push();
    translate(this.pos.x, this.pos.y);
    let healthBarWidth = 100;
    let healthBarHeight = 10;
    let healthBarX = -healthBarWidth / 2;
    let healthBarY = -this.size / 2 - healthBarHeight - 10;
    fill(255, 0, 0);
    rect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    fill(0, 255, 0);
    let healthWidth = (this.health / this.maxHealth) * healthBarWidth;
    rect(healthBarX, healthBarY, healthWidth, healthBarHeight);
    pop();
  }

  drawBurstDefense() {
    push();
    noFill();
    stroke(255, 100, 100, map(this.currentBurstFrame, this.burstDefenseAnimationFrames, 0, 255, 0));
    strokeWeight(3);
    ellipse(this.pos.x, this.pos.y, this.burstDefenseRadius * 2);
    pop();
  }

  reset() {
    this.health = this.maxHealth;
    this.isAlive = false;
    this.isLeaving = false;
    this.isDead = false;
    this.pos = createVector(random(width), -300);
    
    GameTimer.clearTimer('queenLeave');
    GameTimer.clearTimer('queenEnter');
    GameTimer.clearTimer('queenAppear');
    GameTimer.clearTimer('queenSpawn');
    GameTimer.clearTimer('queenBurstDefense');
  }

  static create() {
    let queenPos = createVector(random(worldWidth), -300);
    let queen = new AlienQueen(queenPos, 300);
    return queen;
  }
}

class Corner {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.mass = 3;
  }
  
  applyForce(force) {
    let f = p5.Vector.div(force, this.mass);
    this.acc.add(f);
  }
  
  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.vel.mult(0.99);
  }
}

class Spring {
  constructor(cornerA, cornerB, restLength, strength = 0.1) {
    this.cornerA = cornerA;
    this.cornerB = cornerB;
    this.restLength = restLength;
    this.strength = strength;
  }
  
  update() {
    let force = p5.Vector.sub(this.cornerB.pos, this.cornerA.pos);
    let currentLength = force.mag();
    let stretch = currentLength - this.restLength;
    
    force.normalize();
    force.mult(this.strength * stretch);
    
    this.cornerA.applyForce(force);
    force.mult(-1);
    this.cornerB.applyForce(force);
  }
}

class AlienKing extends AlienQueen {
  constructor(pos, size = 1000) {
    super(pos, size);
    this.maxHealth = 1000;
    this.health = this.maxHealth;
    this.spawnCooldownTime = 8000;
    this.burstDefenseRadius = 200;
    this.burstDefenseMaxCooldown = 240;
    this.burstDefenseForce = 10;
    
    this.appearDelay = 60000; // 1 minutes
    this.leaveDelay = 120000; // 2 minutes
    
    this.laserCooldown = 0;
    this.laserMaxCooldown = 300;
    this.laserDuration = 120;
    this.laserCurrentDuration = 0;
    this.laserTarget = null;
    this.shootingRange = 800;
    
    this.hasDied = false;
    this.teleportCooldown = 0;
    this.teleportMaxCooldown = 600;
    
    this.phase = 1;
    this.phaseColors = [
      color(150, 150, 0),  // Phase 1: HunterYellow
      color(200, 0, 150),  // Phase 2: Laser Redish
      color(0, 150, 150)   // Phase 3: Teleport Teal
    ];
    this.currentColor = this.phaseColors[0];
    this.targetColor = this.phaseColors[0];
    this.colorTransitionSpeed = 0.05;
    
    this.phaseChangeInterval = 1800; // 30 seconds at 60 FPS
    this.phaseChangeTimer = this.phaseChangeInterval;

    //console.log(`AlienKing constructed: pos=${pos}, size=${size}, health=${this.health}`);
  }

  update() {
    if (!this.isAlive) return;
    
    if (!GameTimer.exists('kingLeave')) {
    this.leavePlanet();
  }
    
    this.updateShape();
    this.checkSpawnOpportunity();
    this.checkBurstDefense();
    this.checkLeaving();
    this.updateColor();
    this.updatePhase();
    this.updateLaser();
    this.updateTeleport();
  }

  updateColor() {
    this.currentColor = lerpColor(this.currentColor, this.targetColor, this.colorTransitionSpeed);
  }

  updatePhase() {
    this.phaseChangeTimer--;
    if (this.phaseChangeTimer <= 0) {
      this.phase = (this.phase % 3) + 1;
      this.targetColor = this.phaseColors[this.phase - 1];
      this.phaseChangeTimer = this.phaseChangeInterval;
      console.log(`AlienKing phase changed to ${this.phase}`);
    }
  }

  updateLaser() {
    if (this.laserCooldown > 0) {
      this.laserCooldown--;
    } else if (this.laserCurrentDuration > 0) {
      this.laserCurrentDuration--;
      this.fireLaser();
    } else if (this.phase === 2 && random() < 0.02) {
      this.initiateLaserAttack();
    }
  }

  initiateLaserAttack() {
    this.laserTarget = this.findLaserTarget();
    if (this.laserTarget) {
      this.laserCurrentDuration = this.laserDuration;
      soundManager.play('laserKing');
    }
  }

fireLaser() {
  if (this.laserTarget) {
    if (this.laserTarget === ship) {
      energy -= 1; // Damage the ship's energy
    } else if (this.laserTarget.takeDamage) {
      this.laserTarget.takeDamage(1000);
    }
    // Add visual effect for the laser hit
    explosions.push(new Explosion(this.laserTarget.pos, 30, color(255, 0, 0), color(255, 100, 100)));
  }
}
  
  findLaserTarget() {
    let targets = [ship, ...MoonBase.moonBases, ...Wingman.wingmen, ...turrets, ...DrillRig.rigs];
    if (isWalking && !astronaut.isInShip) targets.push(astronaut);
  
    return targets.reduce((closest, current) => {
      if (!current || !current.pos) return closest;
      let d = p5.Vector.dist(this.pos, current.pos);
      if (d < this.shootingRange && (!closest || d < p5.Vector.dist(this.pos, closest.pos))) {
        return current;
      }
      return closest;
    }, null);
  }
  
  
    checkLeaving() {
    if (this.isLeaving) {
      this.pos.y -= this.leavingSpeed;
      for (let corner of this.corners) {
        corner.pos.y -= this.leavingSpeed;
      }
      if (this.pos.y + this.size < 0) {
        this.isAlive = false;
        this.isLeaving = false;
        announcer.speak("Our scanners have lost track of the King.",1, 2, 0);
      }
    }
  }

  updateTeleport() {
    if (this.teleportCooldown > 0) {
      this.teleportCooldown--;
    } else if (this.phase === 3 && random() < 0.005) {
      this.teleport();
    }
  }

  teleport() {   
    this.createTeleportEffect();
    
    let newPos;
    do {
      newPos = createVector(random(600,worldWidth-600), random(height / 2)); //the 600 is to stop it getting too close to the edge
    } while (this.pos.dist(newPos) < 500 || !this.isValidPosition(newPos));
    
    let displacement = p5.Vector.sub(newPos, this.pos);
    this.pos = newPos;
    
    for (let corner of this.corners) {
      corner.pos.add(displacement);
    }
    
    this.teleportCooldown = this.teleportMaxCooldown;
    soundManager.play('teleportKing');
    this.createTeleportEffect();
  }

  createTeleportEffect() {
    for (let i = 0; i < 40; i++) {
      let particlePos = p5.Vector.add(this.pos, p5.Vector.random2D().mult(this.size / 2));
      let particleVel = p5.Vector.random2D().mult(random(1, 5));
      Particle.create(particlePos, particleVel, random(5, 15), 60,this.currentColor);
    }
  }

  isValidPosition(pos) {
    return pos.y > 0 && pos.y < height && pos.x > 0 && pos.x < worldWidth;
  }

  spawnMinion() {
    let spawnX = this.pos.x + random(-300, 300);
    let size = 80;
    let spawnY = getSurfaceYAtX(spawnX) - size / 2;
    let spawnPos = createVector(spawnX, spawnY);
    
    
    if (this.phase === 1) {
        //console.log("Spawning Hunter");
        Hunter.hunters.push(new Hunter(spawnPos, createVector(0, 0), size));
    }
    
    if (this.phase === 2) {
              //console.log("Spawning Zapper");
        Zapper.zappers.push(new Zapper(spawnPos, createVector(0, 0), size));
    }
    
    if (this.phase === 3) {
        //console.log("Spawning Destroyer");
        Destroyer.destroyers.push(new Destroyer(spawnPos, createVector(0, 0), size));
      }
    
    }

  activateBurstDefense() {
    super.activateBurstDefense();
    
    if (this.phase >= 2) {
      this.createShockwaveEffect();
    }
    
    soundManager.play('nestBurstDefense');
  }

  createShockwaveEffect() {
    for (let i = 0; i < 36; i++) {
      let angle = i * TWO_PI / 36;
      let shockwavePos = p5.Vector.add(this.pos, p5.Vector.fromAngle(angle).mult(this.burstDefenseRadius));
      explosions.push(new Explosion(shockwavePos, 100, color(255, 0, 255), color(150, 0, 150)));
    }
  }

  checkBurstDefense() {
    if (this.currentBurstFrame > 0) {
      this.currentBurstFrame--;
    } else if (!GameTimer.exists('kingBurstDefense')) {
      let distToPlayer = this.getDistanceToPlayer();
      if (distToPlayer < this.burstDefenseRadius) {
        this.activateBurstDefense();
      }
    }
  }

  takeDamage(amount) {
    if (!this.isAlive) return;
    
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    }
  }

die() { 
  if (this.hasDied) return;
  
  console.log(`King died`);
  this.hasDied = true;
  soundManager.play('queenDeath');
  announcer.setEnabled(false);

  
  // Create an array to hold promises for each explosion sequence
  let explosionPromises = [];

  // King's death explosions
  for (let i = 0; i < 15; i++) {
    const offsetX = random(-300, 300);
    const offsetY = random(-300, 300);
    const explosionPos = createVector(this.pos.x + offsetX, this.pos.y + offsetY);
    
    let explosionPromise = new Promise((resolve) => {
      setTimeout(() => {
        explosions.push(new Explosion(explosionPos, this.size * 4, this.currentColor, color(150, 0, 150)));
        resolve();
      }, i * 200);
    });
    
    explosionPromises.push(explosionPromise);
  }

  
  
  // Destroy all aliens with explosions
  for (let alien of Alien.aliens) {
    let explosionPromise = new Promise((resolve) => {
      setTimeout(() => {
        explosions.push(new Explosion(alien.pos, alien.size * 2, color(0, 255, 0), color(0, 100, 0)));
        resolve();
      }, random(0, 2000));
    });
    explosionPromises.push(explosionPromise);
  }

  // Destroy all hunters with explosions
  for (let hunter of Hunter.hunters) {
    let explosionPromise = new Promise((resolve) => {
      setTimeout(() => {
        explosions.push(new Explosion(hunter.pos, hunter.size * 2, color(200, 255, 0), color(100, 255, 0)));
        resolve();
      }, random(0, 2000));
    });
    explosionPromises.push(explosionPromise);
  }

  // Destroy all zappers with explosions
  for (let zapper of Zapper.zappers) {
    let explosionPromise = new Promise((resolve) => {
      setTimeout(() => {
        explosions.push(new Explosion(zapper.pos, zapper.size * 2, color(255, 205, 255), color(235, 255, 100)));
        resolve();
      }, random(0, 2000));
    });
    explosionPromises.push(explosionPromise);
  }

  // Destroy all destroyers with explosions
  for (let destroyer of Destroyer.destroyers) {
    let explosionPromise = new Promise((resolve) => {
      setTimeout(() => {
        explosions.push(new Explosion(destroyer.pos, destroyer.size * 2, color(153, 255, 204), color(0, 255, 0)));
        resolve();
      }, random(0, 2000));
    });
    explosionPromises.push(explosionPromise);
  }

  // Destroy all nests with explosions
  for (let nest of Nest.nests) {
    let explosionPromise = new Promise((resolve) => {
      setTimeout(() => {
        explosions.push(new Explosion(nest.pos, nest.size * 2, nest.color, color(100, 100, 100)));
        resolve();
      }, random(0, 2000));
    });
    explosionPromises.push(explosionPromise);
  }

  // Destroy all alien worms with explosions
  for (let worm of AlienWorm.worms) {
    if (!worm.segments || worm.segments.length < 1) continue; 
    let explosionPromise = new Promise((resolve) => {
      setTimeout(() => {
        explosions.push(new Explosion(worm.segments[0].pos, worm.segments[0].size * 3, color(0, 255, 0), color(0, 100, 0)));
        resolve();
      }, random(0, 2000));
    });
    explosionPromises.push(explosionPromise);
  }

  // Destroy all alien plants with explosions
  for (let plant of AlienPlant.plants) {
    let explosionPromise = new Promise((resolve) => {
      setTimeout(() => {
        explosions.push(new Explosion(plant.pos, plant.currentSize * 2, plant.color, color(50, 50, 50)));
        resolve();
      }, random(0, 2000));
    });
    explosionPromises.push(explosionPromise);
  }

  // Wait for all explosions to complete
  Promise.all(explosionPromises).then(() => {
    // Clear all alien entities
    Alien.aliens = [];
    Hunter.hunters = [];
    Zapper.zappers = [];
    Destroyer.destroyers = [];
    Nest.nests = [];
    AlienWorm.worms = [];
    AlienPlant.plants = [];
    
    this.pos = createVector(-1000, -1000);
    this.isAlive = false;
    
    //soundManager.stopAll();
    ambientMusic.newLevel();

    // Add a delay before victory state - with single announcement
    setTimeout(() => {   
      debug.log("Victory");
      GameTimer.clearAllTimers();
      gameState = 'victory';

    }, 15000); // 15 second delay
  });
}
  
appearOnPlanet() {  
  console.log(`King appear on planet called`);
  if (this.isAlive || GameTimer.exists('kingAppear')) return; // Exit if already alive or appearing
  
  shootingStarFrequency = 0.02;
  announcer.speak("Commander, the Alien King is approaching Neptune!",1, 2, 1000);
  
  
  
  GameTimer.create('kingAppear', () => {
    console.log(`King appearing health: ${this.health}`);
    
    shootingStarFrequency = 0.0001;

    announcer.speak("The Alien King is here.",1, 2, 0); 
    soundManager.play('enterKing');
    
    console.log(`just before calling King enterplanet`);
    this.enterPlanet();
  }, this.appearDelay);
}

enterPlanet() {

  console.log(`King enter planet called`);
  this.isAlive = true; // Set this to true when the kings is actually there
  this.leavePlanet(); // starts the exit timer
  
  GameTimer.create('kingEnter', () => {  
    this.pos.y += 1;
    for (let corner of this.corners) {
      corner.pos.y += 1;
    }
    if (this.pos.y >= height / 2) {
      GameTimer.clearTimer('kingEnter');
    }
  }, 1000 / 60);
}
  
  

leavePlanet() {
    GameTimer.clearTimer('kingLeave');
  
    GameTimer.create('kingLeave', () => {
      if (this.isAlive) {
        this.isLeaving = true;
        announcer.speak("The Alien King is leaving Neptune.", 1, 2, 0);
        //console.log(`King leaving health: ${this.health}`);
      }
    }, this.leaveDelay);
}

  draw() {
    if (!this.isAlive) return;
    
    push();
    drawingContext.save();
    drawingContext.shadowBlur = 100;
    drawingContext.shadowColor = this.currentColor;

    fill(this.currentColor);
    noStroke();
    beginShape();
    for (let corner of this.corners) {
      vertex(corner.pos.x, corner.pos.y);
    }
    endShape(CLOSE);
  
    this.drawHealthBar();

    if (this.currentBurstFrame > 0) {
      this.drawBurstDefense();
    }

 if (this.laserCurrentDuration > 0 && this.laserTarget && this.laserTarget.pos) {
  this.drawLaser();
}
    
    drawingContext.restore();
    pop();
  }

  drawHealthBar() {
    push();
    translate(this.pos.x, this.pos.y);
    let healthBarWidth = 200;
    let healthBarHeight = 15;
    let healthBarX = -healthBarWidth / 2;
    let healthBarY = -this.size / 2 - healthBarHeight - 20;
    fill(255, 0, 0);
    rect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    fill(0, 255, 0);
    let healthWidth = (this.health / this.maxHealth) * healthBarWidth;
    rect(healthBarX, healthBarY, healthWidth, healthBarHeight);
    pop();
  }

  drawLaser() {
    stroke(255, 0, 0, 200);
    strokeWeight(3);
    line(this.pos.x, this.pos.y, this.laserTarget.pos.x, this.laserTarget.pos.y);
  }

  reset() {
    super.reset();
    this.health = this.maxHealth;
    this.phase = 1;
    this.isDead = false;
    this.currentColor = this.phaseColors[0];
    this.targetColor = this.phaseColors[0];
    this.phaseChangeTimer = this.phaseChangeInterval;
    
    console.log(`AlienKing reset: health=${this.health}, pos=${this.pos}, phase=${this.phase}`);
  }


  static create() {
    let kingPos = createVector(random(600,worldWidth-600), -300);
    let king = new AlienKing(kingPos, 500);
    //console.log(`AlienKing created: pos=${kingPos}, size=500`);
    return king;
  }
}
