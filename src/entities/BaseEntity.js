/**
 * Enhanced Base Entity Class
 * Provides common functionality for all game entities
 */

import stateManager from '../core/StateManager.js';

class BaseEntity {
  constructor(pos, vel = null, size = 10) {
    // Use p5.Vector.copy() if available, otherwise create basic vector
    this.pos = pos?.copy ? pos.copy() : { x: pos?.x || 0, y: pos?.y || 0 };
    this.vel = vel?.copy ? vel.copy() : { x: vel?.x || 0, y: vel?.y || 0 };
    this.size = size;
    
    // Entity state
    this.active = true;
    this.shouldRemove = false;
    this.id = null;
    this.collectionName = null;
    
    // Visual properties
    this.visible = true;
    this.opacity = 1.0;
    this.rotation = 0;
    this.scale = 1.0;
    
    // Physics properties
    this.mass = 1;
    this.friction = 0.98;
    this.bounciness = 0.5;
    this.gravityScale = 1;
    
    // Health system
    this.health = 100;
    this.maxHealth = 100;
    this.invulnerable = false;
    this.invulnerabilityTime = 0;
    
    // Lifecycle tracking
    this.createdAt = Date.now();
    this.age = 0;
    this.maxAge = Infinity;
    
    // Debug properties
    this.debugDraw = false;
    
    // Initialize
    this.onCreated();
  }
  
  /**
   * Update entity state
   */
  update() {
    if (!this.active) return;
    
    this.age = Date.now() - this.createdAt;
    
    // Check for age-based removal
    if (this.age > this.maxAge) {
      this.destroy();
      return;
    }
    
    // Update invulnerability
    if (this.invulnerabilityTime > 0) {
      this.invulnerabilityTime--;
      if (this.invulnerabilityTime <= 0) {
        this.invulnerable = false;
      }
    }
    
    // Apply physics
    this.updatePhysics();
    
    // Keep within world bounds
    this.constrainToWorld();
    
    // Entity-specific update
    this.onUpdate();
    
    // Check removal conditions
    if (this.health <= 0 || this.shouldRemove) {
      this.destroy();
    }
  }
  
  /**
   * Apply basic physics
   */
  updatePhysics() {
    // Apply velocity
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    
    // Apply friction
    this.vel.x *= this.friction;
    this.vel.y *= this.friction;
    
    // Apply gravity if enabled
    if (this.gravityScale > 0 && typeof gravity !== 'undefined') {
      this.vel.y += gravity * this.gravityScale;
    }
  }
  
  /**
   * Keep entity within world boundaries
   */
  constrainToWorld() {
    const worldWidth = stateManager.get('worldWidth') || 6000;
    
    // Wrap around horizontally
    if (this.pos.x < 0) {
      this.pos.x = worldWidth;
    } else if (this.pos.x > worldWidth) {
      this.pos.x = 0;
    }
    
    // Bounce off top/bottom (if height is defined)
    if (typeof height !== 'undefined') {
      if (this.pos.y < 0) {
        this.pos.y = 0;
        this.vel.y *= -this.bounciness;
      } else if (this.pos.y > height) {
        this.pos.y = height;
        this.vel.y *= -this.bounciness;
      }
    }
  }
  
  /**
   * Draw the entity
   */
  draw() {
    if (!this.active || !this.visible) return;
    
    // Check if in view for performance
    if (!this.isInView()) return;
    
    // Apply transformations
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);
    scale(this.scale);
    
    // Apply opacity
    if (this.opacity < 1.0) {
      tint(255, this.opacity * 255);
    }
    
    // Invulnerability effect
    if (this.invulnerable && Math.floor(this.age / 5) % 2) {
      tint(255, 128); // Flashing effect
    }
    
    // Entity-specific drawing
    this.onDraw();
    
    // Debug drawing
    if (this.debugDraw) {
      this.drawDebugInfo();
    }
    
    pop();
  }
  
  /**
   * Check if entity is in view
   */
  isInView() {
    const viewLeft = stateManager.get('cameraOffset') || 0;
    const viewRight = viewLeft + (typeof width !== 'undefined' ? width : 1200);
    const viewTop = 0;
    const viewBottom = typeof height !== 'undefined' ? height : 800;
    
    return this.pos.x + this.size > viewLeft &&
           this.pos.x - this.size < viewRight &&
           this.pos.y + this.size > viewTop &&
           this.pos.y - this.size < viewBottom;
  }
  
  /**
   * Take damage
   */
  takeDamage(amount, source = null) {
    if (this.invulnerable) return false;
    
    this.health = Math.max(0, this.health - amount);
    this.onDamageTaken(amount, source);
    
    if (this.health <= 0) {
      this.onDestroyed(source);
      return true;
    }
    
    return false;
  }
  
  /**
   * Heal entity
   */
  heal(amount) {
    const oldHealth = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    const actualHeal = this.health - oldHealth;
    
    if (actualHeal > 0) {
      this.onHealed(actualHeal);
    }
    
    return actualHeal;
  }
  
  /**
   * Make entity invulnerable for specified time
   */
  setInvulnerable(duration) {
    this.invulnerable = true;
    this.invulnerabilityTime = duration;
  }
  
  /**
   * Check collision with another entity
   */
  collidesWith(other) {
    if (!other || !other.active) return false;
    
    const dx = this.pos.x - other.pos.x;
    const dy = this.pos.y - other.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = (this.size + other.size) / 2;
    
    return distance < minDistance;
  }
  
  /**
   * Get distance to another entity
   */
  distanceTo(other) {
    const dx = this.pos.x - other.pos.x;
    const dy = this.pos.y - other.pos.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Get angle to another entity
   */
  angleTo(other) {
    return Math.atan2(other.pos.y - this.pos.y, other.pos.x - this.pos.x);
  }
  
  /**
   * Move towards another entity
   */
  moveTowards(target, speed) {
    const angle = this.angleTo(target);
    this.vel.x += Math.cos(angle) * speed;
    this.vel.y += Math.sin(angle) * speed;
  }
  
  /**
   * Move away from another entity
   */
  moveAway(target, speed) {
    const angle = this.angleTo(target) + Math.PI;
    this.vel.x += Math.cos(angle) * speed;
    this.vel.y += Math.sin(angle) * speed;
  }
  
  /**
   * Apply force to the entity
   */
  applyForce(forceX, forceY) {
    const accX = forceX / this.mass;
    const accY = forceY / this.mass;
    this.vel.x += accX;
    this.vel.y += accY;
  }
  
  /**
   * Destroy the entity
   */
  destroy() {
    this.active = false;
    this.shouldRemove = true;
    this.onDestroyed();
  }
  
  /**
   * Reset entity for object pooling
   */
  reset(pos, vel = null, size = null) {
    this.pos = pos?.copy ? pos.copy() : { x: pos?.x || 0, y: pos?.y || 0 };
    this.vel = vel?.copy ? vel.copy() : { x: vel?.x || 0, y: vel?.y || 0 };
    if (size !== null) this.size = size;
    
    this.active = true;
    this.shouldRemove = false;
    this.visible = true;
    this.opacity = 1.0;
    this.rotation = 0;
    this.scale = 1.0;
    this.health = this.maxHealth;
    this.invulnerable = false;
    this.invulnerabilityTime = 0;
    this.createdAt = Date.now();
    this.age = 0;
    
    this.onReset();
  }
  
  /**
   * Cleanup for object pooling
   */
  cleanup() {
    this.active = false;
    this.onCleanup();
  }
  
  /**
   * Draw debug information
   */
  drawDebugInfo() {
    // Health bar
    if (this.health < this.maxHealth) {
      noFill();
      stroke(255, 0, 0);
      rect(-this.size/2, -this.size/2 - 10, this.size, 4);
      fill(255, 0, 0);
      noStroke();
      rect(-this.size/2, -this.size/2 - 10, this.size * (this.health / this.maxHealth), 4);
    }
    
    // Collision bounds
    noFill();
    stroke(0, 255, 0);
    circle(0, 0, this.size);
    
    // Velocity vector
    stroke(0, 0, 255);
    line(0, 0, this.vel.x * 10, this.vel.y * 10);
    
    // ID label
    fill(255);
    textAlign(CENTER);
    textSize(8);
    text(this.id || 'No ID', 0, -this.size/2 - 15);
  }
  
  /**
   * Serialize entity state
   */
  serialize() {
    return {
      pos: { x: this.pos.x, y: this.pos.y },
      vel: { x: this.vel.x, y: this.vel.y },
      size: this.size,
      health: this.health,
      maxHealth: this.maxHealth,
      rotation: this.rotation,
      scale: this.scale,
      age: this.age,
      className: this.constructor.name
    };
  }
  
  /**
   * Deserialize entity state
   */
  deserialize(data) {
    this.pos.x = data.pos.x;
    this.pos.y = data.pos.y;
    this.vel.x = data.vel.x;
    this.vel.y = data.vel.y;
    this.size = data.size;
    this.health = data.health;
    this.maxHealth = data.maxHealth;
    this.rotation = data.rotation;
    this.scale = data.scale;
    this.age = data.age;
  }
  
  // Virtual methods to be overridden by subclasses
  onCreated() {}
  onUpdate() {}
  onDraw() {}
  onDamageTaken(amount, source) {}
  onHealed(amount) {}
  onDestroyed(source = null) {}
  onReset() {}
  onCleanup() {}
}

export default BaseEntity;