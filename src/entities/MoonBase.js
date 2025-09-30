/**
 * MoonBase Entity - Refactored with enhanced functionality
 */

import BaseEntity from './BaseEntity.js';
import eventSystem, { GameEvents } from '../core/EventSystem.js';
import entityManager from '../core/EntityManager.js';
import stateManager from '../core/StateManager.js';
import configManager from '../core/ConfigManager.js';

class MoonBase extends BaseEntity {
  static BASE_HEIGHT = 20;
  static BASE_WIDTH = 100;
  
  constructor(width = MoonBase.BASE_WIDTH, height = MoonBase.BASE_HEIGHT, pos = null) {
    super(pos || MoonBase.findSuitableLocation(), null, Math.max(width, height));
    
    // Base dimensions
    this.width = width;
    this.height = height;
    
    // Base components
    this.towerWidth = 10;
    this.towerHeight = 30;
    this.radarDishRadius = 15;
    this.radarAngle = 0;
    this.radarRotationSpeed = 0.02;
    
    // Base functionality
    this.energyCapacity = 5000;
    this.energyStored = 0;
    this.energyGenerationRate = 5; // per second
    this.healRate = 1;
    this.defenseRadius = 150;
    
    // Defensive systems
    this.balloons = [];
    this.maxBalloons = 3;
    this.balloonCooldown = 0;
    this.balloonCooldownTime = 600; // 10 seconds at 60fps
    this.hasShield = false;
    this.shieldHealth = 0;
    this.maxShieldHealth = 200;
    
    // Operational state
    this.operational = true;
    this.powerLevel = 1.0;
    this.maintenanceRequired = false;
    this.constructionProgress = 1.0; // 1.0 = fully constructed
    
    // Visual effects
    this.lights = [];
    this.statusLights = {
      power: { color: [0, 255, 0], blinking: false },
      defense: { color: [0, 0, 255], blinking: false },
      warning: { color: [255, 255, 0], blinking: false },
      alert: { color: [255, 0, 0], blinking: false }
    };
    
    // Initialize
    this.health = 100;
    this.maxHealth = 100;
    this.gravityScale = 0; // Bases don't move
    this.friction = 1;
    
    this.initializeLights();
    this.startSystems();
  }
  
  static findSuitableLocation() {
    if (typeof moonSurface === 'undefined') {
      return { x: Math.random() * 6000, y: 400 };
    }
    
    const flattestSegment = MoonBase.findFlattestSegment();
    if (flattestSegment !== null) {
      const start = moonSurface[flattestSegment];
      const end = moonSurface[flattestSegment + 1];
      const avgY = (start.y + end.y) / 2;
      return { x: start.x, y: avgY - MoonBase.BASE_HEIGHT };
    }
    
    // Fallback
    const baseSegmentIndex = Math.floor(Math.random() * (moonSurface.length - 1));
    const start = moonSurface[baseSegmentIndex];
    const end = moonSurface[baseSegmentIndex + 1];
    return { x: start.x, y: (start.y + end.y) / 2 - MoonBase.BASE_HEIGHT };
  }
  
  static findFlattestSegment() {
    if (typeof moonSurface === 'undefined') return null;
    
    let flattestSegment = null;
    let lowestSlope = Infinity;
    
    for (let i = 0; i < moonSurface.length - 1; i++) {
      const start = moonSurface[i];
      const end = moonSurface[i + 1];
      const slope = Math.abs(end.y - start.y) / Math.abs(end.x - start.x);
      
      if (slope < lowestSlope) {
        lowestSlope = slope;
        flattestSegment = i;
      }
    }
    
    return flattestSegment;
  }
  
  initializeLights() {
    // Create decorative lights around the base
    for (let i = 0; i < 4; i++) {
      this.lights.push({
        x: (i / 3) * this.width - this.width/2,
        y: -this.height/2,
        brightness: Math.random() * 0.5 + 0.5,
        flickerRate: Math.random() * 0.05 + 0.01,
        color: [100, 150, 255]
      });
    }
  }
  
  startSystems() {
    // Start base systems with timers
    if (typeof GameTimer !== 'undefined') {
      // Energy generation
      GameTimer.create(`base_energy_${this.id}`, () => {
        this.generateEnergy();
      }, 1000, true);
      
      // Self healing
      GameTimer.create(`base_heal_${this.id}`, () => {
        this.autoHeal();
      }, 3000, true);
      
      // Balloon defense
      GameTimer.create(`base_defense_${this.id}`, () => {
        this.updateDefense();
      }, 10000, true);
      
      // Maintenance check
      GameTimer.create(`base_maintenance_${this.id}`, () => {
        this.checkMaintenance();
      }, 30000, true);
    }
  }
  
  stopSystems() {
    if (typeof GameTimer !== 'undefined') {
      GameTimer.clearTimer(`base_energy_${this.id}`);
      GameTimer.clearTimer(`base_heal_${this.id}`);
      GameTimer.clearTimer(`base_defense_${this.id}`);
      GameTimer.clearTimer(`base_maintenance_${this.id}`);
    }
  }
  
  onUpdate() {
    super.onUpdate();
    
    this.updateRadar();
    this.updateBalloons();
    this.updateStatusLights();
    this.updatePowerLevel();
    this.updateLights();
    this.checkThreats();
  }
  
  updateRadar() {
    this.radarAngle += this.radarRotationSpeed;
    if (this.radarAngle > Math.PI * 2) {
      this.radarAngle = 0;
    }
  }
  
  updateBalloons() {
    // Update existing balloons
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const balloon = this.balloons[i];
      balloon.update();
      
      if (balloon.shouldRemove || !balloon.active) {
        this.balloons.splice(i, 1);
      }
    }
    
    // Update cooldown
    if (this.balloonCooldown > 0) {
      this.balloonCooldown--;
    }
  }
  
  updateStatusLights() {
    // Update status light states based on base condition
    this.statusLights.power.blinking = this.powerLevel < 0.5;
    this.statusLights.defense.blinking = this.balloons.length === 0;
    this.statusLights.warning.blinking = this.health < this.maxHealth * 0.5;
    this.statusLights.alert.blinking = this.health < this.maxHealth * 0.2;
  }
  
  updatePowerLevel() {
    // Power level affects base efficiency
    if (this.health < this.maxHealth * 0.5) {
      this.powerLevel = 0.5;
    } else if (this.maintenanceRequired) {
      this.powerLevel = 0.7;
    } else {
      this.powerLevel = 1.0;
    }
  }
  
  updateLights() {
    // Create flickering effect
    for (const light of this.lights) {
      light.brightness += (Math.random() - 0.5) * light.flickerRate;
      light.brightness = Math.max(0.3, Math.min(1.0, light.brightness));
    }
  }
  
  checkThreats() {
    if (!this.operational) return;
    
    // Scan for nearby enemies
    const enemies = [
      ...entityManager.getCollection('aliens'),
      ...entityManager.getCollection('hunters'),
      ...entityManager.getCollection('zappers'),
      ...entityManager.getCollection('destroyers')
    ];
    
    let nearbyThreats = 0;
    for (const enemy of enemies) {
      if (this.distanceTo(enemy) < this.defenseRadius) {
        nearbyThreats++;
      }
    }
    
    // Launch defensive balloons if threatened
    if (nearbyThreats > 0 && this.balloons.length < this.maxBalloons) {
      this.launchBarrageBalloon();
    }
  }
  
  generateEnergy() {
    if (!this.operational || this.powerLevel < 0.1) return;
    
    const energyGenerated = this.energyGenerationRate * this.powerLevel;
    this.energyStored = Math.min(this.energyCapacity, this.energyStored + energyGenerated);
    
    // Transfer excess energy to global pool
    if (this.energyStored >= this.energyCapacity * 0.8) {
      const currentEnergy = stateManager.get('energy') || 0;
      const maxEnergy = stateManager.get('maxEnergy') || 15000;
      const transferAmount = Math.min(energyGenerated, maxEnergy - currentEnergy);
      
      if (transferAmount > 0) {
        stateManager.set('energy', currentEnergy + transferAmount);
        this.energyStored = Math.max(0, this.energyStored - transferAmount);
        
        eventSystem.emit('base:energyTransferred', {
          base: this,
          amount: transferAmount
        });
      }
    }
  }
  
  autoHeal() {
    if (!this.operational || this.health >= this.maxHealth) return;
    
    const healAmount = this.healRate * this.powerLevel;
    this.heal(healAmount);
  }
  
  updateDefense() {
    // Check if defensive systems need activation
    if (this.operational && this.balloons.length < this.maxBalloons / 2) {
      // Consider launching defensive balloon
      const threatLevel = this.assessThreatLevel();
      if (threatLevel > 0.3) {
        this.launchBarrageBalloon();
      }
    }
  }
  
  checkMaintenance() {
    // Randomly require maintenance based on base condition
    if (this.health < this.maxHealth * 0.7) {
      this.maintenanceRequired = Math.random() < 0.3;
    } else {
      this.maintenanceRequired = Math.random() < 0.1;
    }
    
    if (this.maintenanceRequired) {
      eventSystem.emit('base:maintenanceRequired', { base: this });
    }
  }
  
  assessThreatLevel() {
    const enemies = [
      ...entityManager.getCollection('aliens'),
      ...entityManager.getCollection('hunters'),
      ...entityManager.getCollection('zappers'),
      ...entityManager.getCollection('destroyers')
    ];
    
    let threatLevel = 0;
    for (const enemy of enemies) {
      const distance = this.distanceTo(enemy);
      if (distance < this.defenseRadius) {
        threatLevel += 1 / (distance / 50 + 1); // Closer enemies = higher threat
      }
    }
    
    return Math.min(1.0, threatLevel / 5); // Normalize to 0-1
  }
  
  launchBarrageBalloon() {
    if (this.balloonCooldown > 0 || this.balloons.length >= this.maxBalloons) {
      return false;
    }
    
    // Create balloon (assuming BarrageBalloon class exists)
    if (typeof BarrageBalloon !== 'undefined') {
      const balloonPos = {
        x: this.pos.x + (Math.random() - 0.5) * this.width,
        y: this.pos.y - this.height - 20
      };
      
      const balloon = new BarrageBalloon(balloonPos);
      this.balloons.push(balloon);
      entityManager.addEntity('balloons', balloon);
      
      this.balloonCooldown = this.balloonCooldownTime;
      
      // Play launch sound
      if (typeof soundManager !== 'undefined') {
        soundManager.play('balloonLaunch');
      }
      
      eventSystem.emit('base:balloonLaunched', { base: this, balloon: balloon });
      return true;
    }
    
    return false;
  }
  
  activateShield() {
    if (this.hasShield) return false;
    
    this.hasShield = true;
    this.shieldHealth = this.maxShieldHealth;
    
    // Play shield activation sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('baseShieldActivate');
    }
    
    eventSystem.emit('base:shieldActivated', { base: this });
    return true;
  }
  
  performMaintenance() {
    if (!this.maintenanceRequired) return false;
    
    this.maintenanceRequired = false;
    this.powerLevel = 1.0;
    this.heal(20); // Maintenance provides some healing
    
    // Cost maintenance
    const maintenanceCost = 500;
    const currentMoney = stateManager.get('money') || 0;
    if (currentMoney >= maintenanceCost) {
      stateManager.set('money', currentMoney - maintenanceCost);
    }
    
    eventSystem.emit('base:maintenanceCompleted', { base: this, cost: maintenanceCost });
    return true;
  }
  
  takeDamage(amount, source = null) {
    // Shield absorbs damage first
    if (this.hasShield && this.shieldHealth > 0) {
      const shieldDamage = Math.min(amount, this.shieldHealth);
      this.shieldHealth -= shieldDamage;
      amount -= shieldDamage;
      
      if (this.shieldHealth <= 0) {
        this.hasShield = false;
        eventSystem.emit('base:shieldDestroyed', { base: this });
      }
    }
    
    // Apply remaining damage to base
    const destroyed = super.takeDamage(amount, source);
    
    if (destroyed) {
      this.operational = false;
      eventSystem.emit(GameEvents.BASE_DESTROYED, { base: this, cause: source });
    } else if (amount > 0) {
      eventSystem.emit(GameEvents.BASE_ATTACKED, { base: this, damage: amount, source: source });
    }
    
    return destroyed;
  }
  
  onDraw() {
    // Draw base structure
    this.drawBaseStructure();
    
    // Draw defensive systems
    this.drawRadar();
    this.drawStatusLights();
    this.drawLights();
    
    // Draw shield if active
    if (this.hasShield) {
      this.drawShield();
    }
    
    // Draw construction progress if not complete
    if (this.constructionProgress < 1.0) {
      this.drawConstructionProgress();
    }
    
    // Draw maintenance indicator
    if (this.maintenanceRequired) {
      this.drawMaintenanceIndicator();
    }
  }
  
  drawBaseStructure() {
    // Main base body
    fill(this.operational ? 100 : 60, this.operational ? 100 : 60, this.operational ? 150 : 90);
    stroke(200);
    strokeWeight(2);
    rect(-this.width/2, -this.height/2, this.width, this.height);
    
    // Command tower
    fill(80, 80, 120);
    rect(-this.towerWidth/2, -this.height/2 - this.towerHeight, this.towerWidth, this.towerHeight);
    
    // Windows/viewports
    fill(this.operational ? 255 : 100, this.operational ? 255 : 100, 0);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * this.width/4;
      rect(x - 5, -this.height/4, 10, 8);
    }
  }
  
  drawRadar() {
    // Radar dish
    push();
    translate(0, -this.height/2 - this.towerHeight - this.radarDishRadius/2);
    
    // Dish base
    fill(120, 120, 120);
    circle(0, 0, this.radarDishRadius);
    
    // Rotating radar sweep
    if (this.operational) {
      stroke(0, 255, 0);
      strokeWeight(2);
      const sweepX = Math.cos(this.radarAngle) * this.radarDishRadius/2;
      const sweepY = Math.sin(this.radarAngle) * this.radarDishRadius/2;
      line(0, 0, sweepX, sweepY);
    }
    
    pop();
  }
  
  drawStatusLights() {
    const lightSize = 3;
    const lightY = -this.height/2 - 5;
    const lights = Object.values(this.statusLights);
    
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      const x = (i - lights.length/2 + 0.5) * 15;
      
      // Blinking logic
      let alpha = 255;
      if (light.blinking) {
        alpha = Math.sin(this.age * 0.1) * 127 + 128;
      }
      
      fill(light.color[0], light.color[1], light.color[2], alpha);
      noStroke();
      circle(x, lightY, lightSize);
    }
  }
  
  drawLights() {
    // Decorative base lights
    for (const light of this.lights) {
      fill(light.color[0], light.color[1], light.color[2], light.brightness * 255);
      noStroke();
      circle(light.x, light.y, 4);
      
      // Light glow
      for (let r = 8; r > 0; r -= 2) {
        const alpha = (1 - r/8) * light.brightness * 50;
        fill(light.color[0], light.color[1], light.color[2], alpha);
        circle(light.x, light.y, r);
      }
    }
  }
  
  drawShield() {
    if (this.shieldHealth <= 0) return;
    
    const shieldAlpha = (this.shieldHealth / this.maxShieldHealth) * 100 + 50;
    noFill();
    stroke(0, 150, 255, shieldAlpha);
    strokeWeight(3);
    
    const shieldRadius = Math.max(this.width, this.height) * 0.8;
    circle(0, 0, shieldRadius);
    
    // Shield energy indicators
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x1 = Math.cos(angle) * shieldRadius/2;
      const y1 = Math.sin(angle) * shieldRadius/2;
      const x2 = Math.cos(angle) * (shieldRadius/2 + 10);
      const y2 = Math.sin(angle) * (shieldRadius/2 + 10);
      
      if (i < (this.shieldHealth / this.maxShieldHealth) * segments) {
        stroke(0, 255, 255, shieldAlpha);
        line(x1, y1, x2, y2);
      }
    }
  }
  
  drawConstructionProgress() {
    // Construction progress bar
    const barWidth = this.width;
    const barHeight = 4;
    const barY = this.height/2 + 10;
    
    // Background
    fill(100, 100, 100);
    noStroke();
    rect(-barWidth/2, barY, barWidth, barHeight);
    
    // Progress
    fill(0, 255, 0);
    rect(-barWidth/2, barY, barWidth * this.constructionProgress, barHeight);
    
    // Text
    fill(255);
    textAlign(CENTER, TOP);
    textSize(10);
    text(`Construction: ${Math.floor(this.constructionProgress * 100)}%`, 0, barY + barHeight + 2);
  }
  
  drawMaintenanceIndicator() {
    // Flashing maintenance icon
    if (Math.floor(this.age / 30) % 2 === 0) {
      fill(255, 255, 0);
      textAlign(CENTER, CENTER);
      textSize(12);
      text('⚠', 0, -this.height - 30);
    }
  }
  
  onDestroyed(source) {
    super.onDestroyed(source);
    
    this.operational = false;
    this.stopSystems();
    
    // Create ruined base
    if (typeof RuinedBase !== 'undefined') {
      RuinedBase.createFromMoonBase(this);
    }
    
    // Create explosion
    if (typeof Explosion !== 'undefined') {
      new Explosion(this.pos.x, this.pos.y, this.width);
    }
    
    // Play destruction sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('baseDestroyed');
    }
  }
  
  static createFromNest(nest) {
    if (!nest || !nest.pos) return null;
    
    const newBasePos = {
      x: nest.pos.x - MoonBase.BASE_WIDTH / 2,
      y: nest.pos.y - MoonBase.BASE_HEIGHT / 2 - 10
    };
    
    const base = new MoonBase(MoonBase.BASE_WIDTH, MoonBase.BASE_HEIGHT, newBasePos);
    entityManager.addEntity('bases', base);
    
    eventSystem.emit(GameEvents.BASE_CREATED, { base: base, source: 'nest' });
    return base;
  }
  
  serialize() {
    return {
      ...super.serialize(),
      width: this.width,
      height: this.height,
      energyStored: this.energyStored,
      operational: this.operational,
      powerLevel: this.powerLevel,
      maintenanceRequired: this.maintenanceRequired,
      constructionProgress: this.constructionProgress,
      hasShield: this.hasShield,
      shieldHealth: this.shieldHealth
    };
  }
  
  deserialize(data) {
    super.deserialize(data);
    this.width = data.width || MoonBase.BASE_WIDTH;
    this.height = data.height || MoonBase.BASE_HEIGHT;
    this.energyStored = data.energyStored || 0;
    this.operational = data.operational !== undefined ? data.operational : true;
    this.powerLevel = data.powerLevel || 1.0;
    this.maintenanceRequired = data.maintenanceRequired || false;
    this.constructionProgress = data.constructionProgress || 1.0;
    this.hasShield = data.hasShield || false;
    this.shieldHealth = data.shieldHealth || 0;
    
    if (this.operational) {
      this.startSystems();
    }
  }
}

export default MoonBase;