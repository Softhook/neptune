/**
 * Mission Factory - Creates and manages mission instances
 */

import BaseMission from './BaseMission.js';
import DrillMission from './DrillMission.js';
import BaseDefenseMission from './BaseDefenseMission.js';
import eventSystem, { GameEvents } from '../core/EventSystem.js';
import configManager from '../core/ConfigManager.js';
import stateManager from '../core/StateManager.js';

class MissionFactory {
  constructor() {
    this.missionTypes = new Map();
    this.missionConfigs = new Map();
    this.registerDefaultMissions();
  }
  
  registerDefaultMissions() {
    // Register built-in mission types
    this.registerMission('drill', DrillMission, {
      displayName: 'Hydrogen Extraction',
      description: 'Deploy and protect drill rigs to extract hydrogen energy',
      difficulty: 'medium',
      duration: 600000, // 10 minutes
      rewards: { money: 10000, experience: 100 },
      requirements: { level: 1, money: 0 },
      cooldown: 120000, // 2 minutes
      category: 'resource'
    });
    
    this.registerMission('baseDefense', BaseDefenseMission, {
      displayName: 'Base Defense',
      description: 'Defend all moon bases from coordinated alien attacks',
      difficulty: 'hard',
      duration: 300000, // 5 minutes
      rewards: { money: 15000, experience: 150 },
      requirements: { level: 2, bases: 2 },
      cooldown: 180000, // 3 minutes
      category: 'combat'
    });
    
    // TODO: Add more missions as they get refactored
    // this.registerMission('rescue', RescueMission, { ... });
    // this.registerMission('artifact', ArtifactMission, { ... });
    // this.registerMission('earthDefense', EarthDefenseMission, { ... });
  }
  
  /**
   * Register a new mission type
   */
  registerMission(type, MissionClass, config = {}) {
    if (!MissionClass.prototype instanceof BaseMission && MissionClass !== BaseMission) {
      throw new Error(`Mission class must extend BaseMission: ${type}`);
    }
    
    this.missionTypes.set(type, MissionClass);
    this.missionConfigs.set(type, {
      displayName: type,
      description: 'No description provided',
      difficulty: 'medium',
      duration: 300000, // 5 minutes default
      rewards: { money: 5000, experience: 50 },
      requirements: { level: 1 },
      cooldown: 60000, // 1 minute default
      category: 'general',
      ...config
    });
    
    console.log(`Registered mission type: ${type}`);
  }
  
  /**
   * Create a mission instance
   */
  createMission(type, options = {}) {
    const MissionClass = this.missionTypes.get(type);
    if (!MissionClass) {
      throw new Error(`Unknown mission type: ${type}`);
    }
    
    const config = this.missionConfigs.get(type);
    
    // Check requirements
    if (!this.checkRequirements(type)) {
      throw new Error(`Requirements not met for mission: ${type}`);
    }
    
    const mission = new MissionClass();
    
    // Apply configuration
    if (config.duration) {
      mission.missionDuration = config.duration;
    }
    
    // Apply any custom options
    Object.assign(mission, options);
    
    // Set mission type for tracking
    mission.missionType = type;
    mission.config = config;
    
    return mission;
  }
  
  /**
   * Check if requirements are met for a mission type
   */
  checkRequirements(type) {
    const config = this.missionConfigs.get(type);
    if (!config.requirements) return true;
    
    const requirements = config.requirements;
    
    // Check level requirement
    if (requirements.level) {
      const currentLevel = stateManager.get('level') || 1;
      if (currentLevel < requirements.level) {
        return false;
      }
    }
    
    // Check money requirement
    if (requirements.money) {
      const currentMoney = stateManager.get('money') || 0;
      if (currentMoney < requirements.money) {
        return false;
      }
    }
    
    // Check base requirement
    if (requirements.bases) {
      const baseCount = this.getCurrentBaseCount();
      if (baseCount < requirements.bases) {
        return false;
      }
    }
    
    // Check energy requirement
    if (requirements.energy) {
      const currentEnergy = stateManager.get('energy') || 0;
      if (currentEnergy < requirements.energy) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get available mission types based on current game state
   */
  getAvailableMissions() {
    const available = [];
    
    for (const [type, config] of this.missionConfigs.entries()) {
      if (this.checkRequirements(type)) {
        available.push({
          type,
          config: { ...config },
          canStart: this.canStartMission(type)
        });
      }
    }
    
    return available;
  }
  
  /**
   * Check if a specific mission can be started (considering cooldowns)
   */
  canStartMission(type) {
    // Check global mission cooldown
    const lastMissionEnd = stateManager.get('lastMissionEndTime') || 0;
    const missionCooldown = configManager.get('missions', 'missionCooldown') || 60000;
    
    if (Date.now() - lastMissionEnd < missionCooldown) {
      return false;
    }
    
    // Check mission-specific cooldown
    const config = this.missionConfigs.get(type);
    const lastMissionOfType = stateManager.get(`lastMission_${type}`) || 0;
    
    if (Date.now() - lastMissionOfType < config.cooldown) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get mission types by category
   */
  getMissionsByCategory(category) {
    const missions = [];
    
    for (const [type, config] of this.missionConfigs.entries()) {
      if (config.category === category) {
        missions.push({
          type,
          config: { ...config },
          available: this.checkRequirements(type),
          canStart: this.canStartMission(type)
        });
      }
    }
    
    return missions;
  }
  
  /**
   * Get mission difficulty levels
   */
  getMissionsByDifficulty(difficulty) {
    const missions = [];
    
    for (const [type, config] of this.missionConfigs.entries()) {
      if (config.difficulty === difficulty) {
        missions.push({
          type,
          config: { ...config },
          available: this.checkRequirements(type),
          canStart: this.canStartMission(type)
        });
      }
    }
    
    return missions;
  }
  
  /**
   * Get random mission type weighted by difficulty and player level
   */
  getRandomMissionType() {
    const available = this.getAvailableMissions().filter(m => m.canStart);
    if (available.length === 0) return null;
    
    const playerLevel = stateManager.get('level') || 1;
    
    // Weight missions by difficulty relative to player level
    const weighted = [];
    
    for (const mission of available) {
      let weight = 1;
      
      switch (mission.config.difficulty) {
        case 'easy':
          weight = playerLevel > 3 ? 0.5 : 2; // Less likely for high-level players
          break;
        case 'medium':
          weight = 1; // Always normal weight
          break;
        case 'hard':
          weight = playerLevel < 3 ? 0.2 : 1.5; // Less likely for low-level players
          break;
        case 'extreme':
          weight = playerLevel < 5 ? 0.1 : 2; // Very unlikely for low-level players
          break;
      }
      
      // Add multiple entries based on weight
      for (let i = 0; i < Math.ceil(weight * 10); i++) {
        weighted.push(mission.type);
      }
    }
    
    if (weighted.length === 0) return null;
    
    return weighted[Math.floor(Math.random() * weighted.length)];
  }
  
  /**
   * Update mission configuration
   */
  updateMissionConfig(type, updates) {
    const config = this.missionConfigs.get(type);
    if (!config) {
      throw new Error(`Mission type not found: ${type}`);
    }
    
    Object.assign(config, updates);
    this.missionConfigs.set(type, config);
    
    eventSystem.emit('mission:configUpdated', { type, config });
  }
  
  /**
   * Get mission configuration
   */
  getMissionConfig(type) {
    const config = this.missionConfigs.get(type);
    return config ? { ...config } : null;
  }
  
  /**
   * Get all registered mission types
   */
  getAllMissionTypes() {
    return Array.from(this.missionTypes.keys());
  }
  
  /**
   * Validate mission class
   */
  validateMissionClass(MissionClass) {
    const requiredMethods = [
      'onMissionStart', 'onUpdate', 'onDraw', 'onReset',
      'checkCompletionConditions', 'checkFailureConditions'
    ];
    
    for (const method of requiredMethods) {
      if (typeof MissionClass.prototype[method] !== 'function') {
        throw new Error(`Mission class missing required method: ${method}`);
      }
    }
    
    return true;
  }
  
  /**
   * Helper to get current base count
   */
  getCurrentBaseCount() {
    if (typeof MoonBase !== 'undefined' && MoonBase.moonBases) {
      return MoonBase.moonBases.length;
    }
    
    if (typeof entityManager !== 'undefined') {
      return entityManager.getCollection('bases').length;
    }
    
    return 0;
  }
  
  /**
   * Export configuration for saving
   */
  exportConfig() {
    const config = {};
    
    for (const [type, missionConfig] of this.missionConfigs.entries()) {
      config[type] = { ...missionConfig };
    }
    
    return config;
  }
  
  /**
   * Import configuration from saved data
   */
  importConfig(config) {
    for (const [type, missionConfig] of Object.entries(config)) {
      if (this.missionTypes.has(type)) {
        this.missionConfigs.set(type, { ...missionConfig });
      }
    }
  }
}

export default MissionFactory;