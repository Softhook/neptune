/**
 * Astronaut Entity - Refactored from classes.js
 * Player-controlled astronaut with walking mechanics
 */

import BaseEntity from './BaseEntity.js';
import eventSystem, { GameEvents } from '../core/EventSystem.js';
import stateManager from '../core/StateManager.js';
import configManager from '../core/ConfigManager.js';

class Astronaut extends BaseEntity {
  constructor(pos, vel = null, size = 15) {
    super(pos, vel, size);
    
    // Astronaut-specific properties
    this.walkSpeed = 2;
    this.jumpPower = 7;
    this.oxygenCapacity = 100;
    this.oxygen = this.oxygenCapacity;
    this.oxygenDepletionRate = 0.05;
    
    // Movement state
    this.isGrounded = false;
    this.isWalking = false;
    this.walkDirection = 0; // -1 left, 0 stop, 1 right
    this.isJumping = false;
    this.walkAnimationPhase = 0;
    
    // Equipment
    this.hasJetpack = false;
    this.jetpackFuel = 0;
    this.maxJetpackFuel = 50;
    this.jetpackThrust = 0.15;
    
    // Pod carrying
    this.hasGrabbedPod = false;
    this.grabbedPod = null;
    this.carryingWeight = 0;
    
    // Walker robot interaction
    this.mountedWalker = null;
    this.isMounted = false;
    
    // Visual properties
    this.spriteFrame = 0;
    this.animationTimer = 0;
    this.facingDirection = 1; // 1 for right, -1 for left
    
    // Surface tracking
    this.surfacePoints = [];
    this.currentSurfaceY = 0;
    
    // Initialize
    this.health = 100;
    this.maxHealth = 100;
    this.gravityScale = 1;
  }
  
  onUpdate() {
    this.updateOxygen();
    this.updateMovement();
    this.updateSurfaceTracking();
    this.updateAnimation();
    this.updateEquipment();
    this.checkInteractions();
    this.checkHazards();
  }
  
  updateOxygen() {
    // Deplete oxygen over time
    this.oxygen = Math.max(0, this.oxygen - this.oxygenDepletionRate);
    
    // Take damage if out of oxygen
    if (this.oxygen <= 0) {
      this.takeDamage(0.5);
      
      // Emit low oxygen warning
      if (Math.floor(this.age / 120) % 2 === 0) { // Every 2 seconds
        eventSystem.emit('astronaut:lowOxygen', { oxygen: this.oxygen });
      }
    }
    
    // Regenerate oxygen near bases or walker
    if (this.isNearOxygenSource()) {
      this.oxygen = Math.min(this.oxygenCapacity, this.oxygen + 0.2);
    }
  }
  
  updateMovement() {
    // Handle walking
    if (this.walkDirection !== 0 && this.isGrounded) {
      this.vel.x = this.walkSpeed * this.walkDirection;
      this.isWalking = true;
      this.facingDirection = this.walkDirection;
    } else {
      this.vel.x *= 0.8; // Friction
      this.isWalking = false;
    }
    
    // Handle jumping
    if (this.isJumping && this.isGrounded) {
      this.vel.y = -this.jumpPower;
      this.isGrounded = false;
      this.isJumping = false;
      
      // Play jump sound
      if (typeof soundManager !== 'undefined') {
        soundManager.play('astronautJump');
      }
      
      eventSystem.emit('astronaut:jumped');
    }
    
    // Handle jetpack
    if (this.hasJetpack && this.jetpackFuel > 0) {
      this.updateJetpack();
    }
    
    // Update carrying weight effect
    if (this.hasGrabbedPod) {
      this.vel.x *= 0.7; // Slower when carrying pod
      this.gravityScale = 1.2; // Heavier when carrying
    } else {
      this.gravityScale = 1;
    }
  }
  
  updateJetpack() {
    // Apply jetpack thrust (simplified - actual input would come from InputManager)
    if (this.usingJetpack && this.jetpackFuel > 0) {
      this.vel.y -= this.jetpackThrust;
      this.jetpackFuel = Math.max(0, this.jetpackFuel - 0.5);
      
      // Create jetpack particles
      this.createJetpackParticles();
    }
    
    // Regenerate jetpack fuel slowly
    if (!this.usingJetpack && this.jetpackFuel < this.maxJetpackFuel) {
      this.jetpackFuel = Math.min(this.maxJetpackFuel, this.jetpackFuel + 0.1);
    }
  }
  
  updateSurfaceTracking() {
    if (typeof moonSurface === 'undefined') return;
    
    // Find ground level at current position
    this.currentSurfaceY = this.getSurfaceYAtX(this.pos.x);
    
    // Check if grounded
    if (this.pos.y >= this.currentSurfaceY - this.size/2 && this.vel.y >= 0) {
      this.isGrounded = true;
      this.pos.y = this.currentSurfaceY - this.size/2;
      this.vel.y = 0;
    } else {
      this.isGrounded = false;
    }
  }
  
  updateAnimation() {
    this.animationTimer++;
    
    if (this.isWalking && this.isGrounded) {
      // Walking animation
      this.walkAnimationPhase = (this.walkAnimationPhase + 0.2) % (Math.PI * 2);
      if (this.animationTimer % 8 === 0) {
        this.spriteFrame = (this.spriteFrame + 1) % 4; // 4 walking frames
      }
    } else if (!this.isGrounded) {
      // Jumping/falling animation
      this.spriteFrame = 4; // Jump frame
    } else {
      // Idle animation
      this.spriteFrame = 0;
    }
  }
  
  updateEquipment() {
    // Update pod position if carrying
    if (this.hasGrabbedPod && this.grabbedPod) {
      this.grabbedPod.pos.x = this.pos.x;
      this.grabbedPod.pos.y = this.pos.y - this.size;
    }
  }
  
  checkInteractions() {
    this.checkPodInteraction();
    this.checkBaseInteraction();
    this.checkWalkerInteraction();
  }
  
  checkPodInteraction() {
    if (typeof pod !== 'undefined' && !pod.collected && !this.hasGrabbedPod) {
      const distance = this.distanceTo(pod);
      if (distance < this.size + pod.size) {
        this.grabPod(pod);
      }
    }
  }
  
  checkBaseInteraction() {
    if (!this.hasGrabbedPod) return;
    
    if (typeof entityManager !== 'undefined') {
      const bases = entityManager.getCollection('bases');
      for (const base of bases) {
        if (this.isOverBase(base)) {
          this.dropOffPod(base);
          break;
        }
      }
    }
  }
  
  checkWalkerInteraction() {
    if (this.isMounted) return;
    
    if (typeof entityManager !== 'undefined') {
      const walkers = entityManager.getCollection('walkers');
      for (const walker of walkers) {
        const distance = this.distanceTo(walker);
        if (distance < this.size + walker.size && walker.canMount) {
          // Allow mounting (actual mounting would be triggered by input)
          walker.showMountPrompt = true;
        } else {
          walker.showMountPrompt = false;
        }
      }
    }
  }
  
  checkHazards() {
    // Check for environmental hazards
    this.checkSurfaceCollision();
    this.checkEnemyCollisions();
    this.checkWeatherHazards();
  }
  
  checkSurfaceCollision() {
    // Check if inside terrain (shouldn't happen with proper surface tracking)
    if (this.pos.y > this.currentSurfaceY + this.size/2) {
      this.pos.y = this.currentSurfaceY - this.size/2;
      this.vel.y = 0;
    }
  }
  
  checkEnemyCollisions() {
    if (typeof entityManager === 'undefined') return;
    
    const enemies = [
      ...entityManager.getCollection('aliens'),
      ...entityManager.getCollection('hunters'),
      ...entityManager.getCollection('zappers')
    ];
    
    for (const enemy of enemies) {
      if (this.collidesWith(enemy)) {
        this.takeDamage(15, enemy);
        // Knockback
        const angle = this.angleTo(enemy) + Math.PI;
        this.vel.x += Math.cos(angle) * 2;
        this.vel.y += Math.sin(angle) * 2;
        break;
      }
    }
  }
  
  checkWeatherHazards() {
    // Check for weather-related damage
    if (typeof methaneBlizzard !== 'undefined' && methaneBlizzard.isActive) {
      if (Math.random() < 0.01) { // 1% chance per frame during blizzard
        this.takeDamage(1);
      }
    }
  }
  
  getSurfaceYAtX(x) {
    if (typeof getCachedSurfaceYAtX !== 'undefined') {
      return getCachedSurfaceYAtX(x);
    } else if (typeof getSurfaceYAtX !== 'undefined') {
      return getSurfaceYAtX(x);
    }
    return 400; // Fallback
  }
  
  isNearOxygenSource() {
    // Check if near moon base
    if (typeof entityManager !== 'undefined') {
      const bases = entityManager.getCollection('bases');
      for (const base of bases) {
        if (this.distanceTo(base) < base.width) {
          return true;
        }
      }
    }
    
    // Check if mounted on walker
    if (this.isMounted && this.mountedWalker) {
      return true;
    }
    
    return false;
  }
  
  grabPod(podEntity) {
    this.hasGrabbedPod = true;
    this.grabbedPod = podEntity;
    podEntity.collected = true;
    podEntity.carrier = this;
    
    // Play grab sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('podGrabbed');
    }
    
    eventSystem.emit('astronaut:grabbedPod', { pod: podEntity });
  }
  
  dropOffPod(base) {
    if (!this.hasGrabbedPod || !this.grabbedPod) return;
    
    // Add energy reward
    const energyReward = 1000;
    const currentEnergy = stateManager.get('energy') || 0;
    const maxEnergy = stateManager.get('maxEnergy') || 15000;
    stateManager.set('energy', Math.min(maxEnergy, currentEnergy + energyReward));
    
    // Clean up pod
    this.grabbedPod.shouldRemove = true;
    this.hasGrabbedPod = false;
    this.grabbedPod = null;
    
    // Play dropoff sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('podDelivered');
    }
    
    eventSystem.emit('astronaut:deliveredPod', { 
      base: base, 
      energyReward: energyReward 
    });
  }
  
  isOverBase(base) {
    return this.pos.x > base.pos.x &&
           this.pos.x < base.pos.x + base.width &&
           Math.abs(this.pos.y - (base.pos.y - this.size / 2)) < 20;
  }
  
  mountWalker(walker) {
    if (this.isMounted) return false;
    
    this.isMounted = true;
    this.mountedWalker = walker;
    this.visible = false; // Hide astronaut when mounted
    walker.mountedAstronaut = this;
    
    // Transfer to walker position
    this.pos.x = walker.pos.x;
    this.pos.y = walker.pos.y - walker.size/2;
    
    eventSystem.emit('astronaut:mounted', { walker: walker });
    return true;
  }
  
  dismountWalker() {
    if (!this.isMounted) return false;
    
    const walker = this.mountedWalker;
    this.isMounted = false;
    this.mountedWalker = null;
    this.visible = true;
    
    if (walker) {
      walker.mountedAstronaut = null;
      // Position astronaut next to walker
      this.pos.x = walker.pos.x + walker.size;
      this.pos.y = walker.pos.y;
    }
    
    eventSystem.emit('astronaut:dismounted', { walker: walker });
    return true;
  }
  
  createJetpackParticles() {
    // Create jetpack exhaust particles
    const exhaustX = this.pos.x;
    const exhaustY = this.pos.y + this.size/2;
    
    for (let i = 0; i < 3; i++) {
      const particle = {
        x: exhaustX + (Math.random() - 0.5) * this.size/2,
        y: exhaustY,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1,
        life: 20,
        maxLife: 20,
        color: [0, 100, 255],
        size: Math.random() * 2 + 1
      };
      
      if (typeof entityManager !== 'undefined') {
        entityManager.addEntity('particles', particle);
      }
    }
  }
  
  onDraw() {
    if (!this.visible) return; // Don't draw when mounted
    
    // Draw oxygen indicator if low
    if (this.oxygen < this.oxygenCapacity * 0.3) {
      this.drawOxygenIndicator();
    }
    
    // Draw astronaut sprite
    this.drawAstronautSprite();
    
    // Draw jetpack if equipped
    if (this.hasJetpack) {
      this.drawJetpack();
    }
    
    // Draw carrying indicator
    if (this.hasGrabbedPod) {
      this.drawCarryingIndicator();
    }
  }
  
  drawOxygenIndicator() {
    const indicatorWidth = this.size * 1.5;
    const indicatorHeight = 3;
    const indicatorY = -this.size/2 - 15;
    
    // Background
    noFill();
    stroke(255, 255, 0);
    rect(-indicatorWidth/2, indicatorY, indicatorWidth, indicatorHeight);
    
    // Oxygen level
    const oxygenPercent = this.oxygen / this.oxygenCapacity;
    fill(oxygenPercent > 0.3 ? color(0, 255, 255) : color(255, 0, 0));
    noStroke();
    rect(-indicatorWidth/2, indicatorY, indicatorWidth * oxygenPercent, indicatorHeight);
  }
  
  drawAstronautSprite() {
    // Simple astronaut representation
    push();
    scale(this.facingDirection, 1); // Flip sprite based on direction
    
    // Body
    fill(200, 200, 200);
    stroke(255);
    strokeWeight(1);
    rect(-this.size/3, -this.size/3, this.size/1.5, this.size * 0.8);
    
    // Helmet
    fill(150, 150, 200, 180);
    circle(0, -this.size/3, this.size/2);
    
    // Legs animation
    if (this.isWalking) {
      const legOffset = Math.sin(this.walkAnimationPhase) * 3;
      // Left leg
      stroke(180, 180, 180);
      strokeWeight(3);
      line(-this.size/6, this.size/3, -this.size/6 + legOffset, this.size/2 + 5);
      // Right leg
      line(this.size/6, this.size/3, this.size/6 - legOffset, this.size/2 + 5);
    } else {
      // Static legs
      stroke(180, 180, 180);
      strokeWeight(3);
      line(-this.size/6, this.size/3, -this.size/6, this.size/2 + 5);
      line(this.size/6, this.size/3, this.size/6, this.size/2 + 5);
    }
    
    pop();
  }
  
  drawJetpack() {
    // Simple jetpack on back
    fill(100, 100, 100);
    stroke(150);
    strokeWeight(1);
    rect(-this.size/4, -this.size/4, this.size/2, this.size/3);
    
    // Fuel indicator
    if (this.jetpackFuel < this.maxJetpackFuel * 0.5) {
      const fuelPercent = this.jetpackFuel / this.maxJetpackFuel;
      fill(255, 255 * (1 - fuelPercent), 0);
      noStroke();
      rect(-this.size/6, -this.size/6, this.size/3 * fuelPercent, 3);
    }
  }
  
  drawCarryingIndicator() {
    // Show carrying icon above astronaut
    fill(255, 255, 0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(8);
    text('📦', 0, -this.size - 10);
  }
  
  onDestroyed(source) {
    super.onDestroyed(source);
    
    // Drop pod if carrying
    if (this.hasGrabbedPod && this.grabbedPod) {
      this.grabbedPod.collected = false;
      this.grabbedPod.carrier = null;
    }
    
    // Dismount walker if mounted
    if (this.isMounted) {
      this.dismountWalker();
    }
    
    // Switch back to ship mode
    stateManager.set('isWalking', false);
    
    eventSystem.emit(GameEvents.PLAYER_DEATH, { 
      mode: 'astronaut',
      cause: source?.constructor?.name 
    });
  }
  
  serialize() {
    return {
      ...super.serialize(),
      oxygen: this.oxygen,
      hasJetpack: this.hasJetpack,
      jetpackFuel: this.jetpackFuel,
      hasGrabbedPod: this.hasGrabbedPod,
      isMounted: this.isMounted,
      facingDirection: this.facingDirection
    };
  }
  
  deserialize(data) {
    super.deserialize(data);
    this.oxygen = data.oxygen || this.oxygenCapacity;
    this.hasJetpack = data.hasJetpack || false;
    this.jetpackFuel = data.jetpackFuel || 0;
    this.hasGrabbedPod = data.hasGrabbedPod || false;
    this.isMounted = data.isMounted || false;
    this.facingDirection = data.facingDirection || 1;
  }
}

export default Astronaut;