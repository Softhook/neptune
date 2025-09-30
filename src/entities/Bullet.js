/**
 * Bullet Entity - Refactored with enhanced pooling and collision system
 */

import BaseEntity from './BaseEntity.js';
import eventSystem, { GameEvents } from '../core/EventSystem.js';
import entityManager from '../core/EntityManager.js';
import configManager from '../core/ConfigManager.js';

class Bullet extends BaseEntity {
  constructor(pos, vel, size = 3, isPlayerBullet = false) {
    super(pos, vel, size);
    
    this.isPlayerBullet = isPlayerBullet;
    this.damage = isPlayerBullet ? 10 : 5;
    this.maxAge = 3000; // 3 seconds
    this.bounces = 0;
    this.maxBounces = 0;
    this.piercing = false;
    this.explosive = false;
    this.explosionRadius = 0;
    
    // Visual properties
    this.trail = [];
    this.trailLength = 5;
    this.glowEffect = false;
    this.color = isPlayerBullet ? [0, 255, 0] : [255, 0, 0];
    
    // Physics
    this.gravityScale = 0; // Bullets aren't affected by gravity by default
    this.friction = 1; // No friction by default
    
    // Collision tracking
    this.hitEntities = new Set();
  }
  
  onUpdate() {
    super.onUpdate();
    
    this.updateTrail();
    this.checkCollisions();
    this.checkBoundaries();
  }
  
  updateTrail() {
    // Add current position to trail
    this.trail.push({ x: this.pos.x, y: this.pos.y });
    
    // Limit trail length
    if (this.trail.length > this.trailLength) {
      this.trail.shift();
    }
  }
  
  checkCollisions() {
    // Check surface collision first
    if (this.checkSurfaceCollision()) {
      this.handleSurfaceHit();
      return;
    }
    
    // Check entity collisions
    this.checkEntityCollisions();
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
  
  handleSurfaceHit() {
    if (this.bounces < this.maxBounces) {
      this.bounce();
    } else if (this.explosive) {
      this.explode();
    } else {
      this.destroy();
    }
  }
  
  bounce() {
    // Simple bounce - reverse Y velocity and reduce speed
    this.vel.y *= -0.7;
    this.vel.x *= 0.9;
    this.bounces++;
    
    // Create bounce particles
    this.createBounceEffect();
    
    // Play bounce sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('bulletBounce');
    }
  }
  
  checkEntityCollisions() {
    if (this.isPlayerBullet) {
      this.checkPlayerBulletCollisions();
    } else {
      this.checkEnemyBulletCollisions();
    }
  }
  
  checkPlayerBulletCollisions() {
    const enemyCollections = ['aliens', 'hunters', 'zappers', 'destroyers', 'worms'];
    
    for (const collectionName of enemyCollections) {
      const entities = entityManager.getCollection(collectionName);
      for (const entity of entities) {
        if (this.hitEntities.has(entity.id)) continue; // Skip if already hit (for piercing bullets)
        
        if (this.collidesWith(entity)) {
          this.hitEntity(entity);
          
          if (!this.piercing) {
            this.destroy();
            return;
          } else {
            this.hitEntities.add(entity.id);
          }
        }
      }
    }
    
    // Check boss collisions
    this.checkBossCollisions();
  }
  
  checkEnemyBulletCollisions() {
    // Check collision with player entities
    if (typeof ship !== 'undefined' && this.collidesWith(ship)) {
      this.hitEntity(ship);
      this.destroy();
      return;
    }
    
    if (typeof astronaut !== 'undefined' && astronaut.visible && this.collidesWith(astronaut)) {
      this.hitEntity(astronaut);
      this.destroy();
      return;
    }
    
    // Check collision with bases
    const bases = entityManager.getCollection('bases');
    for (const base of bases) {
      if (this.collidesWithRect(base)) {
        this.hitEntity(base);
        this.destroy();
        return;
      }
    }
    
    // Check collision with walkers
    const walkers = entityManager.getCollection('walkers');
    for (const walker of walkers) {
      if (this.collidesWith(walker)) {
        this.hitEntity(walker);
        this.destroy();
        return;
      }
    }
  }
  
  checkBossCollisions() {
    // Check alien queen collision
    if (typeof alienQueen !== 'undefined' && alienQueen.active && this.collidesWith(alienQueen)) {
      this.hitEntity(alienQueen);
      if (!this.piercing) {
        this.destroy();
        return;
      }
    }
    
    // Check alien king collision
    if (typeof alienKing !== 'undefined' && alienKing.active && this.collidesWith(alienKing)) {
      this.hitEntity(alienKing);
      if (!this.piercing) {
        this.destroy();
        return;
      }
    }
  }
  
  hitEntity(entity) {
    // Apply damage with multiplier
    const damageMultiplier = this.isPlayerBullet ? (Bullet.damageMultiplier || 1) : 1;
    const actualDamage = this.damage * damageMultiplier;
    
    const destroyed = entity.takeDamage ? entity.takeDamage(actualDamage, this) : false;
    
    // Create hit effect
    this.createHitEffect(entity);
    
    // Play hit sound
    if (typeof soundManager !== 'undefined') {
      const soundName = destroyed ? 'enemyDestroyed' : 'bulletHit';
      soundManager.play(soundName);
    }
    
    // Emit collision event
    eventSystem.emit(GameEvents.ENTITY_COLLISION, {
      bullet: this,
      target: entity,
      damage: actualDamage,
      destroyed: destroyed
    });
  }
  
  collidesWithRect(rect) {
    return this.pos.x > rect.pos.x &&
           this.pos.x < rect.pos.x + rect.width &&
           this.pos.y > rect.pos.y &&
           this.pos.y < rect.pos.y + rect.height;
  }
  
  checkBoundaries() {
    const worldWidth = configManager.get('game', 'worldWidth') || 6000;
    
    // Remove if out of world bounds
    if (this.pos.x < -100 || this.pos.x > worldWidth + 100 || 
        this.pos.y < -100 || this.pos.y > (typeof height !== 'undefined' ? height + 100 : 900)) {
      this.destroy();
    }
  }
  
  explode() {
    // Create explosion
    if (typeof Explosion !== 'undefined') {
      new Explosion(this.pos.x, this.pos.y, this.explosionRadius || 30);
    }
    
    // Damage nearby entities
    if (this.explosionRadius > 0) {
      this.damageNearbyEntities();
    }
    
    // Play explosion sound
    if (typeof soundManager !== 'undefined') {
      soundManager.play('explosion');
    }
    
    this.destroy();
  }
  
  damageNearbyEntities() {
    const allCollections = ['aliens', 'hunters', 'zappers', 'destroyers', 'bases', 'walkers'];
    
    for (const collectionName of allCollections) {
      const entities = entityManager.getCollection(collectionName);
      for (const entity of entities) {
        const distance = this.distanceTo(entity);
        if (distance <= this.explosionRadius) {
          // Damage falls off with distance
          const damageMultiplier = 1 - (distance / this.explosionRadius);
          const explosionDamage = this.damage * 2 * damageMultiplier;
          
          if (entity.takeDamage) {
            entity.takeDamage(explosionDamage, this);
          }
        }
      }
    }
  }
  
  createHitEffect(target) {
    // Create impact particles
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
      const particle = {
        x: this.pos.x,
        y: this.pos.y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 20,
        maxLife: 20,
        color: [255, 255, 0],
        size: Math.random() * 2 + 1
      };
      
      entityManager.addEntity('particles', particle);
    }
  }
  
  createBounceEffect() {
    // Create small sparks on bounce
    const sparkCount = 3;
    for (let i = 0; i < sparkCount; i++) {
      const particle = {
        x: this.pos.x,
        y: this.pos.y,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2,
        life: 15,
        maxLife: 15,
        color: [255, 200, 0],
        size: 1
      };
      
      entityManager.addEntity('particles', particle);
    }
  }
  
  onDraw() {
    // Draw trail
    if (this.trail.length > 1) {
      this.drawTrail();
    }
    
    // Draw bullet body
    this.drawBullet();
    
    // Draw glow effect
    if (this.glowEffect) {
      this.drawGlow();
    }
  }
  
  drawTrail() {
    for (let i = 0; i < this.trail.length - 1; i++) {
      const alpha = (i / this.trail.length) * 100;
      const point = this.trail[i];
      const nextPoint = this.trail[i + 1];
      
      stroke(this.color[0], this.color[1], this.color[2], alpha);
      strokeWeight(this.size * (i / this.trail.length));
      line(point.x, point.y, nextPoint.x, nextPoint.y);
    }
  }
  
  drawBullet() {
    fill(this.color[0], this.color[1], this.color[2]);
    
    if (this.explosive) {
      // Draw explosive bullet as diamond
      stroke(255, 100, 0);
      strokeWeight(1);
      push();
      rotate(this.age * 0.1);
      rectMode(CENTER);
      rect(0, 0, this.size, this.size);
      pop();
    } else {
      // Draw regular bullet as circle
      noStroke();
      circle(0, 0, this.size);
    }
  }
  
  drawGlow() {
    // Outer glow
    for (let r = this.size * 2; r > 0; r -= 2) {
      const alpha = (1 - r / (this.size * 2)) * 50;
      fill(this.color[0], this.color[1], this.color[2], alpha);
      noStroke();
      circle(0, 0, r);
    }
  }
  
  // Static methods for bullet management
  static createBullet(pos, vel, size = 3, isPlayerBullet = false, options = {}) {
    const bullet = entityManager.getFromPool('bullets', Bullet, pos, vel, size, isPlayerBullet);
    
    // Apply options
    if (options.damage) bullet.damage = options.damage;
    if (options.maxBounces) bullet.maxBounces = options.maxBounces;
    if (options.piercing) bullet.piercing = options.piercing;
    if (options.explosive) bullet.explosive = options.explosive;
    if (options.explosionRadius) bullet.explosionRadius = options.explosionRadius;
    if (options.color) bullet.color = options.color;
    if (options.trailLength) bullet.trailLength = options.trailLength;
    if (options.glowEffect) bullet.glowEffect = options.glowEffect;
    
    entityManager.addEntity('bullets', bullet);
    return bullet;
  }
  
  static updateAll() {
    entityManager.updateCollection('bullets');
  }
  
  static drawAll() {
    entityManager.drawCollection('bullets');
  }
  
  static clearAll() {
    entityManager.clearCollection('bullets');
  }
  
  // Upgrade effects
  static damageMultiplier = 1;
  
  static applyUpgrade(upgradeType) {
    switch (upgradeType) {
      case 'damage':
        Bullet.damageMultiplier += 0.5;
        break;
      case 'piercing':
        // New bullets will have piercing by default
        break;
      case 'explosive':
        // New bullets will have explosive by default
        break;
    }
  }
  
  onReset(pos, vel, size, isPlayerBullet) {
    super.reset(pos, vel, size);
    this.isPlayerBullet = isPlayerBullet;
    this.damage = isPlayerBullet ? 10 : 5;
    this.bounces = 0;
    this.trail = [];
    this.hitEntities.clear();
    this.piercing = false;
    this.explosive = false;
    this.explosionRadius = 0;
    this.color = isPlayerBullet ? [0, 255, 0] : [255, 0, 0];
    this.glowEffect = false;
  }
  
  onCleanup() {
    super.onCleanup();
    this.trail = [];
    this.hitEntities.clear();
  }
}

export default Bullet;