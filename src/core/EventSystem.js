/**
 * Centralized Event System
 * Provides decoupled communication between game systems
 */

class EventSystem {
  constructor() {
    this.listeners = new Map();
    this.eventQueue = [];
    this.processing = false;
    this.maxQueueSize = 1000;
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }
  
  /**
   * Subscribe to an event
   */
  on(eventType, callback, context = null) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    const listener = {
      callback,
      context,
      id: Date.now() + Math.random()
    };
    
    this.listeners.get(eventType).push(listener);
    
    // Return unsubscribe function
    return () => this.off(eventType, listener.id);
  }
  
  /**
   * Subscribe to an event only once
   */
  once(eventType, callback, context = null) {
    const unsubscribe = this.on(eventType, (...args) => {
      unsubscribe();
      callback.apply(context, args);
    }, context);
    
    return unsubscribe;
  }
  
  /**
   * Unsubscribe from an event
   */
  off(eventType, listenerId) {
    const listeners = this.listeners.get(eventType);
    if (!listeners) return false;
    
    const index = listeners.findIndex(l => l.id === listenerId);
    if (index === -1) return false;
    
    listeners.splice(index, 1);
    
    // Remove empty listener arrays
    if (listeners.length === 0) {
      this.listeners.delete(eventType);
    }
    
    return true;
  }
  
  /**
   * Emit an event immediately
   */
  emit(eventType, data = null, immediate = false) {
    if (immediate) {
      this.processEvent(eventType, data);
    } else {
      this.queueEvent(eventType, data);
    }
  }
  
  /**
   * Queue an event for later processing
   */
  queueEvent(eventType, data = null) {
    if (this.eventQueue.length >= this.maxQueueSize) {
      console.warn('Event queue is full, dropping oldest event');
      this.eventQueue.shift();
    }
    
    this.eventQueue.push({
      type: eventType,
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Process a single event immediately
   */
  processEvent(eventType, data = null) {
    const listeners = this.listeners.get(eventType);
    if (!listeners || listeners.length === 0) return;
    
    // Add to history
    this.addToHistory(eventType, data);
    
    // Call all listeners
    for (const listener of listeners) {
      try {
        if (listener.context) {
          listener.callback.call(listener.context, data, eventType);
        } else {
          listener.callback(data, eventType);
        }
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    }
  }
  
  /**
   * Process all queued events
   */
  processQueue() {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      this.processEvent(event.type, event.data);
    }
    
    this.processing = false;
  }
  
  /**
   * Add event to history
   */
  addToHistory(eventType, data) {
    this.eventHistory.push({
      type: eventType,
      data,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
  
  /**
   * Get event history
   */
  getHistory(eventType = null) {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }
  
  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
    this.eventQueue = [];
    this.eventHistory = [];
  }
  
  /**
   * Clear listeners for specific event type
   */
  clearListeners(eventType) {
    this.listeners.delete(eventType);
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      totalListeners: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
      eventTypes: this.listeners.size,
      queuedEvents: this.eventQueue.length,
      historySize: this.eventHistory.length
    };
  }
  
  /**
   * Debug information
   */
  debug() {
    console.log('Event System Debug:', {
      listeners: Object.fromEntries(
        Array.from(this.listeners.entries()).map(([type, listeners]) => [type, listeners.length])
      ),
      queuedEvents: this.eventQueue.length,
      recentEvents: this.eventHistory.slice(-10).map(e => e.type)
    });
  }
}

// Pre-defined game events
export const GameEvents = {
  // Game state
  GAME_START: 'game:start',
  GAME_OVER: 'game:over',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  LEVEL_UP: 'game:levelUp',
  
  // Player events
  PLAYER_DAMAGE: 'player:damage',
  PLAYER_HEAL: 'player:heal',
  PLAYER_DEATH: 'player:death',
  PLAYER_RESPAWN: 'player:respawn',
  PLAYER_MODE_CHANGE: 'player:modeChange',
  
  // Entity events
  ENTITY_CREATED: 'entity:created',
  ENTITY_DESTROYED: 'entity:destroyed',
  ENTITY_COLLISION: 'entity:collision',
  
  // Mission events
  MISSION_START: 'mission:start',
  MISSION_COMPLETE: 'mission:complete',
  MISSION_FAIL: 'mission:fail',
  MISSION_UPDATE: 'mission:update',
  
  // Resource events
  ENERGY_CHANGE: 'resource:energyChange',
  MONEY_CHANGE: 'resource:moneyChange',
  RESOURCE_LOW: 'resource:low',
  
  // Base events
  BASE_CREATED: 'base:created',
  BASE_DESTROYED: 'base:destroyed',
  BASE_ATTACKED: 'base:attacked',
  
  // Weather events
  WEATHER_START: 'weather:start',
  WEATHER_END: 'weather:end',
  WEATHER_INTENSITY_CHANGE: 'weather:intensityChange',
  
  // Audio events
  SOUND_PLAY: 'audio:play',
  SOUND_STOP: 'audio:stop',
  MUSIC_CHANGE: 'audio:musicChange',
  
  // UI events
  MENU_OPEN: 'ui:menuOpen',
  MENU_CLOSE: 'ui:menuClose',
  UPGRADE_PURCHASED: 'ui:upgradePurchased',
  
  // System events
  SAVE_GAME: 'system:save',
  LOAD_GAME: 'system:load',
  ERROR: 'system:error',
  DEBUG_TOGGLE: 'system:debugToggle'
};

// Create singleton instance
const eventSystem = new EventSystem();

export default eventSystem;