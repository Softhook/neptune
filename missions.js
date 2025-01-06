class AlienArtifactMission {
  static isActive = false;
  static missionDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
  static missionTimerKey = 'alienArtifactMission';
  static artifact = null;
  static missionStartTime = 0;

  static startMission() {
    if (this.isActive) return;

    this.isActive = true;
    this.missionStartTime = Date.now();

    announcer.speak(
      "Commander, a giant alien artifact has appeared. We think only bullets can harm it. Destroy quickly before something bad happens.",
      1,
      2,
      0
    );

    this.spawnArtifact();

    GameTimer.create(this.missionTimerKey, () => {
      this.completeMission(false);
    }, this.missionDuration);
  }

  static spawnArtifact() {
    // Generate a random position on the surface
    let position = this.generateRandomArtifactPosition();
    let size = 70; // Adjust size as needed
    this.artifact = new AlienArtifact(position, size);
    debug.log(`Alien artifact spawned at (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`);
  }

  static generateRandomArtifactPosition() {
    let x, y;
    let attempts = 0;
    do {
      x = random(100, worldWidth - 100);
      y = getSurfaceYAtX(x) - 25; // Slightly above the surface
      attempts++;
      if (attempts > 100) break; // Prevent infinite loop
    } while (this.isInvalidPosition(x, y));

    return createVector(x, y);
  }

  static isInvalidPosition(x, y) {
    // Define any invalid positions if necessary (e.g., too close to player start)
    // For now, we'll assume all positions are valid except off the surface
    return y < 0 || y > height;
  }

  static update() {
    if (!this.isActive) return;

    // Update the artifact
    if (this.artifact && !this.artifact.isDestroyed) {
      this.artifact.update();
    } else {
      debug.log("Artifact is either null or destroyed.");
    }

    // Iterate through active bullets to check for collisions with the artifact
    for (let i = Bullet.activeObjects.length - 1; i >= 0; i--) {
      let bullet = Bullet.activeObjects[i];
      
      // Only player bullets can damage the artifact
      if (bullet.isPlayerBullet && bullet.active && this.artifact && !this.artifact.isDestroyed) {
        let distance = bullet.pos.dist(this.artifact.pos);
        debug.log(`Bullet at (${bullet.pos.x.toFixed(2)}, ${bullet.pos.y.toFixed(2)}) is ${distance.toFixed(2)} units away from Artifact.`);
        
        if (distance < (bullet.size / 2 + this.artifact.size)) {
          // Apply damage to the artifact
          const damage = Bullet.damageMultiplier; // Adjust damage as needed
          this.artifact.takeDamage(damage);
          debug.log(`Artifact took damage. Current health: ${this.artifact.health}`);
          
          // Recycle the bullet
          Bullet.recycle(bullet);
          
          // Check if artifact is destroyed
          if (this.artifact.isDestroyed) {
            this.completeMission(true);
            break; // Exit the loop as the mission is complete
          }
        }
      }
    }

    // Check if mission timer has expired
    let timeElapsed = Date.now() - this.missionStartTime;
    if (timeElapsed >= this.missionDuration && this.artifact && !this.artifact.isDestroyed) {
      debug.log("Mission timer expired before destroying the artifact.");
      this.completeMission(false);
    }

  }

  static completeMission(success = false) {
    this.isActive = false;
    GameTimer.clearTimer(this.missionTimerKey);

    if (this.artifact && !this.artifact.isDestroyed) {
      this.artifact.takeDamage(1000);
      Alien.createAliens(6);
      for (let i = 0; i < 4; i++) Destroyer.spawnDestroyer();
      for (let i = 0; i < 4; i++) Hunter.spawnHunter();
      for (let i = 0; i < 4; i++) Zapper.spawnZapper();
      
    }

    if (success) {
      announcer.speak("Mission complete. Alien artifact destroyed successfully. Reward deposited.", 1, 2, 0);
      money += 15000;
      debug.log("AlienArtifactMission succeeded.");
    } else { 
      announcer.speak("Mission failed the aliens have launched an attack.", 1, 2, 2000);
      debug.log("AlienArtifactMission failed.");
    }

    // Clean up artifact
    this.artifact = null;

    MissionControl.endCurrentMission();
    this.resetMission();
  }

  static resetMission() {
    this.isActive = false;
    this.artifact = null;
    this.missionStartTime = 0;
    GameTimer.clearTimer(this.missionTimerKey);
  }

  static draw() {
    if (!this.isActive) return;
    // Draw the alien artifact
    if (this.artifact && !this.artifact.isDestroyed && isInView(this.artifact.pos, this.artifact.size)) {
      this.artifact.draw();
    }
  }

}

class AlienArtifact extends Entity {
  constructor(pos, size) {
    super(pos, createVector(0, 0), size);
    this.size = size;
    this.health = 100;
    this.isDestroyed = false;
    this.rotation = 0;
    this.rotationSpeed = 0.008; // Slightly slower rotation for a more menacing presence
    this.sprite = this.createSprite();
  }

  createSprite() {
    // Create a graphics buffer with increased dimensions for more detail
    let sprite = createGraphics(this.size * 3, this.size * 3);
    sprite.clear();

    // Enable smooth edges
    sprite.noStroke();

    // Draw the main blobby shape with gradient shading for pseudo-3D effect
    let centerX = this.size * 1.5;
    let centerY = this.size * 1.5;

    // Create a radial gradient effect
    for (let r = this.size * 1.5; r > 0; r -= 1) {
      let inter = map(r, 0, this.size * 1.5, 0, 1);
      let c = lerpColor(color(50, 0, 200, 200), color(0, 255, 0, 50), inter); // Gradient from dark blue to light green
      sprite.fill(c);
      sprite.ellipse(centerX, centerY, r * 2, r * 2);
    }

    // Add multiple overlapping blobs for a more organic look
    for (let i = 0; i < 5; i++) {
      let offsetX = random(-this.size / 2, this.size / 2);
      let offsetY = random(-this.size / 2, this.size / 2);
      let blobSize = random(this.size, this.size * 1.5);
      sprite.fill(0, 150, 0, 100); // Semi-transparent dark green
      sprite.ellipse(centerX + offsetX, centerY + offsetY, blobSize, blobSize);
    }

    // Add highlights to simulate lighting for pseudo-3D effect
    sprite.fill(255, 255, 255, 80);
    sprite.ellipse(centerX - this.size / 3, centerY - this.size / 3, this.size / 1.5, this.size / 1.5);

    return sprite;
  }

  update() {
    if (this.isDestroyed) return;
    this.rotation += this.rotationSpeed;
    if (this.rotation > TWO_PI) this.rotation -= TWO_PI;
  }

  draw() {
    if (this.isDestroyed) return;

    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);
    imageMode(CENTER);
    image(this.sprite, 0, 0);
    pop();

    // Display health bar above the artifact
    this.drawHealthBar();
  }

  drawHealthBar() {
    let barWidth = this.size * 3;
    let barHeight = 8;
    let healthRatio = this.health / 100; // Updated max health

    push();
    translate(this.pos.x - this.size * 1.5, this.pos.y - this.size * 1.5 - 20);
    noStroke();
    fill(255, 0, 0);
    rect(0, 0, barWidth, barHeight);
    fill(0, 255, 0);
    rect(0, 0, barWidth * healthRatio, barHeight);
    pop();
  }

  takeDamage(amount) {
    if (this.isDestroyed) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.destroy();
    }
  }

  destroy() {
    this.isDestroyed = true;
    // Play destruction sound
    soundManager.play('artifactDestroy');
    // Add explosion effect
    explosions.push(new Explosion(this.pos.copy(), this.size * 3, color(0, 255, 0), color(50, 150, 50)));
  }
}






class SupplyRunMission {
  static isActive = false;
  static missionDuration = 4 * 60 * 1000; // 6 minutes in milliseconds
  static missionTimerKey = 'supplyRunMission';
  static requiredSupplies = 5; // Number of supplies to deliver
  static supplies = [];
  static deliveredSupplies = 0;
  static missionStartTime = 0;
  static targetMoonBase = null;

  static startMission() {
    if (this.isActive) return;
    if (MoonBase.moonBases.length === 0) {
      debug.log("SupplyRunMission cannot start: No Moon Bases available.");
      return;
    }

    this.isActive = true;
    this.deliveredSupplies = 0;
    this.supplies = [];
    this.missionStartTime = Date.now();

    // Select a random Moon Base as the target
    this.targetMoonBase = random(MoonBase.moonBases);

    announcer.speak(
      `Commander, urgent supplies for our forward bases have been dropped. Collect ${this.requiredSupplies} supplies within 4 minutes.`,
      1,
      2,
      0
    );

    this.spawnSupplies();

    GameTimer.create(this.missionTimerKey, () => {
      this.completeMission(false);
    }, this.missionDuration);
  }

  static spawnSupplies() {
    for (let i = 0; i < this.requiredSupplies; i++) {
      let supplyPos = this.generateRandomSupplyPosition();
      let supplySize = 24; // Adjust size as needed
      let supply = new Supply(supplyPos, supplySize);
      this.supplies.push(supply);
      debug.log(`Supply ${i + 1} spawned at (${supplyPos.x.toFixed(2)}, ${supplyPos.y.toFixed(2)})`);
    }
  }

  static generateRandomSupplyPosition() {
    let x = random(100, worldWidth - 100); // Avoid spawning too close to edges
    let y = getSurfaceYAtX(x) - 30; // Slightly above the surface
    return createVector(x, y);
  }

  static update() {
    if (!this.isActive) return;

    // Update and draw supplies
    for (let supply of this.supplies) {
      if (!supply.isCollected) {
        supply.update();
        // Check for collision with the ship
        if (ship.pos.dist(supply.pos) < (ship.size / 2 + supply.size / 2)) {
          supply.collect();
          this.deliveredSupplies++;
          announcer.speak(
            `${this.deliveredSupplies} of ${this.requiredSupplies} supplies collected:`,
            1,
            2,
            0
          );

          // Check if all supplies are collected
          if (this.deliveredSupplies >= this.requiredSupplies) {
            this.completeMission(true);
          }
        }
      }
    }

    // Check if ship is at the target Moon Base and has collected all supplies
    if (
      this.deliveredSupplies >= this.requiredSupplies &&
      this.targetMoonBase &&
      ship.pos.dist(this.targetMoonBase.pos) < (ship.size / 2 + this.targetMoonBase.size / 2)
    ) {
      this.completeMission(true);
    }

  }

  static completeMission(success = false) {
    this.isActive = false;
    GameTimer.clearTimer(this.missionTimerKey);


    if (success) {
      announcer.speak("Mission complete. Reward deposited.", 1, 2, 0);
      money += 10000;
      debug.log("SupplyRunMission succeeded.");
    } else {
      announcer.speak("Mission failed. Supplies were not delivered in time.", 1, 2, 0);
      money = Math.floor(money / 2);
      debug.log("SupplyRunMission failed.");
    }

    // Clean up supplies
    this.supplies = [];

    MissionControl.endCurrentMission();
    this.resetMission();
  }

  static resetMission() {
    this.isActive = false;
    this.deliveredSupplies = 0;
    this.supplies = [];
    this.targetMoonBase = null;
    GameTimer.clearTimer(this.missionTimerKey);
  }

  static draw() {
    if (!this.isActive) return;

    // Draw supplies
    for (let supply of this.supplies) {
      if (!supply.isCollected && isInView(supply.pos, supply.size)) {
        supply.draw();
      }
    }
  }

}

class Supply extends Entity {
  constructor(pos, size) {
    super(pos, createVector(0, 0), size);
    this.size = size;
    this.isCollected = false;
    this.sprite = this.createSprite();
  }

  createSprite() {
    let sprite = createGraphics(this.size, this.size);
    sprite.fill(255, 215, 0); // Gold color for visibility
    sprite.noStroke();
    sprite.rect(0, 0, this.size, this.size, 5); // Rounded square
    sprite.fill(0);
    sprite.textSize(10);
    sprite.textAlign(CENTER, CENTER);
    sprite.text("H2O", this.size / 2, this.size / 2);
    return sprite;
  }

  update() {
    // a slight floating animation
    this.pos.y += sin(frameCount * 0.05) * 0.5;
  }

  draw() {
    if (!this.isCollected) {
      push();
      translate(this.pos.x, this.pos.y);
      imageMode(CENTER);
      image(this.sprite, 0, 0);
      pop();
    }
  }

  collect() {
    this.isCollected = true;
    // Play collection sound
    soundManager.play('supplyCollect');
  }
}


class BaseDefenseMission {
  static isActive = false;
  static missionDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
  static missionTimerKey = 'moonBaseDefenseMission';
  static previousBaseCount = 0;

  static startMission() {
    if (this.isActive) return;
    this.isActive = true;
    this.previousBaseCount = MoonBase.moonBases.length;
    announcer.speak("Commander, protect all bases for 5 minutes. If any base is destroyed, the mission will fail.", 1, 2, 0);

    GameTimer.create(this.missionTimerKey, () => {
      this.completeMission(true);
    }, this.missionDuration);
  }

  static update() {
    if (!this.isActive) return;

    if (MoonBase.moonBases.length < this.previousBaseCount) {
      // If the number of bases is less than the previous count, fail the mission
      this.completeMission(false);
      return;
    }

    this.previousBaseCount = MoonBase.moonBases.length;
  }

  static completeMission(success = false) {
    this.isActive = false;
    GameTimer.clearTimer(this.missionTimerKey);

    if (success) {
      announcer.speak("Mission complete. All bases are intact. Reward deposited.", 1, 2, 0);
      money += 20000;
    } else {
      announcer.speak("Mission failed. One or more bases were destroyed. Half your funds have been confiscated.", 1, 2, 0);
      money = money/2;
    }

    MissionControl.endCurrentMission();
    this.resetMission();
  }

  static resetMission() {
    this.isActive = false;
    this.previousBaseCount = 0;
  }
}

class DrillMission {
  static isActive = false;
  static energyRequired = 2000;
  static energyCollected = 0;
  static previousRigCount = 0;

  static startMission() {
    if (this.isActive) return;
    this.isActive = true;
    this.energyCollected = 0;
    this.previousRigCount = DrillRig.rigs.length;
    announcer.speak("Commander, use Drill Rigs to extract compressed Hydrogen. Protect all rigs from being destroyed.", 1, 2, 0);
  }

  static update() {
    if (!this.isActive) return;

    this.energyCollected = DrillRig.rigs.reduce((total, rig) => {
      return rig.health > 0 ? total + rig.energyGenerated : total;
    }, 0);

    if (this.energyCollected >= this.energyRequired) {
      this.completeMission(true);
      return;
    }

    if (DrillRig.rigs.length < this.previousRigCount) {
      // If the number of rigs is less than the previous count, fail the mission
      this.completeMission(false);
      return;
    }

    this.previousRigCount = DrillRig.rigs.length;
  }

  static completeMission(success = false) {
    this.isActive = false;

    if (success) {
      announcer.speak("Mission complete. Hydrogen extracted successfully. Reward deposited.", 1, 2, 0);
      money += 10000;
    } else {
      announcer.speak("Mission failed. Drill Rigs destroyed before extracting enough Hydrogen.", 1, 2, 0);
      money = money/2;
    }

    MissionControl.endCurrentMission();
    this.resetMission();
  }

  static resetMission() {
    this.isActive = false;
    this.energyCollected = 0;
    this.previousRigCount = 0;
  }
}

class EarthDefenseMission {
  static isActive = false;
  static missionDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
  static missionTimerKey = 'earthDefenseMission';
  static teleportationInProgress = false;
  static fadeAlpha = 0;
  static hasMissionOccurred = false; // Track if the mission has occurred

  static startMission() {
    // Check if the nests array is empty or mission already active
    if (this.isActive || this.hasMissionOccurred || Nest.nests.length === 0) return;

    this.isActive = true;
    this.teleportationInProgress = true;
    this.fadeAlpha = 0;

    
    soundManager.play('teleport');
    // Start teleportation effect
    this.showTeleportationEffect(() => {
      this.teleportationInProgress = false;
      this.hasMissionOccurred = true; // Mark mission as occurred
      atEarth = true; // Set atEarth to true when the screen is fully white

      announcer.speak("Commander, the aliens have used a wormhole to move Neptune near Earth! Destroy all alien nests in 3 minutes to stop the attack on Earth", 1, 2, 1000);

      GameTimer.create(this.missionTimerKey, () => {
        this.completeMission(false);
      }, this.missionDuration);
    });
  }

  static showTeleportationEffect(callback) {
    const fadeDuration = 2000; // 2 seconds for fade in and out
    const holdDuration = 1000; // Hold duration at full white (1 second)
    const totalDuration = fadeDuration + holdDuration + fadeDuration; // Total time for fade in, hold, and fade out
    const startTime = millis();

    const fadeInterval = setInterval(() => {
      const elapsedTime = millis() - startTime;

      if (elapsedTime < fadeDuration) {
        // Fading in
        this.fadeAlpha = map(elapsedTime, 0, fadeDuration, 0, 255);
      } else if (elapsedTime < fadeDuration + holdDuration) {
        // Holding at full white
        this.fadeAlpha = 255;
        atEarth = true; // Set atEarth to true when fully white
      } else if (elapsedTime < totalDuration) {
        // Fading out
        this.fadeAlpha = map(elapsedTime, fadeDuration + holdDuration, totalDuration, 255, 0);
      } else {
        // Effect complete
        clearInterval(fadeInterval);
        this.fadeAlpha = 0; // Reset for the next effect
        if (callback) callback();
      }
    }, 16); // Update roughly 60 times per second
  }

  static update() {
    if (!this.isActive) return;
    if (Nest.nests.length === 0) {
      this.completeMission(true);
    }
  }

  static completeMission(success = false) {
    this.isActive = false;
    GameTimer.clearTimer(this.missionTimerKey);
    this.teleportationInProgress = true;

    // Show teleportation effect for mission completion
    this.showTeleportationEffect(() => {
      this.teleportationInProgress = false;

      if (success) {
        announcer.speak("Excellent, Commander! You have dissuaded the aliens from a direct attack.", 1, 2, 0);
        money += 10000;
      } else {
        announcer.speak("Mission failed. Prepare for the consequences.", 1, 2, 0);
        money -= money / 2;
      }

      MissionControl.endCurrentMission();
    });
  }

  static resetMission() {
    this.isActive = false;
    this.teleportationInProgress = false;
    //atEarth = false; // Ensure atEarth is reset
    GameTimer.clearTimer(this.missionTimerKey);
  }

  static draw() {
    if (this.teleportationInProgress) {
      // Apply the fade effect
      fill(255, this.fadeAlpha);
      noStroke();
      rect(0, 0, worldWidth, height);
    }
  }
}

class AlienPlantInfestation {
  static isActive = false;
  static missionDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
  static missionTimerKey = 'alienPlantInfestation';
  static plantsDestroyed = 0;
  static requiredPlants = 20;
  static reward = 8000;
  static lastKnownPlants = [];

  static startMission() {
    if (this.isActive) return;
    this.isActive = true;
    this.plantsDestroyed = 0;
    this.lastKnownPlants = [...AlienPlant.plants];
    
    announcer.speak(`Commander, Alien Plant are spreading rapidly. Destroy Alien Plants wherever you find them. You have 3 minutes.`, 1, 2, 0);

    GameTimer.create(this.missionTimerKey, () => {
      this.completeMission(false);
    }, this.missionDuration);
  }

  static update() {
    if (!this.isActive) return;

    const currentPlants = AlienPlant.plants;
    
    // Check for destroyed plants
    this.lastKnownPlants.forEach(lastPlant => {
      if (!currentPlants.includes(lastPlant)) {
        this.plantsDestroyed++;
      }
    });

    // Update lastKnownPlants for the next check
    this.lastKnownPlants = [...currentPlants];

    // Check if all required plants have been destroyed
    if (this.plantsDestroyed >= this.requiredPlants) {
      this.completeMission(true);
    }
  }

  static completeMission(success = false) {
    this.isActive = false;
    GameTimer.clearTimer(this.missionTimerKey);

    if (success) {
      announcer.speak(`Excellent work, Commander! The Alien Plant infestation has been contained. Reward deposited.`, 1, 2, 0);
      money += this.reward;
    } else {
      announcer.speak(`Mission failed. The Alien Plant infestation continues to spread.`, 1, 2, 0);
    }

    MissionControl.endCurrentMission();
  }

  static resetMission() {
    this.isActive = false;
    this.plantsDestroyed = 0;
    this.lastKnownPlants = [];
    GameTimer.clearTimer(this.missionTimerKey);
  }
}

class WormHuntMission {
  static isActive = false;
  static requiredWorms = 2;
  static missionDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
  static missionTimerKey = 'wormHuntMission';
  static wormsDestroyed = 0;
  static startTime = 0;
  static lastKnownWorms = [];

  static startMission() {
    if (this.isActive) return;
    this.isActive = true;
    this.wormsDestroyed = 0;
    this.startTime = Date.now();
    this.lastKnownWorms = [...AlienWorm.worms];
    
    announcer.speak(`Commander, our scientists need data on the alien worms. Destroy ${this.requiredWorms} worms as quickly as possible. You have 3 minutes.`, 1, 2, 0);

    GameTimer.create(this.missionTimerKey, () => {
      this.completeMission(false);
    }, this.missionDuration);
  }

  static update() {
    if (!this.isActive) return;

    const currentWorms = AlienWorm.worms;
    
    // Check for destroyed worms
    this.lastKnownWorms.forEach(lastWorm => {
      if (!currentWorms.includes(lastWorm)) {
        this.wormsDestroyed++;
        announcer.speak(`Worm destroyed. ${Math.max(0, this.requiredWorms - this.wormsDestroyed)} remaining.`, 1, 2, 0);
      }
    });

    // Update lastKnownWorms for the next check
    this.lastKnownWorms = [...currentWorms];

    // Check if all required worms have been destroyed
    if (this.wormsDestroyed >= this.requiredWorms) {
      this.completeMission(true);
    }
  }

  static completeMission(success = false) {
    this.isActive = false;
    GameTimer.clearTimer(this.missionTimerKey);

    if (success) {
      const timeTaken = (Date.now() - this.startTime) / 1000; // Convert to seconds
      const reward = this.calculateReward(timeTaken);
      announcer.speak(`Excellent work, Commander! You've destroyed all the worms. Reward deposited.`, 1, 2, 0);
      money += reward;
    } else {
      announcer.speak(`Mission failed.`, 1, 2, 0);
    }

    MissionControl.endCurrentMission();
  }

  static calculateReward(timeTaken) {
    const baseReward = 6000;
    const timeBonus = Math.max(0, 180 - timeTaken) * 100; // 10 credits for each second under 3 minutes
    return Math.round(baseReward + timeBonus);
  }

  static resetMission() {
    this.isActive = false;
    this.wormsDestroyed = 0;
    this.lastKnownWorms = [];
    GameTimer.clearTimer(this.missionTimerKey);
  }
}

class BuildBaseMission {
  static isActive = false;
  static requiredBases = 3;
  static missionTimeMin = 5;
  static baseArray = [3,4,5,6,7];
  static missionDuration = this.missionTimeMin * 60 * 1000; // 5 minutes in milliseconds
  static missionTimerKey = 'buildBaseMission';
  static initialBaseCount = 0;
  static reward = 10000;

  static startMission() {
    if (this.isActive) return;
    this.isActive = true;
    this.initialBaseCount = MoonBase.moonBases.length;
    this.requiredBases = random(this.baseArray);
    
    announcer.speak(`Commander, you need to prepare for our invasion force. Build ${this.requiredBases} new bases in the next ${this.missionTimeMin} minutes. We have indicated where we would like them built`, 1, 2, 0);

    GameTimer.create(this.missionTimerKey, () => {
      this.completeMission();
    }, this.missionDuration);
  }

  static update() {
    if (!this.isActive) return;

    const newBaseCount = MoonBase.moonBases.length - this.initialBaseCount;
    if (newBaseCount >= this.requiredBases) {
      if (this.checkBaseDistribution()) {
        this.completeMission(true);
      }
    }
  }

  static checkBaseDistribution() {
    const newBases = MoonBase.moonBases.slice(this.initialBaseCount);
    if (newBases.length < this.requiredBases) return false;

    newBases.sort((a, b) => a.pos.x - b.pos.x);
    const idealSpacing = worldWidth / (this.requiredBases + 1);
    const tolerance = idealSpacing * 0.3; // 30% tolerance

    for (let i = 0; i < newBases.length; i++) {
      const idealPosition = idealSpacing * (i + 1);
      const actualPosition = newBases[i].pos.x;
      if (Math.abs(actualPosition - idealPosition) > tolerance) {
        return false;
      }
    }

    return true;
  }

  static completeMission(success = false) {
    this.isActive = false;
    GameTimer.clearTimer(this.missionTimerKey);

    if (success) {
      announcer.speak("Excellent work, Commander! The bases are well-positioned. Reward deposited.", 1, 2, 0);
      money += this.reward;
    } else {
      announcer.speak("Mission failed. You didn't build the required bases in time. Half your funds have been confiscated.", 1, 2, 0);
      money -= money/2;
    }

    MissionControl.endCurrentMission();
  }

  static resetMission() {
    this.isActive = false;
    GameTimer.clearTimer(this.missionTimerKey);
    this.initialBaseCount = 0;
  }

  static draw() {
    if (!this.isActive) return;
    this.drawIdealBasePositions();
  }

  static drawIdealBasePositions() {
    const idealSpacing = worldWidth / (this.requiredBases + 1);
    push();
    stroke(0, 255, 0, 100);
    strokeWeight(2);
    for (let i = 1; i <= this.requiredBases; i++) {
      const x = idealSpacing * i;
      line(x, 0, x, height);
    }
    pop();
  }
}

class Artifact extends Entity {
  constructor(pos, size) {
    super(pos, createVector(0, 0), size);
    this.baseColor = color(random(100, 255), random(100, 255), random(100, 255));
    this.glowColor = color(random(200, 255), random(200, 255), random(200, 255), 150);
    this.shape = floor(random(3, 7)); // 3 to 6 sides
    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.02, 0.02);
    this.pulseSpeed = random(0.02, 0.05);
    this.pulseAmount = random(0.1, 0.3);
    this.time = random(1000);
  }

  update() {
    this.time += this.pulseSpeed;
    this.rotation += this.rotationSpeed;
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);

    // Draw glow
    let glowSize = this.size * (1 + sin(this.time) * this.pulseAmount);
    fill(this.glowColor);
    noStroke();
    this.drawShape(glowSize);

    // Draw base
    fill(this.baseColor);
    this.drawShape(this.size * 0.8);

    // Draw core
    fill(255);
    ellipse(0, 0, this.size * 0.2);

    pop();
  }

  drawShape(size) {
    beginShape();
    for (let i = 0; i < this.shape; i++) {
      let angle = map(i, 0, this.shape, 0, TWO_PI);
      let x = cos(angle) * size / 2;
      let y = sin(angle) * size / 2;
      vertex(x, y);
    }
    endShape(CLOSE);
  }
}

class ArtifactRecoveryMission {
  static isActive = false;
  static artifacts = [];
  static collectedArtifacts = 0;
  static requiredArtifacts = 3;

  static startMission() {
    debug.log("Starting Artifact Recovery Mission");
    this.resetMission();
    this.isActive = true;
    this.spawnArtifacts();
    announcer.speak("Alien artifacts detected. Collect them to help our scientists develop alien weapons!", 1, 2, 0);
  }

  static spawnArtifacts() {
    for (let i = 0; i < this.requiredArtifacts; i++) {
      let artifactX = random(worldWidth);
      let surfaceY = getSurfaceYAtX(artifactX);
      let artifactSize = random(30, 50);
      
      // Position the artifact slightly below the surface
      let artifactY = surfaceY + artifactSize / 2 + random(50, 100);
      
      let artifactPos = createVector(artifactX, artifactY);
      this.artifacts.push(new Artifact(artifactPos, artifactSize));
    }
  }

  static update() {
    if (!this.isActive) return;

    for (let artifact of this.artifacts) {
      artifact.update();
    }

    for (let i = this.artifacts.length - 1; i >= 0; i--) {
      let artifact = this.artifacts[i];
      if (this.checkShipCollision(artifact) || this.checkAstronautCollision(artifact)) {
        this.collectArtifact(i);
      }
    }

    if (this.collectedArtifacts >= this.requiredArtifacts) {
      this.completeMission();
    }
  }

  static checkShipCollision(artifact) {
    return ship.pos.dist(artifact.pos) < ship.size / 2 + artifact.size / 2;
  }

  static checkAstronautCollision(artifact) {
    return isWalking && !astronaut.isInShip && 
           astronaut.pos.dist(artifact.pos) < astronaut.size / 2 + artifact.size / 2;
  }

  static collectArtifact(index) {
    this.artifacts.splice(index, 1);
    this.collectedArtifacts++;
    soundManager.play('shipDropOffPod');
    
    if (this.requiredArtifacts - this.collectedArtifacts > 0){
    announcer.speak(`Artifact collected. ${this.requiredArtifacts - this.collectedArtifacts} remaining.`, 1, 2, 0);
  }
  }

  static completeMission() {
    announcer.speak("All artifacts collected. Great work, Commander!", 1, 2, 0);
    money += 10000;
    this.resetMission();
  }

  static resetMission() {
    debug.log("Resetting Artifact Recovery Mission");
    this.isActive = false;
    this.artifacts = [];
    this.collectedArtifacts = 0;
  }

  static draw() {
    if (this.isActive) {
      for (let artifact of this.artifacts) {
        if (isInView(artifact.pos, artifact.size)) {
          artifact.draw();
        }
      }
    }
  }
}

class RescueMission {
  static crashedShip = null;
  static strandedAstronaut = null;
  static missionLevel = 0;
  static missionTimerKey = 'rescueMission';
  static isActive = false;

  static get isActive() { 
    return this.strandedAstronaut !== null; 
  }

  static startMission() {
    if (this.isActive) return;
    this.missionLevel = level;
    this.isActive = true;  // Set active state
    
    soundManager.play('gameOver');
    this.createCrashedShip();
    this.createStrandedAstronaut();
    announcer.speak("Urgent: A fellow commander has been shot down. Locate the crash site and rescue the astronaut.", 1, 2, 2000);
    GameTimer.create(this.missionTimerKey, () => {
      Hunter.spawnHunter();
    }, 9000);
  }

  static draw() {
    if (this.isActive && this.strandedAstronaut) {
      this.strandedAstronaut.draw();
    }
    if (this.crashedShip) {
      this.crashedShip.draw();
    }
  }

  static createCrashedShip() {
    let playerPos;
    if (isWalking && !astronaut.isInShip) {
      playerPos = astronaut.pos.x;
    } else {
      playerPos = ship.pos.x;
    }

    // Calculate the farthest point from the player
    let crashPos = createVector(0, 0);
    let maxDistance = 0;

    for (let x = 0; x < worldWidth; x += 100) {  // Check every 100 pixels
      let distance = Math.min(
        Math.abs(x - playerPos),
        worldWidth - Math.abs(x - playerPos)
      );

      if (distance > maxDistance) {
        maxDistance = distance;
        crashPos.x = x;
      }
    }

    // Add some randomness to the exact crash location
    crashPos.x += random(-50, 50);
    crashPos.x = (crashPos.x + worldWidth) % worldWidth;  // Ensure it's within world bounds

    crashPos.y = getSurfaceYAtX(crashPos.x) - 20;
    this.crashedShip = new RuinedShip(crashPos, 20);
    if (!RuinedShip.ruinedShips.includes(this.crashedShip)) {
      RuinedShip.ruinedShips.push(this.crashedShip);
    }
  }

  static createStrandedAstronaut() {
    if (!this.crashedShip) return;
    let astronautPos = this.crashedShip.pos.copy();
    astronautPos.x += random(-100, 100);
    astronautPos.y = getSurfaceYAtX(astronautPos.x) - 15;
    this.strandedAstronaut = new StrandedAstronaut(astronautPos, 20);
  }

  static update() {
    if (!this.isActive) return;

    if (this.strandedAstronaut) {
      this.strandedAstronaut.update();
      if (this.checkRescue()) {
        this.completeMission();
      } else if (this.strandedAstronaut.health <= 0) {
        this.failMission();
      }
    }
  }

  static checkRescue() {
    if (!this.strandedAstronaut) return false;

    // Check if ship is close enough
    if (ship.isLanded && ship.pos.dist(this.strandedAstronaut.pos) < ship.size + this.strandedAstronaut.size) {
      return true;
    }

    // Check if astronaut is close enough
    if (isWalking && !astronaut.isInShip && 
        astronaut.pos.dist(this.strandedAstronaut.pos) < astronaut.size + this.strandedAstronaut.size) {
      return true;
    }

    return false;
  }

  static failMission() {
    this.resetMission();
  }

  static completeMission() {
    money += 10000;
    announcer.speak("Well done Commander. Reward deposited", 1, 2, 1000);
    this.resetMission();
  }

  static resetMission() {
    this.strandedAstronaut = null;
    this.crashedShip = null;
    this.missionLevel = 0;
    this.isActive = false;  // Reset active state
    GameTimer.clearTimer(this.missionTimerKey);
  }
}

class StrandedAstronaut extends Astronaut {
  static defaultHealth = 50;

  constructor(pos, size) {
    super(pos, size);
    this.isRescued = false;
    this.moveSpeed = 1;
    this.isInShip = false;
    this.sprite = this.createSprite();
    this.health = StrandedAstronaut.defaultHealth;
  }

  createSprite() {
    let sprite = createGraphics(20, 30);
    sprite.fill(255,0,0);
    sprite.noStroke();
    sprite.rect(2, 16, 4, 8); // Left arm
    sprite.rect(11, 28, 3, 6); // Right leg
    sprite.fill(255);
    sprite.ellipse(10, 8, 16, 16); // Head
    sprite.rect(6, 16, 8, 12); // Body
    sprite.rect(14, 16, 4, 8); // Right arm
    sprite.rect(6, 28, 3, 6); // Left leg
    
    return sprite;
  }

  update() {
    if (this.isRescued || this.health <= 0) return;

    let rescuer = this.findClosestRescuer();
    if (rescuer) {
      let direction = p5.Vector.sub(rescuer.pos, this.pos).normalize();
      this.pos.add(direction.mult(this.moveSpeed));
      if (this.pos.dist(rescuer.pos) < this.size + rescuer.size) {
        this.isRescued = true;
      }
    }

    this.facing = this.vel.x > 0 ? 1 : (this.vel.x < 0 ? -1 : this.facing);
    this.pos.y = getSurfaceYAtX(this.pos.x) - this.size / 2;
  }

  findClosestRescuer() {
    let shipDistance = ship.isLanded ? this.pos.dist(ship.pos) : Infinity;
    let astronautDistance = isWalking && !astronaut.isInShip ? this.pos.dist(astronaut.pos) : Infinity;

    if (shipDistance < astronautDistance && shipDistance < 200) {
      return ship;
    } else if (astronautDistance < 200) {
      return astronaut;
    }

    return null;
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    image(this.sprite, -this.size / 2, -this.size / 2);  
    pop();
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    }
  }



  die() {
    explosions.push(new Explosion(this.pos, 30, color(255, 0, 0), color(100, 0, 0)));
    
    // Remove reference to this astronaut in RescueMission
    RescueMission.strandedAstronaut = null;
      money = Math.floor(money / 2); 
    announcer.speak("The crashed Commander died on your watch. Half your funds have been confiscated", 1, 2, 1000);
    
    // End the mission through MissionControl
    MissionControl.endCurrentMission();
  }


  static updateAstronauts() {
    // Implement this method to update all astronauts in the game
    // Similar to Turret.updateTurrets()
  }

  static drawAstronauts() {
    // Implement this method to draw all astronauts in the game
    // Similar to Turret.drawTurrets()
  }
}

class NoFlyZoneMission {
  static missionTimerKey = 'noFlyZoneMission';
  static missionDuration = 60000; // 1 minute in milliseconds
  static landingGracePeriod = 20000; // 20 seconds in milliseconds
  static hasViolatedNoFlyZone = false;
  static isActive = false; // Make isActive a static property

  static startMission() {
    this.hasViolatedNoFlyZone = false;
    this.isActive = true; // Set isActive to true when the mission starts
    announcer.speak("Central Command has declared Neptune a No-Fly Zone for the next minute. Land immediately.", 1, 2, 0);
    
    GameTimer.create(this.missionTimerKey, () => {
      this.completeMission();
    }, this.missionDuration);

    GameTimer.create('noFlyZoneGracePeriod', () => {
      if (!ship.isLanded) {
        this.hasViolatedNoFlyZone = true;
      }
    }, this.landingGracePeriod);
  }

  static update() {
    if (!this.isActive) return;

    if (!GameTimer.exists('noFlyZoneGracePeriod') && !ship.isLanded) {
      this.hasViolatedNoFlyZone = true;
    }
  }

  static completeMission() {
    this.isActive = false; // Set isActive to false when the mission completes

    if (this.hasViolatedNoFlyZone) {
      money = Math.floor(money / 2);
      announcer.speak("Commander, you disobeyed Central Command. Half your funds have been confiscated.", 1, 2, 2000);
    } else {
      money += 5000;
      announcer.speak("Well done for maintaining the no-fly zone. Reward deposited.", 1, 2, 2000);
    }
    debug.log(`NoFlyZone mission completed. Violation: ${this.hasViolatedNoFlyZone}`);
    MissionControl.endCurrentMission();
  }

  static resetMission() {
    GameTimer.clearTimer(this.missionTimerKey);
    GameTimer.clearTimer('noFlyZoneGracePeriod');
    this.hasViolatedNoFlyZone = false;
    this.isActive = false; // Reset isActive when resetting the mission
  }

  static draw() {
    // No drawing needed for this mission
  }
}

class AttackMission {
  static wingmenCount = 10;
  static missionTimerKey = 'attackMission';
  static missionDuration = 3 * 60 * 1000; // 5 minutes in milliseconds
  static isActive = false; // Change this to a static property for assignment

  static draw() {
    // Draw any AttackMission specific elements
  }

  static startMission() {
    this.isActive = true; // Set isActive to true when the mission starts
    announcer.speak(`Commander, it's time to attack! We've deployed ${this.wingmenCount} wingmen to assist you. Good luck!`, 1, 2, 0);
    
    this.missionSpawn();
    
    GameTimer.create(this.missionTimerKey, () => {
      this.completeMission();
    }, this.missionDuration);
  }

  static update() {
    if (this.isActive && Wingman.wingmen.length === 0) {
      this.completeMission();
    }
  }

  static missionSpawn() {
    for (let i = 0; i < this.wingmenCount; i++) {
      let spawnPos = createVector(ship.pos.x + random(-100, 100), ship.pos.y + random(-100, 100));
      let newWingman = new Wingman(spawnPos, createVector(0, 0), 14);
      newWingman.health = newWingman.maxHealth;
      newWingman.isActive = true;
      Wingman.wingmen.push(newWingman);
    }
  }

  static completeMission() {
    this.isActive = false; // Set isActive to false when the mission completes
    let survivingWingmen = Wingman.wingmen.length;
    let reward = survivingWingmen * 1000; // 1000 credits per surviving wingman
    money += reward;
    
    let message;
    if (survivingWingmen > 0) {
      message = `Attack mission completed. ${survivingWingmen} wingmen survived. Reward: ${reward} credits.`;
    } else {
      message = "All wingmen have been destroyed.";
    }
    
    announcer.speak(message, 1, 2, 0);
    debug.log(message);
    MissionControl.endCurrentMission();
  }

  static resetMission() {
    GameTimer.clearTimer(this.missionTimerKey);
    Wingman.wingmen = [];
    this.isActive = false; // Reset isActive when resetting the mission
  }
}

class MissionControl {
  static currentMission = null;
  static missions = {
    rescue: RescueMission,
    noFlyZone: NoFlyZoneMission,
    attack: AttackMission,
    artifact_Recovery: ArtifactRecoveryMission,
    build_Bases: BuildBaseMission,
    wormHunt: WormHuntMission,
    alienPlant_Infestation: AlienPlantInfestation,  
    Defend_all_bases: BaseDefenseMission,
    drill_for_Hydrogen: DrillMission,
    earthDefense: EarthDefenseMission,
    supply_Pickup: SupplyRunMission,
    Shoot_alien_Artifact: AlienArtifactMission
  };

  static draw() {
    if (this.currentMission) {
      const MissionClass = this.missions[this.currentMission];
      if (MissionClass && typeof MissionClass.draw === 'function') {
        MissionClass.draw();
      }
    }
  }

  static startRandomMission() {
    if (this.currentMission) return;

    const availableMissions = Object.keys(this.missions);
    const randomMission = availableMissions[Math.floor(Math.random() * availableMissions.length)];
    this.startMission(randomMission);
  }

  static startMission(missionType) {
    if (this.currentMission) {
      debug.log("A mission is already in progress");
      return;
    }

    const MissionClass = this.missions[missionType];
    if (MissionClass) {
      this.currentMission = missionType;
      MissionClass.startMission();
      debug.log(`Started ${missionType} mission`);
    } else {
      debug.log(`Unknown mission type: ${missionType}`);
    }
  }

  static update() {
    if (this.currentMission) {
      const MissionClass = this.missions[this.currentMission];
      MissionClass.update();

      if (!MissionClass.isActive) {
        this.endCurrentMission();
      }
    }
  }

  static getMissionTimerKey() {
    if (!this.currentMission) return null;
    const MissionClass = this.missions[this.currentMission];
    return MissionClass.missionTimerKey;
  }

  static getTimeRemaining() {
    const timerKey = this.getMissionTimerKey();
    if (!timerKey) return 0;
    return GameTimer.getTimeRemaining(timerKey);
  }

  static endCurrentMission() {
    if (this.currentMission) {
      const MissionClass = this.missions[this.currentMission];
      debug.log(`Ending mission: ${this.currentMission}`);
      MissionClass.resetMission();
      this.currentMission = null;
    }
  }

static resetAllMissions() {
    this.currentMission = null;
    Object.values(this.missions).forEach(MissionClass => MissionClass.resetMission());
  }
}