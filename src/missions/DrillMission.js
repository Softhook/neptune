/**
 * Drill Mission - Refactored to use BaseMission
 * Mission to collect energy through drill rigs
 */

import BaseMission from './BaseMission.js';
import eventSystem, { GameEvents } from '../core/EventSystem.js';
import entityManager from '../core/EntityManager.js';
import stateManager from '../core/StateManager.js';

class DrillMission extends BaseMission {
  constructor() {
    super();
    
    this.energyRequired = 2000;
    this.energyCollected = 0;
    this.previousRigCount = 0;
    this.missionDuration = 10 * 60 * 1000; // 10 minutes
    this.missionTimerKey = 'drillMission';
    
    // Mission-specific settings
    this.requiredRigs = 3;
    this.energyPerSecond = 5;
    this.rigHealthThreshold = 50; // Minimum health for rigs to be effective
  }
  
  onMissionStart() {
    this.energyCollected = 0;
    this.previousRigCount = this.getCurrentRigCount();
    
    this.announce(
      `Commander, we need to extract ${this.energyRequired} units of hydrogen energy. Deploy drill rigs and protect them from alien attacks. You have ${this.missionDuration / 60000} minutes.`,
      1, 2, 0
    );
    
    // Set up periodic energy collection
    this.updateInterval = 1000; // Check every second
    
    eventSystem.emit(GameEvents.MISSION_START, {
      type: 'drill',
      energyRequired: this.energyRequired,
      duration: this.missionDuration
    });
  }
  
  onPeriodicUpdate() {
    // Collect energy from active drill rigs
    const currentRigs = this.getActiveRigs();
    let energyThisSecond = 0;
    
    for (const rig of currentRigs) {
      if (rig.health > this.rigHealthThreshold) {
        energyThisSecond += this.energyPerSecond;
        
        // Add visual effect to active rigs
        this.createDrillingEffect(rig);
      }
    }
    
    this.energyCollected += energyThisSecond;
    
    // Update global energy too
    if (energyThisSecond > 0) {
      const currentEnergy = stateManager.get('energy') || 0;
      const maxEnergy = stateManager.get('maxEnergy') || 15000;
      stateManager.set('energy', Math.min(maxEnergy, currentEnergy + energyThisSecond));
    }
    
    // Emit progress update
    eventSystem.emit(GameEvents.MISSION_UPDATE, {
      type: 'drill',
      progress: this.energyCollected / this.energyRequired,
      energyCollected: this.energyCollected,
      currentRigs: currentRigs.length
    });
    
    // Check if rigs are under attack
    this.checkRigSafety(currentRigs);
  }
  
  onUpdate() {
    // Check for rig destruction
    const currentRigCount = this.getCurrentRigCount();
    if (currentRigCount < this.previousRigCount) {
      const rigsLost = this.previousRigCount - currentRigCount;
      this.announce(`Warning! ${rigsLost} drill rig${rigsLost > 1 ? 's have' : ' has'} been destroyed!`, 1, 1.5, 0);
      
      // Emit event for rig destruction
      eventSystem.emit('drill:rigDestroyed', {
        rigsLost: rigsLost,
        remaining: currentRigCount
      });
    }
    this.previousRigCount = currentRigCount;
    
    // Check if we need more rigs
    if (currentRigCount < this.requiredRigs && Math.random() < 0.01) { // 1% chance per frame
      this.announce(`Deploy more drill rigs to increase extraction rate. Current rigs: ${currentRigCount}`, 1, 1, 0);
    }
  }
  
  checkCompletionConditions() {
    return this.energyCollected >= this.energyRequired;
  }
  
  checkFailureConditions() {
    // Fail if all rigs are destroyed and we haven't collected enough energy
    const activeRigs = this.getActiveRigs();
    return activeRigs.length === 0 && this.energyCollected < this.energyRequired;
  }
  
  getCurrentRigCount() {
    if (typeof DrillRig !== 'undefined' && DrillRig.rigs) {
      return DrillRig.rigs.length;
    }
    return entityManager.getCollection('drillRigs').length;
  }
  
  getActiveRigs() {
    if (typeof DrillRig !== 'undefined' && DrillRig.rigs) {
      return DrillRig.rigs.filter(rig => rig.active && rig.health > 0);
    }
    return entityManager.getCollection('drillRigs').filter(rig => rig.active && rig.health > 0);
  }
  
  checkRigSafety(rigs) {
    let rigsUnderAttack = 0;
    
    for (const rig of rigs) {
      // Check for nearby enemies
      const enemies = [
        ...entityManager.getCollection('aliens'),
        ...entityManager.getCollection('hunters'),
        ...entityManager.getCollection('destroyers')
      ];
      
      for (const enemy of enemies) {
        if (rig.distanceTo && rig.distanceTo(enemy) < 100) {
          rigsUnderAttack++;
          
          // Add warning indicator to rig
          rig.underAttack = true;
          break;
        }
      }
    }
    
    if (rigsUnderAttack > 0 && Math.random() < 0.005) { // Occasional warning
      this.announce(`${rigsUnderAttack} drill rig${rigsUnderAttack > 1 ? 's are' : ' is'} under attack! Defend them!`, 1, 1.5, 0);
    }
  }
  
  createDrillingEffect(rig) {
    // Create drilling particles
    const particleCount = 2;
    for (let i = 0; i < particleCount; i++) {
      const particle = {
        x: rig.pos.x + (Math.random() - 0.5) * rig.size,
        y: rig.pos.y + rig.size/2,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1,
        life: 30,
        maxLife: 30,
        color: [100, 50, 0], // Brown dirt particles
        size: Math.random() * 3 + 1
      };
      
      entityManager.addEntity('particles', particle);
    }
    
    // Create energy collection effect occasionally
    if (Math.random() < 0.1) {
      const energyParticle = {
        x: rig.pos.x,
        y: rig.pos.y - rig.size,
        vx: 0,
        vy: -2,
        life: 60,
        maxLife: 60,
        color: [0, 255, 255], // Cyan energy
        size: 4
      };
      
      entityManager.addEntity('particles', energyParticle);
    }
  }
  
  onMissionSuccess() {
    this.announce("Mission complete. Hydrogen extracted successfully. Reward deposited.", 1, 2, 0);
    
    // Award bonus money
    const bonusAmount = 10000;
    const currentMoney = stateManager.get('money') || 0;
    stateManager.set('money', currentMoney + bonusAmount);
    
    // Bonus for completion speed
    const timeRemaining = this.getTimeRemaining();
    const speedBonus = Math.floor(timeRemaining / 1000); // 1 money per second remaining
    if (speedBonus > 0) {
      stateManager.set('money', currentMoney + bonusAmount + speedBonus);
      this.announce(`Speed bonus: ${speedBonus} credits for quick completion!`, 1, 1.5, 3000);
    }
    
    eventSystem.emit('drill:missionCompleted', {
      energyCollected: this.energyCollected,
      bonusAmount: bonusAmount,
      speedBonus: speedBonus,
      timeRemaining: timeRemaining
    });
  }
  
  onMissionFailure() {
    this.announce("Mission failed. Drill Rigs destroyed before extracting enough Hydrogen.", 1, 2, 0);
    
    // Money penalty
    const currentMoney = stateManager.get('money') || 0;
    const penalty = Math.floor(currentMoney * 0.5);
    stateManager.set('money', currentMoney - penalty);
    
    eventSystem.emit('drill:missionFailed', {
      energyCollected: this.energyCollected,
      energyRequired: this.energyRequired,
      penalty: penalty
    });
  }
  
  onMissionTimeout() {
    if (this.energyCollected >= this.energyRequired * 0.8) {
      // Partial success
      this.announce("Time's up! Partial success - some hydrogen extracted.", 1, 2, 0);
      
      const partialBonus = 5000;
      const currentMoney = stateManager.get('money') || 0;
      stateManager.set('money', currentMoney + partialBonus);
      
      eventSystem.emit('drill:partialSuccess', {
        energyCollected: this.energyCollected,
        bonusAmount: partialBonus
      });
    } else {
      this.onMissionFailure();
    }
  }
  
  onDraw() {
    if (!this.isActive) return;
    
    // Draw mission progress bar
    this.drawProgressBar();
    
    // Draw rig status indicators
    this.drawRigStatus();
    
    // Draw energy collection rate
    this.drawEnergyRate();
  }
  
  drawProgressBar() {
    const progress = this.energyCollected / this.energyRequired;
    const barWidth = 200;
    const barHeight = 20;
    const barX = 50;
    const barY = 50;
    
    // Background
    fill(0, 0, 0, 150);
    noStroke();
    rect(barX, barY, barWidth, barHeight);
    
    // Progress fill
    fill(0, 255, 0);
    rect(barX, barY, barWidth * progress, barHeight);
    
    // Border
    noFill();
    stroke(255);
    strokeWeight(2);
    rect(barX, barY, barWidth, barHeight);
    
    // Text
    fill(255);
    textAlign(LEFT, TOP);
    textSize(12);
    text(`Energy: ${Math.floor(this.energyCollected)}/${this.energyRequired}`, barX, barY + barHeight + 5);
  }
  
  drawRigStatus() {
    const activeRigs = this.getActiveRigs();
    const statusX = 50;
    const statusY = 100;
    
    fill(255);
    textAlign(LEFT, TOP);
    textSize(10);
    text(`Active Rigs: ${activeRigs.length}`, statusX, statusY);
    
    // Individual rig health indicators
    for (let i = 0; i < activeRigs.length && i < 10; i++) {
      const rig = activeRigs[i];
      const healthPercent = rig.health / (rig.maxHealth || 100);
      
      // Health bar for each rig
      const rigBarX = statusX + i * 22;
      const rigBarY = statusY + 15;
      const rigBarWidth = 20;
      const rigBarHeight = 4;
      
      // Background
      fill(100, 0, 0);
      noStroke();
      rect(rigBarX, rigBarY, rigBarWidth, rigBarHeight);
      
      // Health
      fill(255 * (1 - healthPercent), 255 * healthPercent, 0);
      rect(rigBarX, rigBarY, rigBarWidth * healthPercent, rigBarHeight);
      
      // Warning indicator if under attack
      if (rig.underAttack) {
        fill(255, 0, 0);
        textAlign(CENTER, CENTER);
        textSize(8);
        text('!', rigBarX + rigBarWidth/2, rigBarY - 8);
      }
    }
  }
  
  drawEnergyRate() {
    const activeRigs = this.getActiveRigs();
    const effectiveRigs = activeRigs.filter(rig => rig.health > this.rigHealthThreshold);
    const currentRate = effectiveRigs.length * this.energyPerSecond;
    
    fill(0, 255, 255);
    textAlign(LEFT, TOP);
    textSize(10);
    text(`Energy Rate: ${currentRate}/sec`, 50, 130);
    
    // Time remaining
    const timeRemaining = this.getTimeRemaining();
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    text(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, 50, 145);
  }
  
  onReset() {
    this.energyCollected = 0;
    this.previousRigCount = 0;
    
    // Clear any rig status indicators
    const allRigs = this.getActiveRigs();
    for (const rig of allRigs) {
      rig.underAttack = false;
    }
  }
  
  getConfig() {
    return {
      ...super.getConfig(),
      energyRequired: this.energyRequired,
      energyCollected: this.energyCollected,
      requiredRigs: this.requiredRigs,
      currentRigs: this.getCurrentRigCount()
    };
  }
}

export default DrillMission;