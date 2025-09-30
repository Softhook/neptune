/**
 * Centralized State Management System for Neptune Game
 * Replaces scattered global variables with organized state management
 */

class StateManager {
  constructor() {
    this.gameState = {
      // Core game state
      mode: 'singlePlayer',
      currentState: 'loading',
      level: 1,
      atEarth: false,
      isWalking: false,
      
      // Resources
      energy: 10000,
      baseEnergy: 10000,
      maxEnergy: 15000,
      money: 0,
      alienEnergy: 10000,
      
      // World properties
      worldWidth: 6000,
      cameraOffset: 0,
      
      // Environment
      dayNightCycle: 0,
      windAngle: 0,
      windForce: 0,
      maxWindForce: 0.01,
      
      // UI state
      showLevelTransition: false,
      loadingProgress: 0,
      gameOverSoundPlayed: false,
      
      // Performance tracking
      frameRates: [],
      lastFPSUpdateTime: 0,
      avgFPS: 0,
      
      // Camera control
      activeMissile: null,
      activeDrone: null,
      cameraFollowsMissile: false,
      cameraFollowsDrone: false
    };
    
    this.subscribers = new Map();
    this.history = [];
    this.maxHistorySize = 100;
  }
  
  /**
   * Get current game state
   */
  getState() {
    return { ...this.gameState };
  }
  
  /**
   * Get specific state property
   */
  get(key) {
    return this.gameState[key];
  }
  
  /**
   * Update state property with validation
   */
  set(key, value) {
    const oldValue = this.gameState[key];
    
    // Validate state changes
    if (!this.validateStateChange(key, value)) {
      console.error(`Invalid state change: ${key} = ${value}`);
      return false;
    }
    
    this.gameState[key] = value;
    
    // Store history for debugging
    this.addToHistory(key, oldValue, value);
    
    // Notify subscribers
    this.notifySubscribers(key, value, oldValue);
    
    return true;
  }
  
  /**
   * Update multiple state properties atomically
   */
  update(updates) {
    const backup = { ...this.gameState };
    let success = true;
    
    try {
      for (const [key, value] of Object.entries(updates)) {
        if (!this.set(key, value)) {
          success = false;
          break;
        }
      }
      
      if (!success) {
        // Rollback on failure
        this.gameState = backup;
        console.error('State update failed, rolled back');
      }
      
      return success;
    } catch (error) {
      this.gameState = backup;
      console.error('State update error:', error);
      return false;
    }
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }
  
  /**
   * Validate state changes based on game rules
   */
  validateStateChange(key, value) {
    switch (key) {
      case 'energy':
        return typeof value === 'number' && value >= 0 && value <= this.gameState.maxEnergy;
      case 'money':
        return typeof value === 'number' && value >= 0;
      case 'level':
        return typeof value === 'number' && value >= 1;
      case 'windForce':
        return typeof value === 'number' && Math.abs(value) <= this.gameState.maxWindForce;
      case 'currentState':
        return ['loading', 'title', 'start', 'playing', 'gameOver', 'victory', 'error'].includes(value);
      case 'mode':
        return ['singlePlayer', 'twoPlayer'].includes(value);
      default:
        return true; // Allow other properties by default
    }
  }
  
  /**
   * Notify subscribers of state changes
   */
  notifySubscribers(key, newValue, oldValue) {
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error(`Error in state subscriber for ${key}:`, error);
        }
      });
    }
  }
  
  /**
   * Add state change to history for debugging
   */
  addToHistory(key, oldValue, newValue) {
    this.history.push({
      timestamp: Date.now(),
      key,
      oldValue,
      newValue
    });
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
  
  /**
   * Get state change history
   */
  getHistory() {
    return [...this.history];
  }
  
  /**
   * Reset state to initial values
   */
  reset() {
    const initialState = {
      mode: 'singlePlayer',
      currentState: 'loading',
      level: 1,
      atEarth: false,
      isWalking: false,
      energy: 10000,
      baseEnergy: 10000,
      maxEnergy: 15000,
      money: 0,
      alienEnergy: 10000,
      worldWidth: 6000,
      cameraOffset: 0,
      dayNightCycle: 0,
      windAngle: 0,
      windForce: 0,
      maxWindForce: 0.01,
      showLevelTransition: false,
      loadingProgress: 0,
      gameOverSoundPlayed: false,
      frameRates: [],
      lastFPSUpdateTime: 0,
      avgFPS: 0,
      activeMissile: null,
      activeDrone: null,
      cameraFollowsMissile: false,
      cameraFollowsDrone: false
    };
    
    this.gameState = initialState;
    this.history = [];
    this.notifySubscribers('reset', null, null);
  }
  
  /**
   * Serialize state for saving
   */
  serialize() {
    return JSON.stringify(this.gameState);
  }
  
  /**
   * Deserialize state for loading
   */
  deserialize(serializedState) {
    try {
      const loadedState = JSON.parse(serializedState);
      
      // Validate loaded state
      for (const [key, value] of Object.entries(loadedState)) {
        if (!this.validateStateChange(key, value)) {
          console.error(`Invalid loaded state: ${key} = ${value}`);
          return false;
        }
      }
      
      this.gameState = { ...this.gameState, ...loadedState };
      this.notifySubscribers('load', this.gameState, null);
      return true;
    } catch (error) {
      console.error('Failed to deserialize state:', error);
      return false;
    }
  }
}

// Create singleton instance
const stateManager = new StateManager();

export default stateManager;