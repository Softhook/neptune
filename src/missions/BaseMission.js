/**
 * Base Mission Class
 * Provides common functionality for all missions to reduce code duplication
 */

import stateManager from '../core/StateManager.js';

class BaseMission {
  constructor() {
    this.isActive = false;
    this.missionDuration = 5 * 60 * 1000; // 5 minutes default
    this.missionTimerKey = null;
    this.completionCallback = null;
    this.failureCallback = null;
    this.updateInterval = null;
  }
  
  /**
   * Start the mission - to be implemented by subclasses
   */
  startMission() {
    if (this.isActive) {
      console.warn(`Mission ${this.constructor.name} is already active`);
      return false;
    }
    
    this.isActive = true;
    this.onMissionStart();
    
    // Set up timer if duration is specified
    if (this.missionDuration > 0) {
      this.createMissionTimer();
    }
    
    // Set up update interval if needed
    if (this.updateInterval) {
      this.createUpdateTimer();
    }
    
    console.log(`Mission ${this.constructor.name} started`);
    return true;
  }
  
  /**
   * Complete the mission
   */
  completeMission(success = false) {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.clearTimers();
    
    if (success) {
      this.onMissionSuccess();
      if (this.completionCallback) {
        this.completionCallback();
      }
    } else {
      this.onMissionFailure();
      if (this.failureCallback) {
        this.failureCallback();
      }
    }
    
    this.onMissionEnd();
    console.log(`Mission ${this.constructor.name} ${success ? 'completed' : 'failed'}`);
  }
  
  /**
   * Update mission state - called every frame
   */
  update() {
    if (!this.isActive) return;
    
    this.onUpdate();
    
    // Check for mission completion conditions
    if (this.checkCompletionConditions()) {
      this.completeMission(true);
    } else if (this.checkFailureConditions()) {
      this.completeMission(false);
    }
  }
  
  /**
   * Reset mission to initial state
   */
  resetMission() {
    this.isActive = false;
    this.clearTimers();
    this.onReset();
    console.log(`Mission ${this.constructor.name} reset`);
  }
  
  /**
   * Draw mission-specific UI elements
   */
  draw() {
    if (!this.isActive) return;
    this.onDraw();
  }
  
  /**
   * Create mission timeout timer
   */
  createMissionTimer() {
    if (!this.missionTimerKey) {
      this.missionTimerKey = `mission_${this.constructor.name.toLowerCase()}_${Date.now()}`;
    }
    
    // Import GameTimer dynamically to avoid circular dependencies
    if (typeof GameTimer !== 'undefined') {
      GameTimer.create(this.missionTimerKey, () => {
        this.onMissionTimeout();
        this.completeMission(false);
      }, this.missionDuration);
    }
  }
  
  /**
   * Create update timer for periodic checks
   */
  createUpdateTimer() {
    const updateKey = `${this.missionTimerKey}_update`;
    if (typeof GameTimer !== 'undefined') {
      GameTimer.create(updateKey, () => {
        this.onPeriodicUpdate();
      }, this.updateInterval, true); // Repeating timer
    }
  }
  
  /**
   * Clear all mission timers
   */
  clearTimers() {
    if (typeof GameTimer !== 'undefined' && this.missionTimerKey) {
      GameTimer.clearTimer(this.missionTimerKey);
      GameTimer.clearTimer(`${this.missionTimerKey}_update`);
    }
  }
  
  /**
   * Get remaining time for the mission
   */
  getTimeRemaining() {
    if (!this.missionTimerKey || typeof GameTimer === 'undefined') {
      return 0;
    }
    
    const timer = GameTimer.get(this.missionTimerKey);
    return timer ? timer.timeRemaining : 0;
  }
  
  /**
   * Set mission callbacks
   */
  setCallbacks(onComplete, onFailure) {
    this.completionCallback = onComplete;
    this.failureCallback = onFailure;
  }
  
  /**
   * Announce mission message using the game's announcer
   */
  announce(message, voice = 1, pitch = 2, delay = 0) {
    if (typeof announcer !== 'undefined') {
      announcer.speak(message, voice, pitch, delay);
    } else {
      console.log(`Mission Announcement: ${message}`);
    }
  }
  
  /**
   * Update game resources (money, energy, etc.)
   */
  updateResources(changes) {
    for (const [resource, amount] of Object.entries(changes)) {
      const currentValue = stateManager.get(resource);
      if (currentValue !== undefined) {
        stateManager.set(resource, currentValue + amount);
      } else {
        // Fallback for global variables that haven't been migrated yet
        if (typeof window[resource] !== 'undefined') {
          window[resource] += amount;
        }
      }
    }
  }
  
  /**
   * Get mission configuration
   */
  getConfig() {
    return {
      name: this.constructor.name,
      isActive: this.isActive,
      duration: this.missionDuration,
      timeRemaining: this.getTimeRemaining(),
      timerKey: this.missionTimerKey
    };
  }
  
  // Virtual methods to be overridden by subclasses
  onMissionStart() {}
  onMissionSuccess() {}
  onMissionFailure() {}
  onMissionEnd() {}
  onMissionTimeout() {}
  onUpdate() {}
  onPeriodicUpdate() {}
  onDraw() {}
  onReset() {}
  
  checkCompletionConditions() {
    return false; // Override in subclasses
  }
  
  checkFailureConditions() {
    return false; // Override in subclasses
  }
}

export default BaseMission;