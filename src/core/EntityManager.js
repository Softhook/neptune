/**
 * Centralized Entity Management System
 * Replaces scattered static collections with unified management
 */

class EntityManager {
  constructor() {
    this.collections = new Map();
    this.pools = new Map();
    this.updateFunctions = new Map();
    this.drawFunctions = new Map();
    this.totalEntities = 0;
  }
  
  /**
   * Register a new entity collection
   */
  registerCollection(name, maxSize = Infinity, poolSize = 0) {
    if (this.collections.has(name)) {
      console.warn(`Collection ${name} already exists`);
      return;
    }
    
    this.collections.set(name, {
      entities: [],
      maxSize,
      activeCount: 0
    });
    
    // Create object pool if requested
    if (poolSize > 0) {
      this.pools.set(name, {
        pool: [],
        maxPoolSize: poolSize
      });
    }
    
    console.log(`Registered collection: ${name} (max: ${maxSize}, pool: ${poolSize})`);
  }
  
  /**
   * Add entity to collection
   */
  addEntity(collectionName, entity) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      console.error(`Collection ${collectionName} does not exist`);
      return false;
    }
    
    if (collection.entities.length >= collection.maxSize) {
      console.warn(`Collection ${collectionName} is at maximum capacity`);
      return false;
    }
    
    // Assign unique ID to entity
    if (!entity.id) {
      entity.id = `${collectionName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    entity.collectionName = collectionName;
    collection.entities.push(entity);
    collection.activeCount++;
    this.totalEntities++;
    
    return true;
  }
  
  /**
   * Remove entity from collection
   */
  removeEntity(collectionName, entity) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      return false;
    }
    
    const index = collection.entities.indexOf(entity);
    if (index === -1) {
      return false;
    }
    
    collection.entities.splice(index, 1);
    collection.activeCount--;
    this.totalEntities--;
    
    // Return to pool if available
    this.returnToPool(collectionName, entity);
    
    return true;
  }
  
  /**
   * Get entity from pool or create new one
   */
  getFromPool(collectionName, EntityClass, ...args) {
    const pool = this.pools.get(collectionName);
    if (!pool || pool.pool.length === 0) {
      return new EntityClass(...args);
    }
    
    const entity = pool.pool.pop();
    if (typeof entity.reset === 'function') {
      entity.reset(...args);
    }
    return entity;
  }
  
  /**
   * Return entity to pool
   */
  returnToPool(collectionName, entity) {
    const pool = this.pools.get(collectionName);
    if (!pool || pool.pool.length >= pool.maxPoolSize) {
      return false;
    }
    
    if (typeof entity.cleanup === 'function') {
      entity.cleanup();
    }
    
    pool.pool.push(entity);
    return true;
  }
  
  /**
   * Get all entities in a collection
   */
  getCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    return collection ? [...collection.entities] : [];
  }
  
  /**
   * Get entities within view boundaries
   */
  getEntitiesInView(collectionName, viewBounds) {
    const entities = this.getCollection(collectionName);
    return entities.filter(entity => {
      if (!entity.pos || !entity.size) return true; // Always include if no spatial data
      
      return entity.pos.x + entity.size > viewBounds.left &&
             entity.pos.x - entity.size < viewBounds.right &&
             entity.pos.y + entity.size > viewBounds.top &&
             entity.pos.y - entity.size < viewBounds.bottom;
    });
  }
  
  /**
   * Register update function for a collection
   */
  registerUpdateFunction(collectionName, updateFn) {
    this.updateFunctions.set(collectionName, updateFn);
  }
  
  /**
   * Register draw function for a collection
   */
  registerDrawFunction(collectionName, drawFn) {
    this.drawFunctions.set(collectionName, drawFn);
  }
  
  /**
   * Update all entities in a collection
   */
  updateCollection(collectionName, viewBounds = null) {
    const collection = this.collections.get(collectionName);
    if (!collection) return;
    
    const entities = viewBounds 
      ? this.getEntitiesInView(collectionName, viewBounds)
      : collection.entities;
    
    // Use registered update function or default entity update
    const updateFn = this.updateFunctions.get(collectionName);
    
    for (let i = entities.length - 1; i >= 0; i--) {
      const entity = entities[i];
      
      try {
        if (updateFn) {
          updateFn(entity, i, entities);
        } else if (typeof entity.update === 'function') {
          entity.update();
        }
        
        // Remove inactive entities
        if (entity.shouldRemove || (entity.hasOwnProperty('active') && !entity.active)) {
          this.removeEntity(collectionName, entity);
        }
      } catch (error) {
        console.error(`Error updating entity in ${collectionName}:`, error);
        this.removeEntity(collectionName, entity);
      }
    }
  }
  
  /**
   * Draw all entities in a collection
   */
  drawCollection(collectionName, viewBounds = null) {
    const collection = this.collections.get(collectionName);
    if (!collection) return;
    
    const entities = viewBounds 
      ? this.getEntitiesInView(collectionName, viewBounds)
      : collection.entities;
    
    // Use registered draw function or default entity draw
    const drawFn = this.drawFunctions.get(collectionName);
    
    for (const entity of entities) {
      try {
        if (drawFn) {
          drawFn(entity);
        } else if (typeof entity.draw === 'function') {
          entity.draw();
        }
      } catch (error) {
        console.error(`Error drawing entity in ${collectionName}:`, error);
      }
    }
  }
  
  /**
   * Update all registered collections
   */
  updateAll(viewBounds = null) {
    for (const collectionName of this.collections.keys()) {
      this.updateCollection(collectionName, viewBounds);
    }
  }
  
  /**
   * Draw all registered collections
   */
  drawAll(viewBounds = null) {
    for (const collectionName of this.collections.keys()) {
      this.drawCollection(collectionName, viewBounds);
    }
  }
  
  /**
   * Clear all entities from a collection
   */
  clearCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) return;
    
    // Return entities to pool if available
    if (this.pools.has(collectionName)) {
      for (const entity of collection.entities) {
        this.returnToPool(collectionName, entity);
      }
    }
    
    this.totalEntities -= collection.entities.length;
    collection.entities = [];
    collection.activeCount = 0;
  }
  
  /**
   * Clear all collections
   */
  clearAll() {
    for (const collectionName of this.collections.keys()) {
      this.clearCollection(collectionName);
    }
  }
  
  /**
   * Get collection statistics
   */
  getStats() {
    const stats = {
      totalCollections: this.collections.size,
      totalEntities: this.totalEntities,
      collections: {}
    };
    
    for (const [name, collection] of this.collections.entries()) {
      stats.collections[name] = {
        count: collection.entities.length,
        maxSize: collection.maxSize,
        poolSize: this.pools.has(name) ? this.pools.get(name).pool.length : 0
      };
    }
    
    return stats;
  }
  
  /**
   * Find entities by criteria
   */
  findEntities(collectionName, predicate) {
    const entities = this.getCollection(collectionName);
    return entities.filter(predicate);
  }
  
  /**
   * Find single entity by ID
   */
  findEntityById(id) {
    for (const collection of this.collections.values()) {
      const entity = collection.entities.find(e => e.id === id);
      if (entity) return entity;
    }
    return null;
  }
  
  /**
   * Check collision between entities in different collections
   */
  checkCollisions(collectionA, collectionB, collisionFn) {
    const entitiesA = this.getCollection(collectionA);
    const entitiesB = this.getCollection(collectionB);
    
    const collisions = [];
    
    for (const entityA of entitiesA) {
      for (const entityB of entitiesB) {
        if (collisionFn(entityA, entityB)) {
          collisions.push({ entityA, entityB });
        }
      }
    }
    
    return collisions;
  }
  
  /**
   * Spatial partitioning for efficient collision detection
   */
  createSpatialGrid(collectionName, gridSize = 100) {
    const entities = this.getCollection(collectionName);
    const grid = new Map();
    
    for (const entity of entities) {
      if (!entity.pos) continue;
      
      const gridX = Math.floor(entity.pos.x / gridSize);
      const gridY = Math.floor(entity.pos.y / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key).push(entity);
    }
    
    return grid;
  }
}

// Create singleton instance
const entityManager = new EntityManager();

export default entityManager;