class ProfilerSequential {
  /**
   * Creates an instance of ProfilerSequential.
   * @param {number} framesToProfile - Number of frames over which to profile each function.
   */
  constructor(framesToProfile = 100) {
    this.framesToProfile = framesToProfile;
    this.functions = []; // Array to store functions with their profiling data
    this.currentFunctionIndex = 0;
    this.currentFrame = 0;
    this.isProfiling = false;
    this.results = {};
  }

  /**
   * Adds a function to be profiled.
   * @param {string} name - Unique identifier for the function.
   * @param {function} func - The function to profile.
   */
  addFunction(name, func) {
    this.functions.push({
      name: name,
      func: func,
      totalTime: 0,
      averageTime: 0
    });
  }

  /**
   * Starts the profiling process.
   */
  startProfiling() {
    if (this.functions.length === 0) {
      console.warn("No functions registered for profiling.");
      return;
    }
    this.isProfiling = true;
    this.currentFunctionIndex = 0;
    this.currentFrame = 0;
    // Reset previous results
    for (let func of this.functions) {
      func.totalTime = 0;
      func.averageTime = 0;
    }
    console.log("Sequential Profiling started...");
  }

  /**
   * Profiles the current function each frame.
   */
  profileFrame() {
    if (!this.isProfiling) return;

    const currentFunction = this.functions[this.currentFunctionIndex];

    // Start timing
    const startTime = performance.now();

    // Execute the function
    currentFunction.func();

    // End timing
    const endTime = performance.now();
    const timeTaken = endTime - startTime;

    // Accumulate time
    currentFunction.totalTime += timeTaken;

    this.currentFrame++;

    if (this.currentFrame >= this.framesToProfile) {
      // Calculate average
      currentFunction.averageTime = currentFunction.totalTime / this.framesToProfile;
      this.results[currentFunction.name] = currentFunction.averageTime;

      console.log(
        `Profiling Completed for "${currentFunction.name}": ${currentFunction.averageTime.toFixed(4)} ms over ${this.framesToProfile} frames.`
      );

      // Move to next function
      this.currentFunctionIndex++;
      this.currentFrame = 0;

      if (this.currentFunctionIndex >= this.functions.length) {
        this.isProfiling = false;
        console.log("Sequential Profiling completed for all functions.");
      } else {
        console.log(`Starting profiling for "${this.functions[this.currentFunctionIndex].name}"...`);
      }
    }
  }

  /**
   * Logs all profiling results to the console.
   */
  logAllResults() {
    if (Object.keys(this.results).length === 0) {
      console.log("No profiling results to display.");
      return;
    }
    console.log("All Profiling Results:");
    for (let name in this.results) {
      console.log(`${name}: ${this.results[name].toFixed(4)} ms`);
    }
  }

  /**
   * Displays the current profiling results on the canvas.
   * @param {number} x - X-coordinate for text placement.
   * @param {number} y - Y-coordinate for text placement.
   * @param {number} [lineHeight=20] - Space between lines.
   */
  displayResults(x, y, lineHeight = 20) {
    if (Object.keys(this.results).length === 0) return;

    fill(255);
    noStroke();
    textSize(16);
    let currentY = y;

    for (let name in this.results) {
      text(
        `${name}: ${this.results[name].toFixed(4)} ms`,
        x,
        currentY
      );
      currentY += lineHeight;
    }
  }
}



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

/**
 * MoonBase Class

 * Overview:
 * - MoonBase manages the creation, updating, and rendering of bases on the surface.
 * - Each base has properties such as size, position, health, and can launch and manage barrage balloons.
 * - The class includes both instance methods for individual bases and static methods for managing all bases.
 * 
 * Key Features:
 * 1. Base Creation: Bases can be created at random locations or from existing "nests".
 * 2. Health System: Bases have health that can decrease (presumably from attacks) and regenerate over time.
 * 3. Barrage Balloons: Each base can launch and manage a limited number of barrage balloons.
 * 4. Radar Animation: Bases have an animated radar dish.
 * 5. Automatic Updates: The class uses GameTimer for periodic healing and balloon launching.
 * 
 * Static Properties:
 * - BASE_HEIGHT, BASE_WIDTH: Default dimensions for bases.
 * - moonBases: Array storing all active MoonBase instances.
 * - maxBalloons: Maximum number of balloons allowed per base.
 * 
 * Methods:
 * - constructor(width, height, pos): Creates a new MoonBase instance.
 * - static updateAll(): Updates all existing moon bases, handling destruction if necessary.
 * - static drawAll(): Renders all moon bases that are in the view.
 * - static createFromNest(nest): Creates a new MoonBase from a given nest object.
 * - static resetBases(): Clears all existing moon bases.
 * - findSuitableLocation(): Determines an appropriate position for a new base.
 * - findFlattestSegment(): Locates the flattest segment of the moon's surface for base placement.
 * - draw(): Renders the individual moon base, including its structure and health bar.
 * - update(): Updates the base's state, including radar animation and balloon management.
 * - heal(): Increases the base's health over time.
 * - launchBarrageBalloon(): Creates and launches a new barrage balloon if conditions allow.
 * 
 * Integration:
 * This class interacts with other game elements such as GameTimer, RuinedBase, BarrageBalloon,
 * and global variables like moonSurface. It also uses a soundManager for audio feedback.
 */

class MoonBase {
  static BASE_HEIGHT = 20;
  static BASE_WIDTH = 100;
  static moonBases = [];
  static maxBalloons = 0;

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

    MoonBase.moonBases.push(this);

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
        base.draw();
      }
    }
  }

  static createFromNest(nest) {
    if (!nest || !nest.pos) return;
    const newBasePos = nest.pos.copy().sub(MoonBase.BASE_WIDTH / 2, (MoonBase.BASE_HEIGHT / 2) - 10);
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
      const avgY = (start.y + end.y) / 2;
      start.y = end.y = avgY;
      return createVector(start.x, avgY - this.height);
    }

    const baseSegmentIndex = floor(random(moonSurface.length - 1));
    const start = moonSurface[baseSegmentIndex];
    const end = moonSurface[baseSegmentIndex + 1];
    return createVector(start.x, (start.y + end.y) / 2 - this.height);
  }


  findFlattestSegment() {
    let flattestSegment = null;
    let lowestSlope = Infinity;
    for (let i = 0; i < moonSurface.length - 1; i++) {
      const start = moonSurface[i];
      const end = moonSurface[i + 1];
      const segmentWidth = end.x - start.x;
      const slope = Math.abs((end.y - start.y) / segmentWidth);
      if (segmentWidth >= 40 && slope < lowestSlope) {
        flattestSegment = i;
        lowestSlope = slope;
      }
    }
    return flattestSegment;
  }


  draw() {
    push();
    fill(100, 100, 255);
    rect(this.pos.x, this.pos.y, this.width, this.height);
    fill(150, 150, 255);
    const towerX = this.pos.x + this.width - this.towerWidth;
    const towerY = this.pos.y - this.towerHeight;
    rect(towerX, towerY, this.towerWidth, this.towerHeight);

    push();
    translate(towerX + this.towerWidth / 2, towerY);
    rotate(this.radarAngle);
    fill(200, 200, 255);
    arc(0, 4, this.radarDishRadius * 2, this.radarDishRadius * 2, PI, TWO_PI);
    pop();

    fill(255, 0, 0);
    rect(this.pos.x, this.pos.y, 100 - this.health, 5);
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
    // Draw the pre-rendered image
    image(this.renderedImage, this.pos.x, this.pos.y - this.towerHeight);
  }

  static createFromMoonBase(moonBase) {
    const ruinedBase = new RuinedBase(moonBase.pos, moonBase.width, moonBase.height);
    RuinedBase.ruinedBases.push(ruinedBase);
  }

  static updatePositions() {
    for (let base of RuinedBase.ruinedBases) {
      base.pos.y = getSurfaceYAtX(base.pos.x);
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
    let surfaceY = this.getSurfaceYAtX(this.pos.x);
    this.pos.y = surfaceY - this.size / 2;
  }

  getSurfaceYAtX(x) {
    for (let i = 0; i < moonSurface.length - 1; i++) {
      if (x >= moonSurface[i].x && x < moonSurface[i + 1].x) {
        let t = (x - moonSurface[i].x) / (moonSurface[i + 1].x - moonSurface[i].x);
        return lerp(moonSurface[i].y, moonSurface[i + 1].y, t);
      }
    }
    return height; // Default to bottom of screen if not found
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


/**
 * Astronaut Class
 * 
 * This class represents an Astronaut entity in a space-themed game environment.
 * It extends the Entity class, suggesting a hierarchy of game objects.
 * 
 * Overview:
 * - The Astronaut is a player-controlled character that can move, jump, interact with objects,
 *   and perform various actions on the moon's surface.
 * - It manages the astronaut's movement, sprite rendering, interactions with other game elements,
 *   and special abilities like throwing bombs and placing structures.
 * 
 * Key Features:
 * 1. Movement: Horizontal movement and jumping mechanics.
 * 2. Sprite Rendering: Custom sprite creation and rendering.
 * 3. Object Interaction: Ability to grab and deliver pods, interact with bases.
 * 4. Special Actions: Throwing bombs, placing drill rigs, shields, and turrets.
 * 5. Targeting System: A directional targeting line for aiming actions.
 * 6. Ship Integration: Can enter and leave a ship.
 * 
 * Properties:
 * - Basic: position, velocity, size, sprite, walking speed, facing direction
 * - Jumping: jump force, cooldown, and related states
 * - Bomb Throwing: cooldown, throw strength, and related states
 * - Interaction States: hasGrabbedPod, isInShip
 * - Targeting: targetAngle, targetLineLength, targetLineOffset
 * 
 * Methods:
 * - constructor(pos, size): Initializes a new Astronaut instance.
 * - createSprite(): Generates the astronaut's visual representation.
 * - update(): Handles movement, jumping, interactions, and state updates.
 * - draw(): Renders the astronaut and its targeting line.
 * - jump(): Initiates a jump action.
 * - placeDrillRig(): Places a drill rig on the moon's surface.
 * - dropBase(): Deploys a new MoonBase.
 * - startBombThrow(), releaseBombThrow(): Manages bomb throwing mechanics.
 * - leaveShip(): Transitions the astronaut out of the ship.
 * - checkPodInteraction(), grabPod(): Handles pod pickup mechanics.
 * - checkBaseInteraction(), dropOffPod(): Manages pod delivery to bases.
 * - placeShield(), placeTurret(): Deploys defensive structures.
 * - isCloseToShip(): Checks proximity to the ship.
 * 
 * Integration:
 * This class interacts with various game elements such as the moon surface, pods,
 * bases, bombs, shields, and turrets. It also uses global variables like 'energy'
 * and 'money', and interacts with game systems like 'soundManager' and 'announcer'.
 * 
 */

class Astronaut extends Entity {
  constructor(pos, size) {
    super(pos, createVector(0, 0), size);
    this.sprite = this.createSprite();
    this.walkSpeed = 2;
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


  createSprite() {
    let sprite = createGraphics(20, 30);
    sprite.fill(255);
    sprite.noStroke();
    sprite.ellipse(10, 8, 16, 16); // Head
    sprite.rect(6, 16, 8, 12); // Body
    sprite.rect(2, 16, 4, 8); // Left arm
    sprite.rect(14, 16, 4, 8); // Right arm
    sprite.rect(6, 28, 3, 6); // Left leg
    sprite.rect(11, 28, 3, 6); // Right leg
    return sprite;
  }

  update() {
    if (cameraFollowsMissile) return; // Disable controls if missile is active
    
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
    
    // Apply gravity if jumping
    if (this.isJumping) {
      this.vel.y += gravity.y;
    } else {
      // If not jumping, follow the moon surface
      let surfaceY = getSurfaceYAtX(this.pos.x + this.vel.x);
      this.vel.y = surfaceY - (this.pos.y + this.size / 2);
    }
      
      
      
      
    }

    // Adjust target angle
    if (keyIsDown(UP_ARROW)) {
      this.targetAngle = max(this.targetAngle - 0.05, -PI / 2);
    } else if (keyIsDown(DOWN_ARROW)) {
      this.targetAngle = min(this.targetAngle + 0.05, PI / 2);
    }
    

    
    // Check for bomb throw release
    if (this.isHoldingBombThrow && !keyIsDown(32)) { // 32 is spacebar
      this.releaseBombThrow();
    }
    
    super.update();
    this.pos.x = (this.pos.x + worldWidth) % worldWidth; // Wrap around the world
    
    // Check for landing
    let surfaceY = getSurfaceYAtX(this.pos.x);
    if (this.pos.y + this.size / 2 >= surfaceY) {
      this.pos.y = surfaceY - this.size / 2;
      this.vel.y = 0;
      this.isJumping = false;
    }
    
    if (this.hasGrabbedPod) {
      pod.pos = this.pos.copy();
      pod.pos.y -= this.size / 2 + 5; // Position pod above astronaut's head
    }
    
    this.checkPodInteraction();
    this.checkBaseInteraction();
    
    if (this.bombThrowCooldown > 0) {
      this.bombThrowCooldown--;
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
      let distance = this.pos.dist(walker.pos);
      if (distance < minDistance) {
        minDistance = distance;
        nearestWalker = walker;
      }
    }
    
    return nearestWalker;
  }

  isCloseToWalker(walker) {
    return this.pos.dist(walker.pos) < this.size + walker.size;
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
      this.pos.y = getSurfaceYAtX(this.pos.x) - this.size / 2;
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
      if (this.hasGrabbedPod) {
        fill(255, 0, 0);
        ellipse(this.pos.x, this.pos.y - this.size / 2 - 5, pod.size / 2, pod.size / 2);
      }
  }
  
  placeDrillRig() {
  if (energy >= 100) {
    let rigPos = createVector(this.pos.x, getSurfaceYAtX(this.pos.x) - 15);
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
      basePos.y = getSurfaceYAtX(basePos.x);
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
    if (!this.hasGrabbedPod && !pod.isPickedUp() && this.isNearPod()) {
      this.grabPod();
    }
  }

  isNearPod() {
    return dist(this.pos.x, this.pos.y, pod.pos.x, pod.pos.y) < this.size / 2 + pod.size / 2;
  }

  grabPod() {
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
    return this.pos.x > base.pos.x && 
           this.pos.x < base.pos.x + base.width &&
           Math.abs(this.pos.y - (base.pos.y - this.size / 2)) < 20;
  }

  dropOffPod(base) {
    if (!this.hasGrabbedPod) return; // Safety check
    
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
    let shieldPos = createVector(this.pos.x, getSurfaceYAtX(this.pos.x));
    Shield.createShield(shieldPos);
  }

  placeTurret() {
    const MAX_TURRETS = 5; // Maximum number of turrets allowed
    let turretPos = createVector(this.pos.x, getSurfaceYAtX(this.pos.x) - 15);
    
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
      const basePos = this.pos.copy().sub((MoonBase.BASE_WIDTH / 2), 0);
      basePos.y = getSurfaceYAtX(basePos.x);
      new MoonBase(MoonBase.BASE_WIDTH, MoonBase.BASE_HEIGHT, basePos);
      soundManager.play('shipDropOffPod');
      announcer.speak("Base deployed", 0, 1, 1000);
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
    if (cameraFollowsMissile) return;

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
      const surfaceY = getSurfaceYAtX(bulletSpawnPos.x);
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
      const surfaceY = getSurfaceYAtX(bombSpawnPos.x);
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
    if (!this.hasGrabbedPod && !pod.isPickedUp() && this.isNearPod()) {
      this.grabPod();
    }

    if (this.hasGrabbedPod) {
      this.updatePodPosition();
      this.isLanded && this.isOverBase() && this.dropOffPod();
    }
  }

  isNearPod() {
    return dist(this.pos.x, this.pos.y, pod.pos.x, pod.pos.y) < this.size / 2 + pod.size / 2;
  }

  grabPod() {
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
    money += 500;
    energy = Math.min(energy + 10000, maxEnergy);
    this.hasGrabbedPod = false;
    soundManager.play('shipDropOffPod');
    placePodOnSurface();
  }

  updatePodPosition() {
    pod.pos = p5.Vector.add(this.pos, p5.Vector.fromAngle(this.angle + PI, this.size));
  }


  isOverBase() {
    for (const base of MoonBase.moonBases) {
      if (this.pos.x > base.pos.x && this.pos.x < base.pos.x + base.width && Math.abs(this.pos.y - (base.pos.y - this.size / 2)) < 5) {
        return true;
      }
    }
    return false;
  }

  findBaseUnder() {
    for (const base of MoonBase.moonBases) {
      if (this.pos.x > base.pos.x && this.pos.x < base.pos.x + base.width) {
        return base;
      }
    }
    return null;
  }

  getSurfaceY() {
    const base = this.findBaseUnder();
    return base ? base.pos.y : getSurfaceYAtX(this.pos.x);
  }

  placeOnMoonBase() {
    const nearestBase = this.findNearestBase();
    if (nearestBase) {
      const baseCenter = nearestBase.pos.x + nearestBase.width / 2;
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
      const distance = dist(this.pos.x, this.pos.y, base.pos.x + base.width / 2, base.pos.y);
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
    noFill();
    stroke(200, 200, 255);
    strokeWeight(1);
    arc(0, 0, this.parachuteSize, this.parachuteSize, PI, TWO_PI);
    line(-this.parachuteSize / 2, 0, 0, this.size * 1.5);
    line(this.parachuteSize / 2, 0, 0, this.size * 1.5);
    line(-this.parachuteSize / 4, 0, 0, this.size * 1.5);
    line(this.parachuteSize / 4, 0, 0, this.size * 1.5);
    pop();
  }

  applyZapEffect(duration) {
    this.isZapped = true;
    this.zapTimer = duration;
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

class Alien extends Entity {
  static totalAliens = 0;
  static MAX_ALIENS = 100;
  static aliens = [];
  static defaultAttackFrequency = 8200;
  static lastAttackAnnouncementTime = 0;
  static ATTACK_ANNOUNCEMENT_COOLDOWN = 3600;

  constructor(pos, vel, size, shootingRange = 300, colory) {
    super(pos, vel, size);
    this.id = Alien.totalAliens++;
    this.uniqueId = `alien-${this.id}`;
    this.shootCooldown = 0;
    this.hasGrabbedPod = false;
    this.health = 2;
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
  }


  update() {
    super.update();
    this.vel.mult(0.98);
    this.pos.y = constrain(this.pos.y, 0, height);
    this.shootCooldown = Math.max(0, this.shootCooldown - 1);

    if (this.attackMode) {
      if (--this.attackDuration <= 0) {
        this.attackMode = false;
      }
    }

    if (!this.dodgeBullets()) {
      this.updateBehavior();
    }

    if (this.health > 0) {
      this.checkInteractions();
    }
  }

  getStateString() {
    if (this.attackMode) return "Attacking";
    if (this.hasGrabbedPod) return "Carrying Pod";
    if (this.isClosestToPod()) return "Pursuing Pod";
    return "Roaming";
  }

  updateBehavior() {
    const targetPos = this.determineTargetPosition();
    if (!targetPos) return;

    let direction = p5.Vector.sub(targetPos, this.pos).normalize();

    if (this.attackMode) {
      const distanceToTarget = this.pos.dist(targetPos);
      const desiredDistance = random(150, 220);
      const speedFactor = 0.5 * this.speed;

      if (distanceToTarget > desiredDistance + 50) {
        direction.mult(speedFactor);
      } else if (distanceToTarget < desiredDistance - 50) {
        direction.mult(-speedFactor);
      } else {
        direction.rotate(HALF_PI).mult(speedFactor);
      }
    } else {
      direction.mult(0.5 * this.speed);
    }

    this.vel.add(direction).limit(this.speed + 5 * Math.tanh(0.2 * (level - 1)));
  }


  dodgeBullets() {
    const currentTime = frameCount;
    if (currentTime - this.lastDodgeTime < this.dodgeCooldown) {
      return false;
    }

    for (const bullet of Bullet.activeObjects) {
      if (bullet.isPlayerBullet && this.pos.dist(bullet.pos) < 100 && random() < this.dodgeChance) {
        const timeToImpact = this.pos.dist(bullet.pos) / bullet.vel.mag();
        const futurePos = p5.Vector.add(bullet.pos, p5.Vector.mult(bullet.vel, timeToImpact));
        this.vel.add(p5.Vector.sub(this.pos, futurePos).normalize().mult(3)).limit(this.speed * 2);
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
    return this.pos.y < getSurfaceYAtX(this.pos.x);
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

    for (const base of MoonBase.moonBases) {
      if (base) {
        checkTarget(base);
        for (const balloon of base.balloons) {
          checkTarget(balloon);
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
    return Math.max(Alien.defaultAttackFrequency - level * 1000, 1200);
  }

  static updateAliens() {
    if (frameCount % this.calculateAttackInterval() === 0) {
      this.organizeGroupAttack();
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
      announcer.speak(`Coordinated Attack Detected.`, 0, 1, 0);
      this.lastAttackAnnouncementTime = currentTime;
    }

    const target = isWalking ? astronaut : ship;
    if (!target || !target.pos) return;

    const availableAliens = Alien.aliens.filter(alien => !alien.hasGrabbedPod && alien !== Alien.getClosestAlienToPod());

    for (const alien of availableAliens) {
      if (random() < 0.5) {
        alien.attackMode = true;
        alien.attackDuration = random(900, 1800);
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
update() {
  this.updateTarget();
  let distanceToTarget = p5.Vector.dist(this.pos, this.target.pos);

  if (distanceToTarget > this.circlingRadius * 1.2) {
    this.state = 'chase';
    let direction = p5.Vector.sub(this.target.pos, this.pos).normalize().mult(0.7);
    this.vel.add(direction).limit(this.maxSpeed);
  } else {
    this.state = 'circle';
    this.circlingAngle += this.circlingSpeed;
    
    let targetPos = p5.Vector.add(
      this.target.pos,
      p5.Vector.fromAngle(this.circlingAngle).mult(this.circlingRadius)
    );
    
    let direction = p5.Vector.sub(targetPos, this.pos).normalize().mult(0.7);
    this.vel.add(direction).limit(this.maxSpeed * 0.8);
  }

    this.pos.add(this.vel);
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
  if (this.shootCooldown > 0) {
    this.shootCooldown--;
  }
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

  update() {
    super.update();

    if (this.zapCooldown > 0) {
      this.zapCooldown--;
      // Run away from the ship
      let awayFromShip = p5.Vector.sub(this.pos, ship.pos).normalize().mult(this.runAwaySpeed);
      this.vel = awayFromShip;
    } else {
      // Move towards the ship when not on cooldown
      let direction = p5.Vector.sub(ship.pos, this.pos).normalize().mult(0.5);
      this.vel.add(direction).limit(2);

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

  update() {
    this.updatePulse();
    this.updateMovement();
    this.checkShootingOpportunity();
  }

  updatePulse() {
    this.pulsePhase += this.pulseSpeed;
    if (this.pulsePhase > TWO_PI) {
      this.pulsePhase -= TWO_PI;
    }
  }

  updateMovement() {
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
        direction.mult(this.acceleration);
        this.vel.add(direction);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
      } else { // Over target, start shifting
        this.isOverTarget = true;
        this.vel.set(0, 0);
        this.pos.y = targetPos.y; // Maintain hover height

        // Smooth left-right movement using sine function
        this.shiftPhase += this.shiftingSpeed * 0.05;
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
    return possibleTargets.reduce((closest, current) => {
      let d = p5.Vector.dist(this.pos, current.pos);
      return d < closest.dist ? { target: current, dist: d } : closest;
    }, { target: null, dist: Infinity }).target;
  }

  isValidTarget(target) {
    return (target instanceof MoonBase && MoonBase.moonBases.includes(target)) ||
           (target instanceof Turret && turrets.includes(target)) ||
           (target instanceof Shield && Shield.shields.includes(target)) ||
           (target instanceof DrillRig && DrillRig.rigs.includes(target));
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
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }
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
  static MAX_WORMS = 2;
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
    
    debug.log(`Worm spawned at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}) with initial direction: ${this.direction}`);
  }

  update() {
    // Move the head
    let surfaceY = getSurfaceYAtX(this.segments[0].pos.x + this.speed * this.direction);
    this.segments[0].pos.x += this.speed * this.direction;
    this.segments[0].pos.y = surfaceY - this.segments[0].size / 2;

    // Update the rest of the body
    for (let i = 1; i < this.segments.length; i++) {
      let dx = this.segments[i-1].pos.x - this.segments[i].pos.x;
      let dy = this.segments[i-1].pos.y - this.segments[i].pos.y;
      let distance = sqrt(dx*dx + dy*dy);
      if (distance > this.segments[i].size) {
        let angle = atan2(dy, dx);
        this.segments[i].pos.x += cos(angle) * (distance - this.segments[i].size);
        this.segments[i].pos.y += sin(angle) * (distance - this.segments[i].size);
      }
    }

    // Change direction if at world bounds
    if (this.segments[0].pos.x <= 0 || this.segments[0].pos.x >= worldWidth) {
      this.direction *= -1;
    }

    // Update segment angles
    for (let i = 0; i < this.segments.length; i++) {
      if (i === 0) {
        this.segments[i].angle = atan2(this.speed * this.direction, 0);
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
      wormPos.y = getSurfaceYAtX(wormPos.x) - 10;

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
        money += 600;
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

    // Check collision with moon surface
    if (this.checkCollisionWithSurface()) {
      this.active = false;
    }
  }

  checkCollisionWithSurface() {
    for (let i = 0; i < moonSurface.length - 1; i++) {
      if (distToSegment(this.pos, moonSurface[i], moonSurface[i + 1]) < this.size / 2) {
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
           this.checkCollisionWithQueen() ||
           this.checkCollisionWithKing() ||
           this.checkCollisionWithNests();
  }

  checkEnemyBulletCollisions() {
    return this.checkCollisionWithShields() ||
           this.checkCollisionWithShip() ||
           this.checkCollisionWithWingmen() ||
           this.checkCollisionWithMoonBases() ||
           this.checkCollisionWithTurrets() ||
           this.checkCollisionWithAstronaut() ||
           this.checkCollisionWithBarrageBalloons();
  }

checkCollisionWithEntities(entities) {
  for (let entity of entities) {
    if (this.pos.dist(entity.pos) < (entity.size + this.size) / 2) {
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
        if (this.pos.dist(balloon.pos) < (balloon.size + this.size) / 2) {
          balloon.takeDamage(1);
          return true;
        }
      }
    }
    return false;
  }

  checkCollisionWithWorms() {
    for (let worm of AlienWorm.worms) {
      for (let segment of worm.segments) {
        if (this.pos.dist(segment.pos) < (segment.size + this.size) / 2) {
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
        if (this.pos.dist(alienQueen.pos) < (alienQueen.size + this.size) / 2) {
          const damage = this.isPlayerBullet ? Bullet.damageMultiplier : 1;
          alienQueen.takeDamage(damage);
          return true;
    }
    return false;
    }
  }

  checkCollisionWithKing() {
    if (alienKing) {
        if (this.pos.dist(alienKing.pos) < (alienKing.size + this.size) / 2) {
          const damage = this.isPlayerBullet ? Bullet.damageMultiplier : 1;
          alienKing.takeDamage(damage);
          return true;
    }
    return false;
    }
  }

checkCollisionWithNests() {
  for (let nest of Nest.nests) {
    if (this.pos.dist(nest.pos) < (nest.size + this.size) / 2) {
      const damage = this.isPlayerBullet ? Bullet.damageMultiplier : 1;
      nest.health -= damage;
      return true;
    }
  }
  return false;
}

  checkCollisionWithShip() {
  if (!isWalking && !astronaut.ridingWalker) {
    if (this.pos.dist(ship.pos) < (ship.size + this.size) / 2) {
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
    if (wingman.isActive && this.pos.dist(wingman.pos) < (wingman.size + this.size) / 2) {
      wingman.takeDamage(10);
      return true;
    }
  }
  return false;
}

  checkCollisionWithAstronaut() {
    if (isWalking && !astronaut.isInShip && !astronaut.ridingWalker) {
      if (this.pos.dist(astronaut.pos) < (astronaut.size + this.size) / 2) {
        energy -= 100;
        soundManager.play('shipHit');
        return true;
      }
    }
    return false;
  }

  checkCollisionWithMoonBases() {
    for (let base of MoonBase.moonBases) {
      if (this.pos.x > base.pos.x && this.pos.x < base.pos.x + base.width &&
          this.pos.y > base.pos.y && this.pos.y < base.pos.y + base.height) {
        base.health -= 10;
        return true;
      }
    }
    return false;
  }

  checkCollisionWithTurrets() {
    for (let turret of turrets) {
      if (this.pos.dist(turret.pos) < (turret.size + this.size) / 2) {
        turret.health -= 1;
        return true;
      }
    }
    return false;
  }

  checkCollisionWithShields() {
    for (let shield of Shield.shields) {
      if (this.pos.dist(shield.pos) < shield.radius) {
        if (!this.isPlayerBullet) {
          shield.takeDamage(10);
        }
        return true;
      }
    }
    return false;
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
    for (let bullet of Bullet.activeObjects) {
      if (isInView(bullet.pos, bullet.size)) {
        fill(255, 255, 0);
        ellipse(bullet.pos.x, bullet.pos.y, bullet.size, bullet.size);
      }
    }
  }
}

class Bomb extends Entity {
  static defaultExplosionRadius = 30;
  static defaultBombDamage = 3;
  
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
    return this.checkCollision() || this.checkAlienCollision();
  }

  draw() {
    fill(255, 165, 0);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
  }

  checkCollision() {
    for (let i = 0; i < moonSurface.length - 1; i++) {
      let start = moonSurface[i];
      let end = moonSurface[i + 1];
      let d = distToSegment(this.pos, start, end);
      
      if (d < this.size / 2) {
        return true;
      }
    }
    return false;
  }

checkAlienCollision() {
  for (let nest of Nest.nests) {
    if (this.pos.dist(nest.pos) < (this.size + nest.size) / 2) {
      return true;
    }
  }
  
  // Check collision with regular aliens
  for (let alien of Alien.aliens) {
    if (this.pos.dist(alien.pos) < (this.size + alien.size) / 2) {
      return true;
    }
  }

  // Check collision with hunters
  for (let hunter of Hunter.hunters) {
    if (this.pos.dist(hunter.pos) < (this.size + hunter.size) / 2) {
      return true;
    }
  }

  // Check collision with zappers
  for (let zapper of Zapper.zappers) {
    if (this.pos.dist(zapper.pos) < (this.size + zapper.size) / 2) {
      return true;
    }
  }

  // Check collision with destroyers
  for (let destroyer of Destroyer.destroyers) {
    if (this.pos.dist(destroyer.pos) < (this.size + destroyer.size) / 2) {
      return true;
    }
  }

  // Check collision with Queen, adjusting for her size
  if (alienQueen) {
    if (this.pos.dist(alienQueen.pos) < (this.size + alienQueen.size) / 2) {
      return true;
    }
  }
  
    if (alienKing) {
    if (this.pos.dist(alienKing.pos) < (this.size + alienKing.size) / 2) {
      return true;
    }
  }

  // Check collision with alien worms
  for (let worm of AlienWorm.worms) {
    for (let segment of worm.segments) {
      if (this.pos.dist(segment.pos) < (this.size + segment.size) / 2) {
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
   }
  }
  
  adjustNests() {
    for (let nest of Nest.nests) {
      let newY = min(this.getNewSurfaceY(nest.pos.x), height);
      nest.pos.y = newY - nest.size / 2;
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
      if (d < this.explosionRadius) {
        alien.health -= this.bombDamage;
      }
    }
  }

  damageNests() {
    for (let i = Nest.nests.length - 1; i >= 0; i--) {
      let nest = Nest.nests[i];
      let d = dist(this.pos.x, this.pos.y, nest.pos.x, nest.pos.y);
      if (d < this.explosionRadius) {
        nest.health -= this.bombDamage;
      }
    }
  }

  damageDestroyers() {
    for (let i = Destroyer.destroyers.length - 1; i >= 0; i--) {
      let destroyer = Destroyer.destroyers[i];
      let d = dist(this.pos.x, this.pos.y, destroyer.pos.x, destroyer.pos.y);
      if (d < this.explosionRadius) {
        destroyer.health -= this.bombDamage;
      }
    }
  }
  
  damageHunters() {
    for (let i = Hunter.hunters.length - 1; i >= 0; i--) {
      let hunter = Hunter.hunters[i];
      let d = dist(this.pos.x, this.pos.y, hunter.pos.x, hunter.pos.y);
      if (d < this.explosionRadius) {
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

    // Set fill color based on pods collected
    //if (this.podsCollected >= 2) {
    //  fill(50, 255, 50); // Bright green
    //} else if (this.podsCollected === 1) {
    //  fill(150, 210, 150); // Mid green
    //} else {
    //  fill(150, 160, 150); // Grey
    //}
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
      nestPos.y = getSurfaceYAtX(nestPos.x) - 30; // Place nest on surface
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

class Turret extends Entity {
  static  defaultHealth = 4;
  static defaultRange = 200;
  
  constructor(pos) {
    super(pos, createVector(0, 0), 20);
    this.shootCooldown = 0;
    this.maxShootCooldown = 120;
    this.range = Turret.defaultRange;
    this.angle = -PI / 2; // Default angle pointing upwards
    this.health = Turret.defaultHealth;
    this.accuracy = 0.04; // 0.1 = 18 degrees deviation, lower means more accurate
  }

  update() {
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }
    let closestTarget = this.findClosestTarget();
    if (closestTarget) {
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
      'alienShooting', 'gameOver', 'nextLevel', 'alienPodPickup',
      'alienPodDropOff', 'alienDestruction', 'nestDestruction','teleport',
      'moonBaseDestruction', 'hunterSpawned','zapperSpawned', 'wormDead','destroyerSpawned',
      'shipBomb', 'meteorImpact','diamondImpact','earthquake','astronautJump','missileImpact','nestBurstDefense','balloonPop','warning'
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
      alienPodDropOff: 2, alienDestruction: 3, nestDestruction: 4,walkerShoot: 2,
      moonBaseDestruction: 5, teleport: 5, hunterSpawned: 2, destroyerSpawned: 2, zapperSpawned: 2,earthquake: 4,
      shipBomb: 4, meteorImpact: 1, wormDead: 4, astronautJump: 4, nestBurstDefense: 1, balloonPop: 3,diamondImpact: 1,missileLaunch: 3, missileImpact: 5,warning: 3
    };
    return priorities[soundName] || 1;
  }

  getVolume(soundName) {
    const volumes = {
      shipThrust: 0.2, missileLaunch: 0.5, diamondImpact: 0.6, hunterSpawned: 0.8, destroyerSpawned: 0.8, walkerShoot: 0.2, warning: 0.5
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

class AlienPlant extends Entity {
  static plants = [];
  static maxPlants = 50;
  static clusterCenters = [];
  static maxClusters = 10;
  static spawnInterval = 5000; // ms
  static lastSpawnTime = 0;
  static normalGrowthRate = [0.008, 0.02];
  static enhancedGrowthRate = [0.03, 0.06]; // faster growth during diamond rain

  constructor(pos, size, clusterColor) {
    super(pos, createVector(0, 0), size);
    this.maxSize = size;
    this.currentSize = 5;
    this.growthRate = random(AlienPlant.normalGrowthRate[0], AlienPlant.normalGrowthRate[1]);
    this.health = 100;
    this.decayRate = random(0.01, 0.03);
    this.color = this.generateColor(clusterColor);
    this.shape = this.generateShape();
    this.fullyGrown = false;
    this.isDecaying = false;
    this.decayChance = 0.0005; // 0.05% chance to start decaying each update
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
    this.targetPos.y = getSurfaceYAtX(this.pos.x) - this.currentSize / 2;
    // Smoothly interpolate towards the target position
    this.pos.y = lerp(this.pos.y, this.targetPos.y, 0.1);
  }

update() {
  if (!this.isDecaying) {
    if (this.currentSize < this.maxSize) {
      let growthRate = DiamondRain.isActive ? 
        random(AlienPlant.enhancedGrowthRate[0], AlienPlant.enhancedGrowthRate[1]) :
        this.growthRate;
      this.currentSize += growthRate;
      
      // Check for decay chance
      if (random() < this.decayChance) {
        this.isDecaying = true;
      }
      
      // Check if the plant has just reached full growth
      if (this.currentSize >= this.maxSize && !this.fullyGrown) {
        this.fullyGrown = true;
        this.createNest();
      }
    }
  }
  
  this.updatePosition(); // Move this line here, outside of all conditions
  
  if (this.isDecaying || this.currentSize >= this.maxSize) {
    this.health -= this.decayRate;
  }

  if (this.health <= 0) {
    this.destroy();
  }
}

  createNest() {
    let nestPos = this.pos.copy();
    nestPos.y = getSurfaceYAtX(nestPos.x) - 30; // Place nest on surface
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
    let size = random(10, 50);
    pos.y = getSurfaceYAtX(pos.x) - size; // Position the bottom of the plant on the surface

    // Prefer lower areas
    let attempts = 0;
    while (attempts < 5 && pos.y < clusterCenter.y - size) {
      pos.x = clusterCenter.x + random(-100, 100);
      pos.y = getSurfaceYAtX(pos.x) - size;
      attempts++;
    }

    AlienPlant.plants.push(new AlienPlant(pos, size, clusterCenter.color));
  }

  static createNewCluster() {
    if (AlienPlant.clusterCenters.length >= AlienPlant.maxClusters) return;

    let pos = createVector(random(worldWidth), 0);
    pos.y = getSurfaceYAtX(pos.x);

    // Find a low point
    let attempts = 0;
    let lowestY = pos.y;
    let lowestPos = pos.copy();
    while (attempts < 10) {
      pos.x = random(worldWidth);
      pos.y = getSurfaceYAtX(pos.x);
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
    money += 50;
  }
}

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
        announcer.speak("Commander, diamond rain is approaching.",0, 1);
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
    // Check collision with aliens, nests, etc.
    let targets = [...(alienKing ? [alienKing] : []),...(alienQueen ? [alienQueen] : []), ...Alien.aliens, ...Nest.nests, ...Hunter.hunters, ...Destroyer.destroyers, ...Zapper.zappers];
    for (let target of targets) {
      if (this.pos.dist(target.pos) < (this.size + target.size) / 2) {
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
  let targets = [...(alienKing ? [alienKing] : []), ...(alienQueen ? [alienQueen] : []), ...Alien.aliens, ...Nest.nests, ...Hunter.hunters, ...Destroyer.destroyers, ...Zapper.zappers, ...MoonBase.moonBases];
  
  for (let target of targets) {
    // Adjust distance check to include the target's size
    let distance = this.pos.dist(target.pos);
    let adjustedRadius = this.explosionRadius + target.size / 2; // Add half of target's size to the explosion radius

    // Check if target is within the adjusted explosion radius
    if (distance < adjustedRadius) {
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
    if (this.pos.dist(worm.segments[0].pos) < this.explosionRadius) {
      worm.takeDamage(this.damage);
    }
  }

  // Destroy AlienPlants
  AlienPlant.checkCollisionWithBomb(this);
}


  static launchMissile() {
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
    let surfaceY = getSurfaceYAtX(this.anchorX);

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
    let surfaceY = getSurfaceYAtX(this.anchorX);
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
  let alienTypes = [Alien.aliens, Hunter.hunters, Zapper.zappers, Destroyer.destroyers];
  for (let alienGroup of alienTypes) {
    for (let i = alienGroup.length - 1; i >= 0; i--) {
      let alien = alienGroup[i];
      if (this.pos.dist(alien.pos) < (this.size + alien.size) / 2) {
        
        // Damadge the alien
        alien.health -= 5;
        money += 50;
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
      if (this.pos.dist(segment.pos) < (this.size + segment.size) / 2) {
        // Damage the worm
        if (worm.takeDamage(2)) { // Assuming 2 damage per collision
          AlienWorm.worms.splice(i, 1);
          money += 600; // Using the same score as when a worm is destroyed elsewhere
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
      //explosions.push(new Explosion(this.pos, this.explosionRadius * 2, color(200, 200, 0), color(150, 150, 0)));
    

  }
  
}


class Upgrades {
  constructor() {
    this.availableUpgrades = {
      energyCharge: { cost: 5000, level: 0, maxLevel: 1000, description: "Energy Charge +10000" },
      energyCapacity: { cost: 3000, level: 0, maxLevel: 5, description: "Upgrade Energy Capacity" },
      shipSpeed: { cost: 1000, level: 0, maxLevel: 5, description: "Increase ship speed" },
      bulletDamage: { cost: 1500, level: 0, maxLevel: 3, description: "Increase bullet damage" },
      shieldNumber: { cost: 2500, level: 0, maxLevel: 6, description: "Upgrade No. Shields" },
      turret: { cost: 1800, level: 0, maxLevel: 4, description: "Upgrade Turret" },
      barrageBalloon: { cost: 1000, level: 0, maxLevel: 8, description: "Upgrade Barrage Balloons" },
      cruiseMissile: { cost: 1800, level: 0, maxLevel: 5, description: "Upgrade Cruise Missile" },
      wingMan: { cost: 5000, level: 0, maxLevel: 2, description: "Upgrade No. Wingmen" },
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
      upgrade.cost = Math.floor(upgrade.cost * 1.9); // Increase cost for next level
      this.applyUpgrade(upgradeName);
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
    // Revert all upgrade effects to their initial values
    ship.thrustPower = 0.1;
    ship.rotationSpeed = 0.05;
    maxEnergy = 15000;
    Shield.MAX_SHIELDS = 3;
    Turret.defaultHealth = 4;
    Turret.defaultRange = 200;
    MoonBase.maxBalloons = 0;
    Bullet.damageMultiplier = 1;
    Bomb.defaultExplosionRadius = 50;
    Bomb.defaultBombDamage = 3;
    Wingman.MAX_WINGMEN = 1;
    Missile.defaultExplosionRadius = 100;
    Missile.defaultDamage = 5;
    WalkerRobot.SHOOT_SPEED = 50;
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
      case 'shipSpeed':
        ship.thrustPower += 0.02;
        ship.rotationSpeed += 0.01;
        break;
      case 'bulletDamage':
        Bullet.damageMultiplier += 0.5;
        break;
      case 'bombDamage':
        Bomb.defaultExplosionRadius += 25;
        Bomb.defaultBombDamage += 1;
        break;      
      case 'shieldNumber':
        Shield.MAX_SHIELDS += 1;
        break;
      case 'turret':
        Turret.defaultHealth += 2;
        Turret.defaultRange += 100;      
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
          announcer.speak(`${upgradeName} upgraded`,0, 2);
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

class EarthquakeManager {
  constructor() {
    this.cameraShake = createVector(0, 0);
    this.isEarthquake = false;
    this.earthquakeIntensity = 0;
    this.earthquakeWarningTimer = 0;
    this.earthquakeDuration = 0;
    this.maxEarthquakeIntensity = 8;
    this.earthquakeProbability = 0.00005; // Adjust as needed 0.00005
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
    this.earthquakeDuration = random(100,300); // 2-5 seconds at 60 fps
    soundManager.play('earthquake');
    this.damageSurfaceEntities();
  }

  damageSurfaceEntities(){
    for (let i = MoonBase.moonBases.length - 1; i >= 0; i--) {
      let base = MoonBase.moonBases[i];
       base.health -= 50;
    }
    for (let nest of Nest.nests) {
        nest.health -= 2;
      }  
    
        for (let rig of DrillRig.rigs) {
        rig.health -= 50;
      } 
    
     if (RescueMission.strandedAstronaut){
       RescueMission.strandedAstronaut.takeDamage(50);
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
      return this.maxEarthquakeIntensity * (progress / 0.2);
    } else if (progress > 0.8) {
      // Ramp down
      return this.maxEarthquakeIntensity * (1 - (progress - 0.8) / 0.2);
    } else {
      // Peak intensity
      return this.maxEarthquakeIntensity;
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

class Wingman extends Ship {
  static wingmen = [];
  static MAX_WINGMEN = 1;
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
      const distanceToPlayer = this.pos.dist(playerPos);

      if (nearestEnemy && this.pos.dist(nearestEnemy.pos) < this.attackRange) {
        this.state = 'attack';
        this.targetPosition = nearestEnemy.pos;
      } else if (distanceToPlayer > this.defendRange) {
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
    
    for (let other of [...Alien.aliens, ...Hunter.hunters, ...Zapper.zappers, ...Destroyer.destroyers]) {
      let d = p5.Vector.dist(this.pos, other.pos);
      if (d > 0 && d < desiredSeparation) {
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
  const surfaceY = getSurfaceYAtX(futurePos.x);
  
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
 
  let distanceToTarget = this.pos.dist(this.currentTarget.pos);
  let angleToTarget = p5.Vector.sub(this.currentTarget.pos, this.pos).heading();
  let angleDifference = (angleToTarget - this.angle + TWO_PI) % TWO_PI;
  if (angleDifference > PI) angleDifference = TWO_PI - angleDifference;
 
  return distanceToTarget <= this.attackRange && angleDifference < 0.3;
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
      if (this.pos.dist(alien.pos) < (this.size + alien.size) / 2) {
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
    const nearSurface = this.pos.y + this.size / 2 > getSurfaceYAtX(this.pos.x) - 10;
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
    let minDist = Infinity;
    const enemies = [...Alien.aliens, ...Hunter.hunters, ...Zapper.zappers, ...Destroyer.destroyers];
    
    for (let enemy of enemies) {
      const dist = this.pos.dist(enemy.pos);
      if (dist < minDist && dist < this.attackRange) {
        minDist = dist;
        nearest = enemy;
      }
    }
    
    return nearest;
  }

  findBombTarget() {
    let targets = [...Nest.nests, ...AlienWorm.worms];
    let nearestTarget = null;
    let minDist = Infinity;

    for (let target of targets) {
      let targetPos = target instanceof AlienWorm ? target.segments[1].pos : target.pos;
      let dist = this.pos.dist(targetPos);
      if (dist < minDist && dist < this.attackRange) {
        minDist = dist;
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
    return getSurfaceYAtX(this.pos.x);
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
  const surfaceY = getSurfaceYAtX(this.pos.x);
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
        if (this.pos.dist(segment.pos) < (this.size + segment.size) / 2) {
          this.takeDamage(1);
          break;
        }
      }
    }

    // Check collisions with alien bullets
    for (let bullet of Bullet.activeObjects) {
      if (!bullet.isPlayerBullet && this.pos.dist(bullet.pos) < (this.size + bullet.size) / 2) {
        this.takeDamage(10);
        Bullet.recycle(bullet);
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
      oldestRig.destroy();
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



class WalkerRobot extends Entity {
  static walkerCounter = 0;
  static walkers = [];
  static MAX_WALKERS = 3;
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
    this.legSpeed = 0.1;
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
  }

  update() {
    this.move();
    this.shoot();
    this.checkBulletCollision();
    this.updateLegPhase();
    
    if (this.rider) {
      this.updateRiderPosition();
    }
  }

  move() {
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
      // Reverse direction
      this.direction *= -1;
      // Recalculate new position
      newX = this.pos.x + (this.speed * this.direction);
      if (newX < 0) newX = worldWidth;
      if (newX > worldWidth) newX = 0;
      this.updateSurfacePoints(newX);
      newY = this.calculateNewYPosition(newX);
    }

    // Update position
    this.pos.x = newX;
    this.pos.y = newY;

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
      this.surfacePoints.push({x: x, y: getSurfaceYAtX(x)});
    }
  }

  calculateNewYPosition(newX) {
    // Find the two closest points
    let leftPoint = this.surfacePoints[2]; // Center point
    let rightPoint = this.surfacePoints[3];
    
    // Interpolate Y position
    let t = (newX - leftPoint.x) / (rightPoint.x - leftPoint.x);
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
    }
  }

  findTarget() {
    let targets = [
      ...(Alien.aliens || []),
      ...(Nest.nests || [])
    ];
    
    // Include worm segments as individual targets
    for (let worm of AlienWorm.worms) {
      targets.push(...worm.segments);
    }

    let closestTarget = null;
    let closestDistance = this.shootRange;

    for (let target of targets) {
      if (target && target.pos) {
        let distance = this.pos.dist(target.pos);
        if (distance < closestDistance) {
          closestTarget = target;
          closestDistance = distance;
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

    // Debug: Draw surface points
    if (debug.isEnabled) {
      push();
      noStroke();
      fill(255, 0, 0);
      for (let point of this.surfacePoints) {
        ellipse(point.x, point.y, 4, 4);
      }
      pop();
    }
  }

  drawLegs() {
    this.drawLeg(-10, 0, this.legPhase);
    this.drawLeg(10, 0, this.legPhase - Math.PI);
    this.drawLeg(10, 0, this.legPhase- - Math.PI/2);
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
      if (!bullet.isPlayerBullet && this.pos.dist(bullet.pos) < (this.size + bullet.size) / 2) {
        this.takeDamage(10);
        Bullet.recycle(bullet);
        return true;
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
  }
}