/**
 * Base Defense Mission - Refactored to use BaseMission
 * Mission to defend all moon bases from alien attacks
 */

import BaseMission from './BaseMission.js';
import eventSystem, { GameEvents } from '../core/EventSystem.js';
import entityManager from '../core/EntityManager.js';
import stateManager from '../core/StateManager.js';

class BaseDefenseMission extends BaseMission {
  constructor() {
    super();
    
    this.missionDuration = 5 * 60 * 1000; // 5 minutes
    this.missionTimerKey = 'baseDefenseMission';
    this.previousBaseCount = 0;
    this.basesLost = 0;
    this.basesDefended = 0;
    
    // Mission parameters
    this.allowedBaseLoss = 1; // Can lose at most 1 base
    this.attackWaves = [];
    this.currentWave = 0;
    this.waveSpawnTimer = 0;
    this.waveInterval = 60000; // 1 minute between waves
    
    // Tracking
    this.enemiesSpawned = 0;
    this.enemiesDefeated = 0;
  }
  
  onMissionStart() {
    this.previousBaseCount = this.getCurrentBaseCount();
    this.basesLost = 0;
    this.basesDefended = 0;
    this.currentWave = 0;
    this.enemiesSpawned = 0;
    this.enemiesDefeated = 0;
    
    // Initialize attack waves
    this.initializeAttackWaves();
    
    this.announce(
      `Commander, our bases are under coordinated alien attack! Defend all moon bases for ${this.missionDuration / 60000} minutes. You can only afford to lose ${this.allowedBaseLoss} base.`,
      1, 2, 0
    );
    
    // Set up periodic wave spawning
    this.updateInterval = 5000; // Check every 5 seconds
    
    // Subscribe to base destruction events
    this.unsubscribeBaseDestroyed = eventSystem.on(GameEvents.BASE_DESTROYED, (data) => {
      this.onBaseDestroyed(data.base);
    });
    
    eventSystem.emit(GameEvents.MISSION_START, {
      type: 'baseDefense',
      duration: this.missionDuration,
      basesToDefend: this.previousBaseCount,
      allowedLoss: this.allowedBaseLoss
    });
  }
  
  initializeAttackWaves() {
    this.attackWaves = [
      {
        delay: 30000, // 30 seconds
        enemies: [
          { type: 'alien', count: 5 },
          { type: 'hunter', count: 2 }
        ]
      },
      {
        delay: 90000, // 1.5 minutes
        enemies: [
          { type: 'alien', count: 8 },
          { type: 'hunter', count: 3 },
          { type: 'zapper', count: 1 }
        ]
      },
      {
        delay: 150000, // 2.5 minutes
        enemies: [
          { type: 'hunter', count: 5 },
          { type: 'zapper', count: 2 },
          { type: 'destroyer', count: 1 }
        ]
      },
      {
        delay: 210000, // 3.5 minutes
        enemies: [
          { type: 'alien', count: 10 },
          { type: 'hunter', count: 4 },
          { type: 'zapper', count: 2 },
          { type: 'destroyer', count: 2 }
        ]
      },
      {
        delay: 270000, // 4.5 minutes - final wave
        enemies: [
          { type: 'hunter', count: 8 },
          { type: 'zapper', count: 4 },
          { type: 'destroyer', count: 3 }
        ]
      }
    ];
  }
  
  onPeriodicUpdate() {
    // Check for wave spawning
    this.checkWaveSpawning();
    
    // Update base status
    this.updateBaseStatus();
    
    // Check enemy counts
    this.updateEnemyCounts();
    
    // Emit progress update
    const progress = Math.min(1.0, (Date.now() - this.createdAt) / this.missionDuration);
    eventSystem.emit(GameEvents.MISSION_UPDATE, {
      type: 'baseDefense',
      progress: progress,
      basesRemaining: this.getCurrentBaseCount(),
      basesLost: this.basesLost,
      currentWave: this.currentWave,
      enemiesDefeated: this.enemiesDefeated
    });
  }
  
  checkWaveSpawning() {
    const missionTime = Date.now() - this.createdAt;
    
    for (let i = this.currentWave; i < this.attackWaves.length; i++) {
      const wave = this.attackWaves[i];
      if (missionTime >= wave.delay && !wave.spawned) {
        this.spawnWave(wave, i);
        wave.spawned = true;
        this.currentWave = i + 1;
      }
    }
  }
  
  spawnWave(wave, waveIndex) {
    this.announce(`Warning! Attack wave ${waveIndex + 1} incoming!`, 1, 1.5, 0);
    
    const bases = this.getActiveBases();
    if (bases.length === 0) return;
    
    for (const enemyGroup of wave.enemies) {
      for (let i = 0; i < enemyGroup.count; i++) {
        setTimeout(() => {
          this.spawnEnemyNearBase(enemyGroup.type, bases);
        }, i * 2000); // Stagger spawning by 2 seconds
      }
    }
    
    eventSystem.emit('baseDefense:waveSpawned', {
      waveIndex: waveIndex,
      enemies: wave.enemies
    });
  }
  
  spawnEnemyNearBase(enemyType, bases) {
    if (bases.length === 0) return;
    
    // Choose random base to attack
    const targetBase = bases[Math.floor(Math.random() * bases.length)];
    
    // Spawn enemy near the base (but not too close)
    const spawnDistance = 200 + Math.random() * 100;
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnX = targetBase.pos.x + Math.cos(spawnAngle) * spawnDistance;
    const spawnY = targetBase.pos.y + Math.sin(spawnAngle) * spawnDistance;
    
    // Create enemy based on type
    let enemy = null;
    switch (enemyType) {
      case 'alien':
        if (typeof Alien !== 'undefined') {
          enemy = new Alien({ x: spawnX, y: spawnY });
          entityManager.addEntity('aliens', enemy);
        }
        break;
      case 'hunter':
        if (typeof Hunter !== 'undefined') {
          enemy = new Hunter({ x: spawnX, y: spawnY });
          entityManager.addEntity('hunters', enemy);
        }
        break;
      case 'zapper':
        if (typeof Zapper !== 'undefined') {
          enemy = new Zapper({ x: spawnX, y: spawnY });
          entityManager.addEntity('zappers', enemy);
        }
        break;
      case 'destroyer':
        if (typeof Destroyer !== 'undefined') {
          enemy = new Destroyer({ x: spawnX, y: spawnY });
          entityManager.addEntity('destroyers', enemy);
        }
        break;
    }
    
    if (enemy) {
      // Set enemy to target the base
      enemy.targetBase = targetBase;
      enemy.missionSpawned = true;
      this.enemiesSpawned++;
      
      // Subscribe to enemy destruction
      const unsubscribe = eventSystem.on(GameEvents.ENTITY_DESTROYED, (data) => {
        if (data.entity === enemy) {
          this.enemiesDefeated++;
          unsubscribe();
        }
      });
    }
  }
  
  updateBaseStatus() {
    const bases = this.getActiveBases();
    
    // Check each base for threats
    for (const base of bases) {
      const nearbyEnemies = this.getEnemiesNearBase(base, 150);
      
      if (nearbyEnemies.length > 0) {
        base.underAttack = true;
        
        // Occasionally announce base under attack
        if (Math.random() < 0.01) { // 1% chance per update
          this.announce(`Base under attack at coordinates ${Math.floor(base.pos.x)}, ${Math.floor(base.pos.y)}!`, 1, 1.5, 0);
        }
      } else {
        base.underAttack = false;
      }
    }
  }
  
  updateEnemyCounts() {
    // Count remaining mission-spawned enemies
    const allEnemies = [
      ...entityManager.getCollection('aliens'),
      ...entityManager.getCollection('hunters'),
      ...entityManager.getCollection('zappers'),
      ...entityManager.getCollection('destroyers')
    ];
    
    const missionEnemies = allEnemies.filter(enemy => enemy.missionSpawned);
    
    // If all waves spawned and no mission enemies remain, mission is successful
    if (this.currentWave >= this.attackWaves.length && missionEnemies.length === 0) {
      this.completeMission(true);
    }
  }
  
  getEnemiesNearBase(base, radius) {
    const allEnemies = [
      ...entityManager.getCollection('aliens'),
      ...entityManager.getCollection('hunters'),
      ...entityManager.getCollection('zappers'),
      ...entityManager.getCollection('destroyers')
    ];
    
    return allEnemies.filter(enemy => {
      const distance = Math.sqrt(
        Math.pow(enemy.pos.x - base.pos.x, 2) + 
        Math.pow(enemy.pos.y - base.pos.y, 2)
      );
      return distance <= radius;
    });
  }
  
  onBaseDestroyed(base) {
    this.basesLost++;
    
    this.announce(`Base destroyed! Bases lost: ${this.basesLost}/${this.allowedBaseLoss + 1}`, 1, 2, 0);
    
    eventSystem.emit('baseDefense:baseLost', {
      basesLost: this.basesLost,
      basesRemaining: this.getCurrentBaseCount()
    });
  }
  
  getCurrentBaseCount() {
    if (typeof MoonBase !== 'undefined' && MoonBase.moonBases) {
      return MoonBase.moonBases.length;
    }
    return entityManager.getCollection('bases').length;
  }
  
  getActiveBases() {
    if (typeof MoonBase !== 'undefined' && MoonBase.moonBases) {
      return MoonBase.moonBases.filter(base => base.active !== false);
    }
    return entityManager.getCollection('bases').filter(base => base.active !== false);
  }
  
  checkCompletionConditions() {
    // Success if all waves completed and no mission enemies remain
    if (this.currentWave >= this.attackWaves.length) {
      const allEnemies = [
        ...entityManager.getCollection('aliens'),
        ...entityManager.getCollection('hunters'),
        ...entityManager.getCollection('zappers'),
        ...entityManager.getCollection('destroyers')
      ];
      
      const missionEnemies = allEnemies.filter(enemy => enemy.missionSpawned);
      return missionEnemies.length === 0;
    }
    
    return false;
  }
  
  checkFailureConditions() {
    // Fail if too many bases are lost
    return this.basesLost > this.allowedBaseLoss;
  }
  
  onMissionSuccess() {
    const basesRemaining = this.getCurrentBaseCount();
    this.basesDefended = basesRemaining;
    
    this.announce(`Mission accomplished! All bases defended successfully. ${basesRemaining} bases saved.`, 1, 2, 0);
    
    // Award money based on performance
    let bonusAmount = 15000; // Base reward
    
    // Bonus for not losing any bases
    if (this.basesLost === 0) {
      bonusAmount += 10000;
      this.announce("Perfect defense bonus: 10,000 credits!", 1, 1.5, 3000);
    }
    
    // Bonus for defeating enemies quickly
    const defeatBonus = this.enemiesDefeated * 100;
    bonusAmount += defeatBonus;
    
    const currentMoney = stateManager.get('money') || 0;
    stateManager.set('money', currentMoney + bonusAmount);
    
    eventSystem.emit('baseDefense:missionCompleted', {
      basesDefended: this.basesDefended,
      basesLost: this.basesLost,
      enemiesDefeated: this.enemiesDefeated,
      bonusAmount: bonusAmount
    });
  }
  
  onMissionFailure() {
    this.announce(`Mission failed! Too many bases destroyed. ${this.basesLost} bases lost.`, 1, 2, 0);
    
    // Money penalty
    const currentMoney = stateManager.get('money') || 0;
    const penalty = Math.floor(currentMoney * 0.3);
    stateManager.set('money', Math.max(0, currentMoney - penalty));
    
    eventSystem.emit('baseDefense:missionFailed', {
      basesLost: this.basesLost,
      basesRemaining: this.getCurrentBaseCount(),
      penalty: penalty
    });
  }
  
  onMissionTimeout() {
    if (this.basesLost <= this.allowedBaseLoss) {
      this.announce("Time up! Mission partially successful - most bases defended.", 1, 2, 0);
      
      // Partial reward
      const partialBonus = 7500;  
      const currentMoney = stateManager.get('money') || 0;
      stateManager.set('money', currentMoney + partialBonus);
      
      eventSystem.emit('baseDefense:partialSuccess', {
        basesDefended: this.getCurrentBaseCount(),
        basesLost: this.basesLost,
        bonusAmount: partialBonus
      });
    } else {
      this.onMissionFailure();
    }
  }
  
  onDraw() {
    if (!this.isActive) return;
    
    this.drawMissionStatus();
    this.drawWaveProgress();
    this.drawBaseStatus();
  }
  
  drawMissionStatus() {
    const statusX = 50;
    const statusY = 50;
    
    // Mission title
    fill(255, 255, 0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("BASE DEFENSE MISSION", statusX, statusY);
    
    // Time remaining
    const timeRemaining = this.getTimeRemaining();
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    
    fill(255);
    textSize(12);
    text(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, statusX, statusY + 20);
    
    // Bases status
    const basesColor = this.basesLost > this.allowedBaseLoss ? [255, 0, 0] : [0, 255, 0];
    fill(basesColor[0], basesColor[1], basesColor[2]);
    text(`Bases: ${this.getCurrentBaseCount()} (Lost: ${this.basesLost}/${this.allowedBaseLoss + 1})`, statusX, statusY + 35);
  }
  
  drawWaveProgress() {
    const progressX = 50;
    const progressY = 100;
    
    fill(255);
    textAlign(LEFT, TOP);
    textSize(10);
    text(`Wave: ${this.currentWave}/${this.attackWaves.length}`, progressX, progressY);
    text(`Enemies Defeated: ${this.enemiesDefeated}`, progressX, progressY + 15);
    
    // Wave progress bar
    const progress = this.currentWave / this.attackWaves.length;
    const barWidth = 150;
    const barHeight = 8;
    
    // Background
    fill(100, 0, 0);
    noStroke();
    rect(progressX, progressY + 30, barWidth, barHeight);
    
    // Progress
    fill(255, 100, 0);
    rect(progressX, progressY + 30, barWidth * progress, barHeight);
    
    // Border
    noFill();
    stroke(255);
    strokeWeight(1);
    rect(progressX, progressY + 30, barWidth, barHeight);
  }
  
  drawBaseStatus() {
    const bases = this.getActiveBases();
    const statusX = 50;
    const statusY = 160;
    
    fill(255);
    textAlign(LEFT, TOP);
    textSize(10);
    text("Base Status:", statusX, statusY);
    
    // Individual base indicators
    for (let i = 0; i < Math.min(bases.length, 8); i++) {
      const base = bases[i];
      const indicatorX = statusX + i * 25;
      const indicatorY = statusY + 15;
      
      // Base health indicator
      const healthPercent = base.health / (base.maxHealth || 100);
      
      if (base.underAttack) {
        // Flashing red if under attack
        fill(255, 0, 0, Math.sin(Date.now() * 0.01) * 127 + 128);
      } else {
        // Green to red based on health
        fill(255 * (1 - healthPercent), 255 * healthPercent, 0);
      }
      
      noStroke();
      rect(indicatorX, indicatorY, 20, 6);
      
      // Base number
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(8);
      text(i + 1, indicatorX + 10, indicatorY + 3);
    }
  }
  
  onMissionEnd() {
    // Clean up event subscription
    if (this.unsubscribeBaseDestroyed) {
      this.unsubscribeBaseDestroyed();
    }
    
    // Clear base attack status
    const bases = this.getActiveBases();
    for (const base of bases) {
      base.underAttack = false;
    }
    
    // Clear mission-spawned flag from remaining enemies
    const allEnemies = [
      ...entityManager.getCollection('aliens'),
      ...entityManager.getCollection('hunters'),
      ...entityManager.getCollection('zappers'),
      ...entityManager.getCollection('destroyers')
    ];
    
    for (const enemy of allEnemies) {
      enemy.missionSpawned = false;
      enemy.targetBase = null;
    }
  }
  
  onReset() {
    this.previousBaseCount = 0;
    this.basesLost = 0;
    this.basesDefended = 0;
    this.currentWave = 0;
    this.enemiesSpawned = 0;
    this.enemiesDefeated = 0;
    this.attackWaves.forEach(wave => wave.spawned = false);
  }
  
  getConfig() {
    return {
      ...super.getConfig(),
      basesToDefend: this.previousBaseCount,
      basesLost: this.basesLost,
      allowedBaseLoss: this.allowedBaseLoss,
      currentWave: this.currentWave,
      totalWaves: this.attackWaves.length,
      enemiesDefeated: this.enemiesDefeated
    };
  }
}

export default BaseDefenseMission;