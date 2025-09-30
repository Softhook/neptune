/**
 * Ship Entity - Refactored from classes.js
 * Player-controlled ship with enhanced base functionality
 */

import BaseEntity from './BaseEntity.js';
import eventSystem, { GameEvents } from '../core/EventSystem.js';
import stateManager from '../core/StateManager.js';
import configManager from '../core/ConfigManager.js';

class Ship extends BaseEntity {
  constructor(pos, vel = null, size = 20) {
    super(pos, vel, size);
    
    // Ship-specific properties
    this.fuelCapacity = 100;
    this.fuel = this.fuelCapacity;
    this.thrust = 0.2;
    this.maxThrust = 0.5;
    this.rotationSpeed = 0.05;
    this.landingSpeed = 2;
    this.isLanded = false;
    this.landedBase = null;
    this.engineSound = false;
    
    // Visual properties
    this.exhaustParticles = [];
    this.shieldRadius = 0;
    this.shieldActive = false;
    
    // Weapon systems
    this.canShoot = true;
    this.shootCooldown = 0;
    this.bulletSpeed = 8;
    this.lastShotTime = 0;
    this.shootingRate = 150; // milliseconds between shots
    
    // Ship state
    this.boosting = false;
    this.turningLeft = false;
    this.turningRight = false;
    
    // Initialize with full health and energy
    this.health = 100;
    this.maxHealth = 100;
  }
  
  onUpdate() {
    this.updateMovement();
    this.updateWeapons();
    this.updateVisualEffects();
    this.updateSounds();
    this.checkLanding();
    this.checkCollisions();
  }
  
  updateMovement() {
    // Handle input (will be integrated with InputManager later)
    if (this.boosting) {
      this.applyThrust();
    }
    
    if (this.turningLeft) {
      this.rotation -= this.rotationSpeed;
    }
    
    if (this.turningRight) {
      this.rotation += this.rotationSpeed;
    }
    
    // Consume fuel when thrusting
    if (this.boosting && this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - 0.1);
    }
    
    // Regenerate fuel slowly when not thrusting
    if (!this.boosting && this.fuel < this.fuelCapacity) {
      this.fuel = Math.min(this.fuelCapacity, this.fuel + 0.05);
    }
  }
  
  applyThrust() {
    if (this.fuel <= 0) return;
    
    const thrustX = Math.cos(this.rotation) * this.thrust;
    const thrustY = Math.sin(this.rotation) * this.thrust;
    
    this.applyForce(thrustX, thrustY);
    
    // Create exhaust particles
    this.createExhaustParticles();
  }
  
  createExhaustParticles() {
    // Create exhaust particle behind ship
    const exhaustX = this.pos.x - Math.cos(this.rotation) * this.size;
    const exhaustY = this.pos.y - Math.sin(this.rotation) * this.size;
    
    const particle = {
      x: exhaustX,
      y: exhaustY,
      vx: -Math.cos(this.rotation) * 2 + (Math.random() - 0.5),
      vy: -Math.sin(this.rotation) * 2 + (Math.random() - 0.5),
      life: 30,
      maxLife: 30,
      size: Math.random() * 3 + 2
    };
    
    this.exhaustParticles.push(particle);
    
    // Limit particle count
    if (this.exhaustParticles.length > 20) {
      this.exhaustParticles.shift();
    }
  }
  
  updateWeapons() {
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }
    
    this.canShoot = this.shootCooldown <= 0;
  }
  
  updateVisualEffects() {
    // Update exhaust particles
    for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
      const particle = this.exhaustParticles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;
      
      if (particle.life <= 0) {
        this.exhaustParticles.splice(i, 1);
      }
    }
    
    // Update shield
    if (this.shieldActive && this.shieldRadius > 0) {
      this.shieldRadius = Math.max(0, this.shieldRadius - 1);
      if (this.shieldRadius <= 0) {
        this.shieldActive = false;
      }
    }
  }
  
  updateSounds() {
    // Engine sound management
    if (this.boosting && this.fuel > 0) {
      if (!this.engineSound && typeof soundManager !== 'undefined') {
        soundManager.loopIfNotPlaying('shipEngine');
        this.engineSound = true;
      }
    } else {
      if (this.engineSound && typeof soundManager !== 'undefined') {
        soundManager.stop('shipEngine');
        this.engineSound = false;
      }
    }
  }
  
  checkLanding() {
    if (!this.isLanded && this.vel.y > 0 && this.vel.y < this.landingSpeed) {
      // Check if over a landing base
      if (typeof entityManager !== 'undefined') {
        const bases = entityManager.getCollection('bases');
        for (const base of bases) {
          if (this.isOverBase(base)) {
            this.landOnBase(base);
            break;
          }
        }
      }
    }
  }
  
  checkCollisions() {
    // Surface collision
    if (this.checkSurfaceCollision()) {
      this.handleCrash();
    }
    
    // Enemy collision
    this.checkEnemyCollisions();
  }
  
  checkSurfaceCollision() {
    if (typeof moonSurface === 'undefined') return false;
    
    for (let i = 0; i < moonSurface.length - 1; i++) {
      if (typeof distToSegment !== 'undefined') {
        if (distToSegment(this.pos, moonSurface[i], moonSurface[i + 1]) < this.size / 2) {
          return true;
        }
      }
    }
    return false;
  }
  
  checkEnemyCollisions() {
    if (typeof entityManager === 'undefined') return;
    
    // Check collision with enemies
    const enemies = [
      ...entityManager.getCollection('aliens'),
      ...entityManager.getCollection('hunters'),
      ...entityManager.getCollection('zappers'),
      ...entityManager.getCollection('destroyers')
    ];
    
    for (const enemy of enemies) {
      if (this.collidesWith(enemy)) {
        this.takeDamage(10, enemy);
        enemy.takeDamage && enemy.takeDamage(20, this);
        break;
      }
    }
  }
  
  shoot() {
    if (!this.canShoot) return false;
    
    const energy = stateManager.get('energy') || 0;
    const shotCost = 5;
    
    if (energy < shotCost) {
      return false; // Not enough energy
    }
    
    // Create bullet
    const bulletX = this.pos.x + Math.cos(this.rotation) * this.size;
    const bulletY = this.pos.y + Math.sin(this.rotation) * this.size;
    const bulletVelX = Math.cos(this.rotation) * this.bulletSpeed + this.vel.x;
    const bulletVelY = Math.sin(this.rotation) * this.bulletSpeed + this.vel.y;
    
    if (typeof Bullet !== 'undefined') {
      Bullet.addBullet(
        createVector(bulletX, bulletY),
        createVector(bulletVelX, bulletVelY),
        3,
        true // Player bullet
      );
    }
    
    // Consume energy and set cooldown
    stateManager.set('energy', energy - shotCost);
    this.shootCooldown = this.shootingRate / (1000 / 60); // Convert to frames
    this.lastShotTime = Date.now();
    
    // Play sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('shoot');
    }
    
    // Emit event
    eventSystem.emit(GameEvents.ENTITY_CREATED, { type: 'bullet', player: true });
    
    return true;
  }
  
  isOverBase(base) {
    return this.pos.x > base.pos.x &&
           this.pos.x < base.pos.x + base.width &&
           this.pos.y > base.pos.y - 30 &&
           this.pos.y < base.pos.y + 10;
  }
  
  landOnBase(base) {
    this.isLanded = true;
    this.landedBase = base;
    this.vel.x = 0;
    this.vel.y = 0;
    this.pos.y = base.pos.y - this.size / 2;
    
    // Start energy regeneration
    this.startEnergyRecharge();
    
    // Play landing sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('shipLanding');
    }
    
    eventSystem.emit('ship:landed', { base });
  }
  
  takeOff() {
    if (!this.isLanded) return;
    
    this.isLanded = false;
    this.landedBase = null;
    this.stopEnergyRecharge();
    
    // Play takeoff sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('shipTakeoff');
    }
    
    eventSystem.emit('ship:takeoff');
  }
  
  startEnergyRecharge() {
    if (typeof GameTimer !== 'undefined') {
      GameTimer.create('ship_energy_recharge', () => {
        const currentEnergy = stateManager.get('energy') || 0;
        const maxEnergy = stateManager.get('maxEnergy') || 15000;
        const rechargeRate = configManager.get('player', 'healRate') || 10;
        
        if (currentEnergy < maxEnergy) {
          stateManager.set('energy', Math.min(maxEnergy, currentEnergy + rechargeRate));
        }
      }, 1000, true); // Every second, repeating
    }
  }
  
  stopEnergyRecharge() {
    if (typeof GameTimer !== 'undefined') {
      GameTimer.clearTimer('ship_energy_recharge');
    }
  }
  
  handleCrash() {
    if (this.invulnerable) return;
    
    const crashDamage = Math.abs(this.vel.y) * 5;
    this.takeDamage(crashDamage);
    
    // Create crash particles
    this.createCrashEffect();
    
    // Play crash sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('shipCrash');
    }
    
    // Bounce off surface
    this.vel.y *= -0.3;
    this.vel.x *= 0.8;
    
    eventSystem.emit('ship:crashed', { damage: crashDamage });
  }
  
  createCrashEffect() {
    // Create crash particles (will be handled by particle system)
    for (let i = 0; i < 10; i++) {
      const particle = {
        x: this.pos.x,
        y: this.pos.y,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * -3 - 1,
        life: 60,
        maxLife: 60,
        color: [255, 100, 0],
        size: Math.random() * 3 + 1
      };
      
      // Add to particle system if available
      if (typeof entityManager !== 'undefined') {
        entityManager.addEntity('particles', particle);
      }
    }
  }
  
  activateShield(duration = 180) {
    this.shieldActive = true;
    this.shieldRadius = this.size * 2;
    this.setInvulnerable(duration);
    
    // Play shield sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('shieldActivate');
    }
    
    eventSystem.emit('ship:shieldActivated', { duration });
  }
  
  onDraw() {
    // Draw exhaust particles
    this.drawExhaustParticles();
    
    // Draw ship body
    this.drawShipBody();
    
    // Draw shield
    if (this.shieldActive) {
      this.drawShield();
    }
    
    // Draw fuel gauge when low
    if (this.fuel < this.fuelCapacity * 0.3) {
      this.drawFuelGauge();
    }
  }
  
  drawExhaustParticles() {
    for (const particle of this.exhaustParticles) {
      const alpha = (particle.life / particle.maxLife) * 255;
      fill(255, 100, 0, alpha);
      noStroke();
      circle(particle.x, particle.y, particle.size);
    }
  }
  
  drawShipBody() {
    fill(150, 150, 255);
    stroke(255);
    strokeWeight(1);
    
    // Ship body (triangle)
    triangle(-this.size/2, this.size/3, this.size/2, 0, -this.size/2, -this.size/3);
    
    // Cockpit
    fill(100, 100, 200);
    circle(-this.size/4, 0, this.size/3);
  }
  
  drawShield() {
    if (this.shieldRadius > 0) {
      noFill();
      stroke(0, 100, 255, 150);
      strokeWeight(2);
      circle(0, 0, this.shieldRadius * 2);
    }
  }
  
  drawFuelGauge() {
    // Small fuel indicator
    const gaugeWidth = this.size;
    const gaugeHeight = 4;
    const gaugeY = -this.size/2 - 15;
    
    // Background
    noFill();
    stroke(255, 0, 0);
    rect(-gaugeWidth/2, gaugeY, gaugeWidth, gaugeHeight);
    
    // Fuel level
    const fuelPercent = this.fuel / this.fuelCapacity;
    fill(fuelPercent > 0.3 ? color(0, 255, 0) : color(255, 0, 0));
    noStroke();
    rect(-gaugeWidth/2, gaugeY, gaugeWidth * fuelPercent, gaugeHeight);
  }
  
  onDestroyed(source) {
    super.onDestroyed(source);
    
    // Stop sounds
    if (typeof soundManager !== 'undefined') {
      soundManager.stop('shipEngine');
    }
    
    // Stop timers
    this.stopEnergyRecharge();
    
    // Create explosion
    if (typeof Explosion !== 'undefined') {
      new Explosion(this.pos.x, this.pos.y, this.size * 2);
    }
    
    // Emit event
    eventSystem.emit(GameEvents.PLAYER_DEATH, { cause: source?.constructor?.name });
  }
  
  serialize() {
    return {
      ...super.serialize(),
      fuel: this.fuel,
      isLanded: this.isLanded,
      landedBaseId: this.landedBase?.id || null
    };
  }
  
  deserialize(data) {
    super.deserialize(data);
    this.fuel = data.fuel || this.fuelCapacity;
    this.isLanded = data.isLanded || false;
    // Note: landedBase will need to be resolved by reference after all entities are loaded
  }
}

export default Ship;