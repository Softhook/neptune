/**
 * Mission Manager - Handles mission lifecycle and coordination
 */

import MissionFactory from './MissionFactory.js';
import eventSystem, { GameEvents } from '../core/EventSystem.js';
import stateManager from '../core/StateManager.js';
import configManager from '../core/ConfigManager.js';

class MissionManager {
  constructor() {
    this.factory = new MissionFactory();
    this.activeMission = null;
    this.missionHistory = [];
    this.maxHistorySize = 50;
    
    // Mission scheduling
    this.autoMissionEnabled = true;
    this.nextAutoMissionTime = 0;
    this.autoMissionInterval = 300000; // 5 minutes between auto missions
    
    // Statistics
    this.stats = {
      totalMissions: 0,
      completedMissions: 0,
      failedMissions: 0,
      totalRewards: { money: 0, experience: 0 },
      missionsByType: new Map(),
      averageCompletionTime: 0
    };
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Listen for mission-related events
    eventSystem.on(GameEvents.GAME_START, () => {
      this.scheduleNextAutoMission();
    });
    
    eventSystem.on(GameEvents.LEVEL_UP, () => {
      // New missions might become available
      this.checkNewMissionsAvailable();
    });
  }
  
  /**
   * Start a specific mission
   */
  startMission(missionType, options = {}) {
    if (this.activeMission) {
      throw new Error('Another mission is already active');
    }
    
    if (!this.factory.canStartMission(missionType)) {
      throw new Error(`Mission ${missionType} is on cooldown or not available`);
    }
    
    try {
      this.activeMission = this.factory.createMission(missionType, options);
      
      // Set up mission callbacks
      this.activeMission.setCallbacks(
        () => this.onMissionComplete(true),
        () => this.onMissionComplete(false)
      );
      
      // Start the mission
      const success = this.activeMission.startMission();
      if (!success) {
        this.activeMission = null;
        throw new Error(`Failed to start mission: ${missionType}`);
      }
      
      // Update statistics
      this.stats.totalMissions++;
      const typeStats = this.stats.missionsByType.get(missionType) || { attempts: 0, completed: 0, failed: 0 };
      typeStats.attempts++;
      this.stats.missionsByType.set(missionType, typeStats);
      
      // Update state
      stateManager.set(`lastMission_${missionType}`, Date.now());
      
      // Log mission start
      this.addToHistory({
        type: missionType,
        action: 'started',
        timestamp: Date.now(),
        config: this.activeMission.config
      });
      
      console.log(`Mission started: ${missionType}`);
      return this.activeMission;
      
    } catch (error) {
      this.activeMission = null;
      console.error('Failed to start mission:', error);
      throw error;
    }
  }
  
  /**
   * Start a random mission
   */
  startRandomMission() {
    const missionType = this.factory.getRandomMissionType();
    if (!missionType) {
      console.log('No missions available for random start');
      return null;
    }
    
    try {
      return this.startMission(missionType);
    } catch (error) {
      console.error('Failed to start random mission:', error);
      return null;
    }
  }
  
  /**
   * Update active mission
   */
  update() {
    if (!this.activeMission) {
      this.checkAutoMission();
      return;
    }
    
    try {
      this.activeMission.update();
    } catch (error) {
      console.error('Mission update error:', error);
      this.endMission(false);
    }
  }
  
  /**
   * Draw active mission UI
   */
  draw() {
    if (this.activeMission) {
      try {
        this.activeMission.draw();
      } catch (error) {
        console.error('Mission draw error:', error);
      }
    }
  }
  
  /**
   * End the current mission
   */
  endMission(success = false) {
    if (!this.activeMission) return;
    
    const mission = this.activeMission;
    const completionTime = Date.now() - mission.createdAt;
    
    // Reset mission
    mission.resetMission();
    
    // Update statistics
    if (success) {
      this.stats.completedMissions++;
      const typeStats = this.stats.missionsByType.get(mission.missionType);
      if (typeStats) {
        typeStats.completed++;
      }
      
      // Update average completion time
      const totalCompleted = this.stats.completedMissions;
      this.stats.averageCompletionTime = 
        (this.stats.averageCompletionTime * (totalCompleted - 1) + completionTime) / totalCompleted;
      
    } else {
      this.stats.failedMissions++;
      const typeStats = this.stats.missionsByType.get(mission.missionType);
      if (typeStats) {
        typeStats.failed++;
      }
    }
    
    // Log mission end
    this.addToHistory({
      type: mission.missionType,
      action: success ? 'completed' : 'failed',
      timestamp: Date.now(),
      duration: completionTime,
      config: mission.config
    });
    
    // Update global state
    stateManager.set('lastMissionEndTime', Date.now());
    
    // Clear active mission
    this.activeMission = null;
    
    // Schedule next auto mission
    this.scheduleNextAutoMission();
    
    console.log(`Mission ${success ? 'completed' : 'failed'}: ${mission.missionType}`);
    
    eventSystem.emit('mission:ended', {
      type: mission.missionType,
      success: success,
      duration: completionTime
    });
  }
  
  /**
   * Mission completion callback
   */
  onMissionComplete(success) {
    if (!this.activeMission) return;
    
    const mission = this.activeMission;
    
    // Award rewards if successful
    if (success && mission.config.rewards) {
      this.awardRewards(mission.config.rewards);
    }
    
    this.endMission(success);
  }
  
  /**
   * Award mission rewards
   */
  awardRewards(rewards) {
    if (rewards.money) {
      const currentMoney = stateManager.get('money') || 0;
      stateManager.set('money', currentMoney + rewards.money);
      this.stats.totalRewards.money += rewards.money;
    }
    
    if (rewards.experience) {
      // TODO: Implement experience system
      this.stats.totalRewards.experience += rewards.experience;
    }
    
    if (rewards.energy) {
      const currentEnergy = stateManager.get('energy') || 0;
      const maxEnergy = stateManager.get('maxEnergy') || 15000;
      stateManager.set('energy', Math.min(maxEnergy, currentEnergy + rewards.energy));
    }
    
    eventSystem.emit('mission:rewardsAwarded', { rewards });
  }
  
  /**
   * Check for auto mission trigger
   */
  checkAutoMission() {
    if (!this.autoMissionEnabled || Date.now() < this.nextAutoMissionTime) {
      return;
    }
    
    // Random chance to start auto mission
    const autoChance = configManager.get('missions', 'autoMissionChance') || 0.3;
    if (Math.random() < autoChance) {
      this.startRandomMission();
    } else {
      // Reschedule for later
      this.scheduleNextAutoMission();
    }
  }
  
  /**
   * Schedule next auto mission
   */
  scheduleNextAutoMission() {
    const interval = configManager.get('missions', 'autoMissionInterval') || this.autoMissionInterval;
    const randomDelay = Math.random() * interval * 0.5; // Add up to 50% random delay
    this.nextAutoMissionTime = Date.now() + interval + randomDelay;
  }
  
  /**
   * Check for newly available missions
   */
  checkNewMissionsAvailable() {
    const available = this.factory.getAvailableMissions();
    const newMissions = available.filter(m => 
      !this.missionHistory.some(h => h.type === m.type)
    );
    
    if (newMissions.length > 0) {
      eventSystem.emit('mission:newMissionsAvailable', { missions: newMissions });
      
      // Announce new missions
      if (typeof announcer !== 'undefined') {
        announcer.speak(`New mission types available, Commander.`, 1, 2, 0);
      }
    }
  }
  
  /**
   * Add entry to mission history
   */
  addToHistory(entry) {
    this.missionHistory.push(entry);
    
    // Limit history size
    if (this.missionHistory.length > this.maxHistorySize) {
      this.missionHistory.shift();
    }
  }
  
  /**
   * Get current mission status
   */
  getCurrentMissionStatus() {
    if (!this.activeMission) {
      return { active: false };
    }
    
    return {
      active: true,
      type: this.activeMission.missionType,
      config: this.activeMission.getConfig(),
      timeRemaining: this.activeMission.getTimeRemaining(),
      progress: this.calculateMissionProgress()
    };
  }
  
  /**
   * Calculate mission progress (0-1)
   */
  calculateMissionProgress() {
    if (!this.activeMission) return 0;
    
    const elapsed = Date.now() - this.activeMission.createdAt;
    const timeProgress = elapsed / this.activeMission.missionDuration;
    
    // Override with mission-specific progress if available
    if (typeof this.activeMission.getProgress === 'function') {
      return this.activeMission.getProgress();
    }
    
    return Math.min(1, timeProgress);
  }
  
  /**
   * Get available missions
   */
  getAvailableMissions() {
    return this.factory.getAvailableMissions();
  }
  
  /**
   * Get missions by category
   */
  getMissionsByCategory(category) {
    return this.factory.getMissionsByCategory(category);
  }
  
  /**
   * Get mission statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      successRate: this.stats.totalMissions > 0 ? 
        this.stats.completedMissions / this.stats.totalMissions : 0,
      activeMission: this.activeMission ? {
        type: this.activeMission.missionType,
        timeElapsed: Date.now() - this.activeMission.createdAt,
        timeRemaining: this.activeMission.getTimeRemaining()
      } : null
    };
  }
  
  /**
   * Get mission history
   */
  getHistory(limit = 10) {
    return this.missionHistory.slice(-limit).reverse();
  }
  
  /**
   * Force end current mission
   */
  forceMissionEnd() {
    if (this.activeMission) {
      this.endMission(false);
    }
  }
  
  /**
   * Enable/disable auto missions
   */
  setAutoMissionEnabled(enabled) {
    this.autoMissionEnabled = enabled;
    if (enabled) {
      this.scheduleNextAutoMission();
    }
  }
  
  /**
   * Register custom mission type
   */
  registerMissionType(type, MissionClass, config) {
    this.factory.registerMission(type, MissionClass, config);
  }
  
  /**
   * Serialize manager state
   */
  serialize() {
    return {
      stats: this.stats,
      missionHistory: this.missionHistory,
      autoMissionEnabled: this.autoMissionEnabled,
      nextAutoMissionTime: this.nextAutoMissionTime,
      activeMission: this.activeMission ? {
        type: this.activeMission.missionType,
        state: this.activeMission.serialize()
      } : null
    };
  }
  
  /**
   * Deserialize manager state
   */
  deserialize(data) {
    if (data.stats) {
      Object.assign(this.stats, data.stats);
    }
    
    if (data.missionHistory) {
      this.missionHistory = data.missionHistory;
    }
    
    if (data.autoMissionEnabled !== undefined) {
      this.autoMissionEnabled = data.autoMissionEnabled;
    }
    
    if (data.nextAutoMissionTime) {
      this.nextAutoMissionTime = data.nextAutoMissionTime;
    }
    
    // Restore active mission if any
    if (data.activeMission) {
      try {
        this.activeMission = this.factory.createMission(data.activeMission.type);
        this.activeMission.deserialize(data.activeMission.state);
        this.activeMission.setCallbacks(
          () => this.onMissionComplete(true),
          () => this.onMissionComplete(false)
        );
      } catch (error) {
        console.error('Failed to restore active mission:', error);
        this.activeMission = null;
      }
    }
  }
}

export default MissionManager;