/**
 * Configuration Management System
 * Centralizes all game configuration and constants
 */

class ConfigManager {
  constructor() {
    this.configs = new Map();
    this.loadDefaultConfigs();
  }
  
  /**
   * Load default game configurations
   */
  loadDefaultConfigs() {
    // Game settings
    this.set('game', {
      title: 'Neptune',
      version: '1.0.0',
      debugMode: false,
      maxFPS: 60,
      worldWidth: 6000,
      cycleSpeed: 0.00002,
      fpsUpdateInterval: 1000
    });
    
    // Player settings
    this.set('player', {
      startingEnergy: 10000,
      maxEnergy: 15000,
      startingMoney: 0,
      healRate: 1,
      invulnerabilityDuration: 60
    });
    
    // Physics settings
    this.set('physics', {
      gravity: 0.5,
      friction: 0.98,
      bounciness: 0.5,
      maxWindForce: 0.01,
      terminalVelocity: 10
    });
    
    // Entity limits
    this.set('limits', {
      maxAliens: 100,
      maxBullets: 200,
      maxParticles: 150,
      maxWorms: 10,
      maxWalkers: 5,
      maxPlants: 70,
      maxClusters: 10
    });
    
    // Visual settings
    this.set('graphics', {
      showDebugInfo: false,
      particleQuality: 'high', // low, medium, high
      shadowQuality: 'medium',
      viewCulling: true,
      maxViewDistance: 1500
    });
    
    // Audio settings
    this.set('audio', {
      masterVolume: 1.0,
      musicVolume: 0.7,
      sfxVolume: 0.8,
      voiceVolume: 1.0,
      audioEnabled: true
    });
    
    // Mission settings
    this.set('missions', {
      defaultDuration: 300000, // 5 minutes
      missionCooldown: 60000,  // 1 minute
      maxActiveMissions: 1,
      difficultyScale: 1.0
    });
    
    // UI settings
    this.set('ui', {
      hudEnabled: true,
      minimapEnabled: true,
      tooltipsEnabled: true,
      animationSpeed: 1.0,
      fontSize: 16
    });
    
    // Performance settings
    this.set('performance', {
      objectPooling: true,
      spatialPartitioning: true,
      cullingEnabled: true,
      updateFrequency: 60,
      maxHistorySize: 100
    });
    
    // Color schemes
    this.set('colors', {
      dawn: [255, 200, 100],
      day: [135, 206, 235],
      dusk: [255, 100, 100],
      night: [0, 0, 0],
      moonSurfaceDay: [0, 0, 255],
      moonSurfaceNight: [0, 0, 50],
      ui: {
        primary: [100, 150, 255],
        secondary: [150, 150, 150],
        success: [100, 255, 100],
        warning: [255, 255, 100],
        danger: [255, 100, 100]
      }
    });
    
    // Input settings
    this.set('input', {
      keyRepeatDelay: 250,
      mouseSensitivity: 1.0,
      touchEnabled: true,
      gamepadEnabled: false
    });
    
    // Upgrade settings
    this.set('upgrades', {
      maxUpgradeLevel: 5,
      costMultiplier: 1.5,
      effectMultiplier: 1.2,
      unlockRequirements: {
        walker: { level: 2 },
        missile: { level: 3 },
        drone: { level: 4 }
      }
    });
  }
  
  /**
   * Get configuration value
   */
  get(category, key = null) {
    const config = this.configs.get(category);
    if (!config) {
      console.warn(`Configuration category '${category}' not found`);
      return null;
    }
    
    if (key === null) {
      return { ...config }; // Return copy of entire category
    }
    
    return this.getNestedValue(config, key);
  }
  
  /**
   * Set configuration value
   */
  set(category, keyOrValue, value = null) {
    if (value === null && typeof keyOrValue === 'object') {
      // Setting entire category
      this.configs.set(category, { ...keyOrValue });
    } else {
      // Setting specific key
      if (!this.configs.has(category)) {
        this.configs.set(category, {});
      }
      
      const config = this.configs.get(category);
      this.setNestedValue(config, keyOrValue, value);
    }
    
    this.onConfigChanged(category, keyOrValue, value);
  }
  
  /**
   * Update configuration values
   */
  update(category, updates) {
    if (!this.configs.has(category)) {
      this.configs.set(category, {});
    }
    
    const config = this.configs.get(category);
    
    for (const [key, value] of Object.entries(updates)) {
      this.setNestedValue(config, key, value);
    }
    
    this.onConfigChanged(category, updates);
  }
  
  /**
   * Get nested value using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }
  
  /**
   * Set nested value using dot notation
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let current = obj;
    for (const key of keys) {
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }
  
  /**
   * Check if configuration exists
   */
  has(category, key = null) {
    const config = this.configs.get(category);
    if (!config) return false;
    
    if (key === null) return true;
    
    return this.getNestedValue(config, key) !== null;
  }
  
  /**
   * Remove configuration
   */
  remove(category, key = null) {
    if (key === null) {
      return this.configs.delete(category);
    }
    
    const config = this.configs.get(category);
    if (!config) return false;
    
    const keys = key.split('.');
    const lastKey = keys.pop();
    
    let current = config;
    for (const k of keys) {
      if (!current[k]) return false;
      current = current[k];
    }
    
    delete current[lastKey];
    return true;
  }
  
  /**
   * Get all configuration categories
   */
  getCategories() {
    return Array.from(this.configs.keys());
  }
  
  /**
   * Get all configurations
   */
  getAll() {
    const result = {};
    for (const [category, config] of this.configs.entries()) {
      result[category] = { ...config };
    }
    return result;
  }
  
  /**
   * Load configurations from JSON
   */
  loadFromJSON(json) {
    try {
      const configs = JSON.parse(json);
      for (const [category, config] of Object.entries(configs)) {
        this.set(category, config);
      }
      return true;
    } catch (error) {
      console.error('Failed to load configuration from JSON:', error);
      return false;
    }
  }
  
  /**
   * Export configurations to JSON
   */
  toJSON() {
    return JSON.stringify(this.getAll(), null, 2);
  }
  
  /**
   * Save configurations to localStorage
   */
  save() {
    try {
      localStorage.setItem('neptune_config', this.toJSON());
      return true;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      return false;
    }
  }
  
  /**
   * Load configurations from localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem('neptune_config');
      if (saved) {
        return this.loadFromJSON(saved);
      }
      return false;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      return false;
    }
  }
  
  /**
   * Reset to default configurations
   */
  reset() {
    this.configs.clear();
    this.loadDefaultConfigs();
    this.onConfigChanged('all', null, null);
  }
  
  /**
   * Validate configuration value
   */
  validate(category, key, value) {
    // Add validation rules here
    switch (category) {
      case 'audio':
        if (key.includes('Volume')) {
          return typeof value === 'number' && value >= 0 && value <= 1;
        }
        break;
      case 'physics':
        if (key === 'gravity') {
          return typeof value === 'number' && value >= 0;
        }
        break;
      case 'limits':
        return typeof value === 'number' && value > 0;
    }
    
    return true; // Allow by default
  }
  
  /**
   * Called when configuration changes
   */
  onConfigChanged(category, key, value) {
    // Emit event if event system is available
    if (typeof eventSystem !== 'undefined') {
      eventSystem.emit('config:changed', { category, key, value });
    }
  }
  
  /**
   * Get configuration preset
   */
  getPreset(name) {
    const presets = {
      lowPerformance: {
        graphics: { particleQuality: 'low', shadowQuality: 'low' },
        performance: { cullingEnabled: true, updateFrequency: 30 },
        limits: { maxAliens: 50, maxBullets: 100, maxParticles: 75 }
      },
      highPerformance: {
        graphics: { particleQuality: 'high', shadowQuality: 'high' },
        performance: { cullingEnabled: false, updateFrequency: 60 },
        limits: { maxAliens: 150, maxBullets: 300, maxParticles: 250 }
      }
    };
    
    return presets[name] || null;
  }
  
  /**
   * Apply configuration preset
   */
  applyPreset(name) {
    const preset = this.getPreset(name);
    if (!preset) {
      console.warn(`Preset '${name}' not found`);
      return false;
    }
    
    for (const [category, settings] of Object.entries(preset)) {
      this.update(category, settings);
    }
    
    return true;
  }
}

// Create singleton instance
const configManager = new ConfigManager();

export default configManager;