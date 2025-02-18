
class Entity {
  constructor(pos, vel, size) {
    this.pos = pos.copy();  // Use copy() to ensure we have a new p5.Vector
    this.vel = vel.copy();
    this.size = size;
  }

  update() {
    this.pos.add(this.vel);
    this.pos.x = (this.pos.x + worldWidth) % worldWidth;
  }

  draw() {
    // To be implemented by child classes
  }
}

class Particle {
  static pool = [];
  static activeParticles = [];
  static maxPoolSize = 1000;

  constructor(pos, vel, size, lifetime, colory) {
    this.pos = pos.copy();
    this.vel = vel.copy();
    this.size = size;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.active = false;
    this.color = colory || color(200); // Default color if not provided
  }

  static create(pos, vel, size, lifetime, colory) {
    let particle;
    if (Particle.pool.length > 0) {
      particle = Particle.pool.pop();
      particle.reset(pos, vel, size, lifetime, colory);
    } else {
      particle = new Particle(pos, vel, size, lifetime, colory);
    }
    particle.active = true;
    Particle.activeParticles.push(particle);
    return particle;
  }

  static recycle(particle) {
    const index = Particle.activeParticles.indexOf(particle);
    if (index > -1) {
      Particle.activeParticles.splice(index, 1);
      particle.active = false;
      if (Particle.pool.length < Particle.maxPoolSize) {
        Particle.pool.push(particle);
      }
    }
  }

  reset(pos, vel, size, lifetime, colory) {
    this.pos.set(pos.x, pos.y);
    this.vel.set(vel.x, vel.y);
    this.size = size;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.color = colory || color(200); // Ensure color is reset, use default if not provided
    this.active = true;
  }

  update() {
    if (!this.active) return;
    this.pos.add(this.vel);
    this.lifetime--;
    if (this.lifetime <= 0) {
      Particle.recycle(this);
    }
  }

  draw() {
    if (!this.active) return;
    let alpha = map(this.lifetime, 0, this.maxLifetime, 0, 255);
    fill(red(this.color), green(this.color), blue(this.color), alpha);
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  static updateParticles() {
    for (let i = Particle.activeParticles.length - 1; i >= 0; i--) {
      Particle.activeParticles[i].update();
    }
  }

  static drawParticles() {
    noStroke();
    for (let particle of Particle.activeParticles) {
      if (isInView(particle.pos, particle.size)) {
        particle.draw();
      }
    }
  }

  static createThrustParticles(ship) {
    const basePos = p5.Vector.add(ship.pos, p5.Vector.fromAngle(ship.angle + PI, ship.size / 2));
    for (let i = 0; i < ship.particleCount; i++) {
      const particleAngle = ship.angle + PI + random(-0.2, 0.2);
      const particleVel = p5.Vector.fromAngle(particleAngle, random(1, 3));
      const particleColor = color(random(150, 190));
      Particle.create(basePos.copy(), particleVel, random(3, 7), random(20, 40), particleColor);
    }
  }
}

class Explosion {
  constructor(pos, size, outerColor, innerColor) {
    this.pos = pos.copy();
    this.maxSize = size;
    this.currentSize = 0;
    this.lifetime = 30; // Animation duration in frames
    this.outerColor = outerColor || color(255, 200, 0); // Default to original color if not provided
    this.innerColor = innerColor || color(255, 100, 0); // Default to original color if not provided
  }

  update() {
    this.currentSize = map(this.lifetime, 30, 0, 0, this.maxSize);
    this.lifetime--;
  }

  draw() {
    push();
    noFill();
    let alpha = map(this.lifetime, 30, 0, 255, 0);
    
    // Outer circle
    stroke(this.outerColor.levels[0], this.outerColor.levels[1], this.outerColor.levels[2], alpha);
    strokeWeight(3);
    ellipse(this.pos.x, this.pos.y, this.currentSize);
    
    // Inner circle
    stroke(this.innerColor.levels[0], this.innerColor.levels[1], this.innerColor.levels[2], alpha);
    strokeWeight(2);
    ellipse(this.pos.x, this.pos.y, this.currentSize * 0.7);
    
    pop();
  }

  isFinished() {
    return this.lifetime <= 0;
  }
}

class WindSoundGenerator {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.noiseChains = [];
    for (let i = 0; i < 3; i++) {
      this.noiseChains.push(this.createNoiseChain());
    }

    this.isPlaying = false;
    this.baseVolume = 0.3;
    this.windForce = 0;
  }

  createNoiseChain() {
    const filter = this.audioContext.createBiquadFilter();
    const gain = this.audioContext.createGain();

    filter.connect(gain);
    gain.connect(this.masterGain);

    filter.type = 'lowpass';
    filter.frequency.value = this.randomRange(400, 1000);
    filter.Q.value = this.randomRange(0.5, 2);

    gain.gain.value = this.randomRange(0.1, 0.3);

    // Create an LFO for filter modulation
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = this.randomRange(0.1, 0.3);
    lfoGain.gain.value = this.randomRange(50, 200);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    return { filter, gain, lfo, lfoGain };
  }

  createNoise() {
    const bufferSize = 2 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    return source;
  }

  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  start() {
    if (!this.isPlaying) {
      this.noiseChains.forEach(chain => {
        const noise = this.createNoise();
        noise.connect(chain.filter);
        noise.start();
        chain.currentNoise = noise;
      });
      this.isPlaying = true;
      this.scheduleVariations();
    }
  }

  stop() {
    if (this.isPlaying) {
      this.noiseChains.forEach(chain => {
        if (chain.currentNoise) {
          chain.currentNoise.stop();
          chain.currentNoise.disconnect();
          delete chain.currentNoise;
        }
      });
      this.isPlaying = false;
      if (this.variationTimeout) {
        clearTimeout(this.variationTimeout);
      }
    }
  }

  setWindForce(windForce, transitionTime = 2) {
    // Adjust windForce to the new range (0 to 0.01)
    this.windForce = Math.max(0, Math.min(windForce, 0.01));
    const normalizedWindForce = this.windForce / 0.01; // Normalize to 0-1 range for calculations
    const volume = this.baseVolume + (normalizedWindForce * 0.7);
    this.masterGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, transitionTime);

    this.noiseChains.forEach((chain, index) => {
      const baseFreq = 400 + (index * 200);
      const maxFreq = baseFreq + 1600;
      const frequency = baseFreq + (maxFreq - baseFreq) * normalizedWindForce;
      chain.filter.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, transitionTime);

      const q = 0.5 + (4.5 * normalizedWindForce);
      chain.filter.Q.setTargetAtTime(q, this.audioContext.currentTime, transitionTime);

      const modulationIntensity = 50 + (150 * normalizedWindForce);
      chain.lfoGain.gain.setTargetAtTime(modulationIntensity, this.audioContext.currentTime, transitionTime);
    });
  }

  scheduleVariations() {
    const variationTime = this.randomRange(1, 5);
    this.variationTimeout = setTimeout(() => {
      const variation = (Math.random() - 0.5) * 0.003; // Adjusted for 0-0.01 range
      let newWindForce = this.windForce + variation;
      newWindForce = Math.max(0, Math.min(newWindForce, 0.01));
      this.setWindForce(newWindForce, this.randomRange(0.5, 2));

      // Randomly adjust LFO frequencies
      this.noiseChains.forEach(chain => {
        chain.lfo.frequency.setTargetAtTime(this.randomRange(0.1, 0.3), this.audioContext.currentTime, 1);
      });

      this.scheduleVariations();
    }, variationTime * 1000);
  }

  setBaseVolume(volume) {
    this.baseVolume = Math.max(0, Math.min(volume, 1));
    this.setWindForce(this.windForce);
  }

  mute() {
    this.masterGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.5);
  }

  unmute() {
    const normalizedWindForce = this.windForce / 0.01;
    const volume = this.baseVolume + (normalizedWindForce * 0.7);
    this.masterGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.5);
  }

  isActive() {
    return this.isPlaying;
  }
}

class SoundManager {
  constructor() {
    this.sounds = {};
    this.muted = false;
    this.globalVolume = 1.0;
    this.maxSimultaneousSounds = 10;
    this.currentlyPlaying = [];
    this.soundFiles = [
      'shipThrust', 'magneticStorm','methane','queenDeath','walker','shipShooting', 'shipHit', 'shipDropOffPod', 'enterKing','teleportKing', 'laserKing','walkerShoot',
      'alienShooting', 'gameOver', 'nextLevel', 'alienPodPickup', 'quantumRift', 'eclipseWarning',
      'alienPodDropOff', 'alienDestruction', 'nestDestruction','teleport','turretFreezeBurst',
      'moonBaseDestruction', 'hunterSpawned','zapperSpawned', 'wormDead','destroyerSpawned',
      'shipBomb', 'meteorImpact','diamondImpact','earthquake','astronautJump','missileImpact','nestBurstDefense','balloonPop','warning'
    ];
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  getTotalAssets() {
    return this.soundFiles.length;
  }

  preloadWithCallback(callback) {
    this.soundFiles.forEach(soundName => {
      this.loadSound(soundName, callback);
    });
  }

  loadSound(soundName, callback) {
    const request = new XMLHttpRequest();
    request.open('GET', `assets/${soundName}.wav`, true);
    request.responseType = 'arraybuffer';

    request.onload = () => {
      this.audioContext.decodeAudioData(request.response, (buffer) => {
        this.sounds[soundName] = {
          buffer: buffer,
          priority: this.getPriority(soundName),
          volume: this.getVolume(soundName)
        };
        callback();
      }, (error) => {
        debug.error(`Error decoding sound: ${soundName}`, error);
        callback();
      });
    };

    request.onerror = () => {
      debug.error(`Failed to load sound: ${soundName}`);
      callback();
    };

    request.send();
  }

  getPriority(soundName) {
    const priorities = {
      queenDeath: 5,walker: 3, methane: 3, magneticStorm: 2, shipThrust: 2, shipShooting: 4, shipHit: 5, shipDropOffPod: 3,
      alienShooting: 2, gameOver: 5, nextLevel: 5, alienPodPickup: 1,enterKing: 5, teleportKing: 3, laserKing: 1,
      alienPodDropOff: 2, alienDestruction: 3, turretFreezeBurst: 1, nestDestruction: 4,walkerShoot: 2,quantumRift: 5, eclipseWarning: 5,
      moonBaseDestruction: 5, teleport: 5, hunterSpawned: 2, destroyerSpawned: 2, zapperSpawned: 2,earthquake: 4,
      shipBomb: 4, meteorImpact: 1, wormDead: 4, astronautJump: 4, nestBurstDefense: 1, balloonPop: 3,diamondImpact: 1,missileLaunch: 3, missileImpact: 5,warning: 3
    };
    return priorities[soundName] || 1;
  }

  getVolume(soundName) {
    const volumes = {
      shipThrust: 0.2, missileLaunch: 0.5, turretFreezeBurst: 0.8, nestDestruction: 0.8, meteorImpact: 0.5, diamondImpact: 0.6, hunterSpawned: 0.7, destroyerSpawned: 0.7, walkerShoot: 0.2, warning: 0.5
    };
    return volumes[soundName] || 1.0;
  }

  play(soundName) {
    if (this.muted || !this.sounds[soundName]) return;

    const soundObj = this.sounds[soundName];
    
    if (this.currentlyPlaying.length >= this.maxSimultaneousSounds) {
      const lowestPriority = Math.min(...this.currentlyPlaying.map(s => this.sounds[s].priority));
      if (soundObj.priority <= lowestPriority) return;
      
      const lowestPrioritySound = this.currentlyPlaying.find(s => this.sounds[s].priority === lowestPriority);
      this.stop(lowestPrioritySound);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = soundObj.buffer;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(this.globalVolume * soundObj.volume, this.audioContext.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
    
    this.currentlyPlaying.push(soundName);
    
    source.onended = () => {
      const index = this.currentlyPlaying.indexOf(soundName);
      if (index > -1) this.currentlyPlaying.splice(index, 1);
    };

    soundObj.source = source;
    soundObj.gainNode = gainNode;
  }

  loop(soundName) {
    if (this.muted || !this.sounds[soundName]) return;

    const soundObj = this.sounds[soundName];
    const source = this.audioContext.createBufferSource();
    source.buffer = soundObj.buffer;
    source.loop = true;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(this.globalVolume * soundObj.volume, this.audioContext.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
    
    if (!this.currentlyPlaying.includes(soundName)) {
      this.currentlyPlaying.push(soundName);
    }

    soundObj.source = source;
    soundObj.gainNode = gainNode;
  }

  stop(soundName) {
    if (this.sounds[soundName] && this.sounds[soundName].source) {
      this.sounds[soundName].source.stop(0);
      this.sounds[soundName].source.disconnect();
      this.sounds[soundName].gainNode.disconnect();
      delete this.sounds[soundName].source;
      delete this.sounds[soundName].gainNode;
      const index = this.currentlyPlaying.indexOf(soundName);
      if (index > -1) this.currentlyPlaying.splice(index, 1);
    }
  }

  stopAll() {
    for (let soundName in this.sounds) {
      this.stop(soundName);
    }
  }

  setGlobalVolume(volume) {
    this.globalVolume = Math.max(0, Math.min(volume, 1));
    this.updateAllVolumes();
  }

  setSoundVolume(soundName, volume) {
    if (this.sounds[soundName]) {
      this.sounds[soundName].volume = Math.max(0, Math.min(volume, 1));
      this.updateSoundVolume(soundName);
    }
  }

  updateAllVolumes() {
    for (let soundName of this.currentlyPlaying) {
      this.updateSoundVolume(soundName);
    }
  }

  updateSoundVolume(soundName) {
    const soundObj = this.sounds[soundName];
    if (soundObj.gainNode) {
      soundObj.gainNode.gain.setValueAtTime(this.globalVolume * soundObj.volume, this.audioContext.currentTime);
    }
  }

  mute() {
    this.muted = true;
    this.setGlobalVolume(0);
  }

  unmute() {
    this.muted = false;
    this.setGlobalVolume(1);
  }

  toggleMute() {
    this.muted ? this.unmute() : this.mute();
  }

  isPlaying(soundName) {
    return this.currentlyPlaying.includes(soundName);
  }

  loopIfNotPlaying(soundName) {
    if (!this.isPlaying(soundName)) {
      this.loop(soundName);
    }
  }

  reset() {
    this.stopAll();
    this.currentlyPlaying = [];
    this.audioContext.close();
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    for (let soundName in this.sounds) {
      delete this.sounds[soundName].source;
      delete this.sounds[soundName].gainNode;
    }
  }
}

class Upgrades {
  constructor() {
    this.availableUpgrades = {
      energyCharge: { cost: 4000, level: 0, maxLevel: 1000, description: "Energy Charge +10000" },
      energyCapacity: { cost: 3000, level: 0, maxLevel: 5, description: "Upgrade Energy Capacity" },
      shipSpeed: { cost: 1500, level: 0, maxLevel: 5, description: "Improve ship maneuverability" },
      astronautSpeed: { cost: 1500, level: 0, maxLevel: 2, description: "Upgrade Spacesuit" },
      bulletDamage: { cost: 1500, level: 0, maxLevel: 3, description: "Increase bullet damage" },
      shieldNumber: { cost: 2500, level: 0, maxLevel: 6, description: "Upgrade No. Shields" },
      turret: { cost: 1800, level: 0, maxLevel: 4, description: "Upgrade Turret" },
      barrageBalloon: { cost: 1000, level: 0, maxLevel: 8, description: "Upgrade Barrage Balloons" },
      cruiseMissile: { cost: 1800, level: 0, maxLevel: 5, description: "Upgrade Cruise Missile" },
      wingMan: { cost: 4000, level: 0, maxLevel: 3, description: "Upgrade Wingmen" },
      bombDamage: { cost: 2000, level: 0, maxLevel: 5, description: "Upgrade Bombs" },
      walkerRobot: { cost: 2000, level: 0, maxLevel: 4, description: "Upgrade Walker Robots" },
      drillRig: { cost: 2000, level: 0, maxLevel: 3, description: "Upgrade Drill Rigs" }
    };
    this.initialUpgrades = JSON.parse(JSON.stringify(this.availableUpgrades));
  }

  canPurchase(upgradeName) {
    const upgrade = this.availableUpgrades[upgradeName];
    return upgrade.level < upgrade.maxLevel && money >= upgrade.cost;
  }

  purchase(upgradeName) {
    if (this.canPurchase(upgradeName)) {
      const upgrade = this.availableUpgrades[upgradeName];
      money -= upgrade.cost;
      upgrade.level++;
      this.applyUpgrade(upgradeName);

    // Increase the cost of the chosen upgrade by 1.9
    upgrade.cost = Math.floor(upgrade.cost * 1.9);

    // Increase the cost of all other upgrades by 1.3
    for (let key in this.availableUpgrades) {
      if (key !== upgradeName && this.availableUpgrades[key].level < this.availableUpgrades[key].maxLevel) {
        this.availableUpgrades[key].cost = Math.floor(this.availableUpgrades[key].cost * 1.2);
      }
    }

      return true;
    }
    return false;
  }

  reset() {
    // Reset upgrades to their initial state
    this.availableUpgrades = JSON.parse(JSON.stringify(this.initialUpgrades));
    this.revertUpgradeEffects();
  }

  revertUpgradeEffects() {
    // Revert all upgrade effects to their default values
    ship.thrustPower = 0.1;
    ship.rotationSpeed = 0.05;
    astronaut.walkSpeed = 2;
    maxEnergy = 15000;
    Shield.MAX_SHIELDS = 3;
    Turret.defaultHealth = 4;
    Turret.defaultRange = 200;
    Turret.ShootCooldown = 120;
    MoonBase.maxBalloons = 0;
    Bullet.damageMultiplier = 1;
    Bomb.defaultExplosionRadius = 50;
    Bomb.defaultBombDamage = 3;
    Wingman.MAX_WINGMEN = 0;
    Missile.defaultExplosionRadius = 100;
    Missile.defaultDamage = 5;
    DrillRig.ENERGY_GENERATION_RATE = 0.1;
    WalkerRobot.SHOOT_SPEED = 50;
    WalkerRobot.MAX_WALKERS = 0;
  }

  
  applyUpgrade(upgradeName) {
    switch (upgradeName) {
      case 'energyCharge':
        energy += 10000;      
        if (energy > maxEnergy) {
          energy = maxEnergy;
        }
        break;
      case 'energyCapacity':
        maxEnergy += 5000;
        break;
      case 'shipSpeed':
        ship.thrustPower += 0.02;
        ship.rotationSpeed += 0.01;
        break;
      case 'astronautSpeed':
        astronaut.walkSpeed += 1;
        astronaut.bombThrowCooldownTime -= 2;
        astronaut.updateSpriteColor();
        break;
      case 'bulletDamage':
        Bullet.damageMultiplier += 0.5;
        Bullet.updatePlayerBulletColour(); // Update colour
        break;
      case 'bombDamage':
        Bomb.defaultExplosionRadius += 25;
        Bomb.defaultBombDamage += 1;
        Bomb.updateBombColour();
        break;      
      case 'shieldNumber':
        Shield.MAX_SHIELDS += 1;
        break;
      case 'turret':
        Turret.defaultHealth += 2;
        Turret.defaultRange += 100;
        Turret.ShootCooldown -= 12;      
        break;
      case 'barrageBalloon':
        MoonBase.maxBalloons += 1;
        break;
      case 'wingMan':
        Wingman.MAX_WINGMEN += 1;
        break;  
      case 'cruiseMissile':
        Missile.defaultExplosionRadius += 100;
        Missile.defaultDamage += 3;
        break;  
      case 'drillRig':
        DrillRig.ENERGY_GENERATION_RATE += 0.2;
        break;  
      case 'walkerRobot':
        WalkerRobot.SHOOT_SPEED -= 12;
        WalkerRobot.MAX_WALKERS += 1;
        break;  
    }
  }
}

class UpgradeMenu {
  constructor(upgrades) {
    this.upgrades = upgrades;
    this.isOpen = false;
    this.selectedUpgrade = 0;
    this.scrollOffset = 0;
    this.itemHeight = 50;
    this.scrollBarWidth = 20;
    this.menuPadding = 80; // Space for title and instructions
    this.scrollBarPadding = 2; // Padding for scroll bar
    this.updateDimensions();
  }

  updateDimensions() {
    this.menuWidth = min(600, width * 0.8); // Cap the width at 600 or 80% of screen width
    this.menuHeight = min(500, height * 0.8); // Cap the height at 500 or 80% of screen height
    this.menuX = (width - this.menuWidth) / 2;
    this.menuY = (height - this.menuHeight) / 2;
  }
  
  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.scrollOffset = 0;
      this.selectedUpgrade = 0;
      GameTimer.pauseAll(); // Pause all timers when menu is opened
      //logActiveTimers();

      
    } else {
      GameTimer.resumeAll(); // Resume all timers when menu is closed     
    }
  }

  draw() {
    if (!this.isOpen) return;

    push();
    translate(this.menuX, this.menuY);

    // Draw menu background
    fill(100, 100, 255);
    rect(0, 0, this.menuWidth, this.menuHeight);

    // Draw menu title
    textAlign(CENTER, TOP);
    fill(255);
    textSize(32);
    text("UPGRADES", this.menuWidth / 2, 20);

    const upgradeEntries = Object.entries(this.upgrades.availableUpgrades);
    const totalUpgrades = upgradeEntries.length;

    // Calculate visible items (ensure at least 1)
    this.visibleItems = Math.max(1, Math.floor((this.menuHeight - this.menuPadding) / this.itemHeight));

    // Calculate total menu height and max scroll
    const totalContentHeight = totalUpgrades * this.itemHeight;
    const visibleContentHeight = this.visibleItems * this.itemHeight;
    const maxScroll = Math.max(0, totalContentHeight - visibleContentHeight);

    // Draw upgrades
    let y = 60;
    textSize(20);
    for (let i = 0; i < this.visibleItems; i++) {
      const index = i + Math.floor(this.scrollOffset / this.itemHeight);
      if (index >= totalUpgrades) break;

      const [name, upgrade] = upgradeEntries[index];
      fill(index === this.selectedUpgrade ? color(255, 255, 0) : 255);
      textAlign(LEFT, TOP);
      text(`${upgrade.description} - (${upgrade.level} of ${upgrade.maxLevel})`, 20, y);
      textAlign(RIGHT, TOP);
      
      //If option is too expensive or at max - make it red
      if ((upgrade.cost > money)||(upgrade.level >= upgrade.maxLevel)){
        fill(255,100,0);
      }else{
        fill(255);
      }
      
      text(`Cost: ${upgrade.cost}`, this.menuWidth - this.scrollBarWidth - 20, y);
      y += this.itemHeight;
    }

    // Draw scroll bar if necessary
    if (totalContentHeight > visibleContentHeight) {
      const scrollBarHeight = (visibleContentHeight / totalContentHeight) * visibleContentHeight;
      const scrollBarY = 60 + (this.scrollOffset / maxScroll) * (visibleContentHeight - scrollBarHeight);
      fill(200);
      rect(this.menuWidth - this.scrollBarWidth, 60, this.scrollBarWidth, visibleContentHeight);
      fill(150);
      rect(this.menuWidth - this.scrollBarWidth + this.scrollBarPadding, scrollBarY + this.scrollBarPadding, 
           this.scrollBarWidth - 2 * this.scrollBarPadding, scrollBarHeight - 2 * this.scrollBarPadding);
    }

    // Draw instructions
    textAlign(CENTER, BOTTOM);
    fill(255);
    textSize(16);
    text("ENTER to purchase, U to close", this.menuWidth / 2, this.menuHeight - 10);

    pop();
  }

  handleInput(keyCode) {
    if (!this.isOpen) return;

    const totalUpgrades = Object.keys(this.upgrades.availableUpgrades).length;
    if (totalUpgrades === 0) return;

    switch (keyCode) {
      case UP_ARROW:
        this.selectedUpgrade = (this.selectedUpgrade - 1 + totalUpgrades) % totalUpgrades;
        this.adjustScroll();
        break;
      case DOWN_ARROW:
        this.selectedUpgrade = (this.selectedUpgrade + 1) % totalUpgrades;
        this.adjustScroll();
        break;
      case ENTER:
        const upgradeName = Object.keys(this.upgrades.availableUpgrades)[this.selectedUpgrade];
        const upgrade = this.upgrades.availableUpgrades[upgradeName];
        if (upgrade.level >= upgrade.maxLevel) {
          announcer.speak(`${upgradeName} at maximum level`,0, 2);
        } else if (money < upgrade.cost) {
          announcer.speak(`Not enough money`,0, 2);
        } else if (this.upgrades.purchase(upgradeName)) {
          //announcer.speak(`${upgradeName} upgraded`,0, 2);
        } else {
          announcer.speak(`Unable to upgrade ${upgradeName}`,0, 2);
        }
        break;
      case ESCAPE:
        this.toggle();
        break;
    }
  }

  adjustScroll() {
    const totalUpgrades = Object.keys(this.upgrades.availableUpgrades).length;
    const totalContentHeight = totalUpgrades * this.itemHeight;
    const visibleContentHeight = this.visibleItems * this.itemHeight;
    const maxScroll = Math.max(0, totalContentHeight - visibleContentHeight);
    
    // Adjust scroll to keep the selected item in view
    if (this.selectedUpgrade * this.itemHeight < this.scrollOffset) {
      this.scrollOffset = this.selectedUpgrade * this.itemHeight;
    } else if ((this.selectedUpgrade + 1) * this.itemHeight > this.scrollOffset + visibleContentHeight) {
      this.scrollOffset = (this.selectedUpgrade + 1) * this.itemHeight - visibleContentHeight;
    }
    
    // Ensure scroll doesn't go out of bounds
    this.scrollOffset = constrain(this.scrollOffset, 0, maxScroll);
  }

  refresh() {
    this.selectedUpgrade = 0;
    this.scrollOffset = 0;
    this.isOpen = false;
  }
}

class Debug {
  constructor() {
    if (Debug.instance) {
      return Debug.instance;
    }
    Debug.instance = this;
    
    this.isEnabled = false;
    this.startTime = Date.now();
    this.logHistory = [];
    this.maxLogHistory = 10000;
    this.visualDebugs = {};
  }

  static getInstance() {
    if (!Debug.instance) {
      Debug.instance = new Debug();
    }
    return Debug.instance;
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    console.log(`Debug mode is now ${this.isEnabled ? 'ON' : 'OFF'}`);
    this.log(`Debug mode is now ${this.isEnabled ? 'ON' : 'OFF'}`);
  }

  log(message, ...args) {
    if (!this.isEnabled) return;
    const logEntry = `[${this.getTimestamp()}] ${message}`;
    console.log(logEntry, ...args);
    this.addToLogHistory(logEntry);
  }

  warn(message, ...args) {
    if (!this.isEnabled) return;
    const logEntry = `[${this.getTimestamp()}] WARNING: ${message}`;
    console.warn(logEntry, ...args);
    this.addToLogHistory(logEntry);
  }

  error(message, ...args) {
    if (!this.isEnabled) return;
    const logEntry = `[${this.getTimestamp()}] ERROR: ${message}`;
    console.error(logEntry, ...args);
    this.addToLogHistory(logEntry);
  }

  getTimestamp() {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const milliseconds = elapsed % 1000;
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
  }

  addToLogHistory(logEntry) {
    this.logHistory.push(logEntry);
    if (this.logHistory.length > this.maxLogHistory) {
      this.logHistory.shift();
    }
  }

  saveLogsToFile() {
    console.log("Attempting to save logs to file...");
    if (this.logHistory.length === 0) {
      console.warn("No logs to save.");
      return;
    }

    try {
      const blob = new Blob([this.logHistory.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug_log_${new Date().toISOString()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("Debug logs saved to file successfully.");
    } catch (error) {
      console.error("Error saving logs to file:", error);
    }
  }

  setVisualDebug(key, value) {
    this.visualDebugs[key] = value;
  }

  getVisualDebug(key) {
    return this.visualDebugs[key];
  }

  drawOnScreen() {
    push();
    textAlign(LEFT, TOP);
    textSize(12);
    fill(255);
    
    // Draw visual debugs
    let yOffset = 10;
    for (const [key, value] of Object.entries(this.visualDebugs)) {
      text(`${key}: ${value}`, 10, yOffset);
      yOffset += 20;
    }

    // Draw last few log entries
    yOffset = height - 100;
    for (let i = this.logHistory.length - 1; i >= Math.max(0, this.logHistory.length - 5); i--) {
      text(this.logHistory[i], 10, yOffset);
      yOffset -= 20;
    }

    pop();
  }

  measureExecutionTime(func, label) {
    const start = performance.now();
    const result = func();
    const end = performance.now();
    this.log(`${label} execution time: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  drawHitbox(entity) {
    push();
    noFill();
    stroke(255, 0, 0);
    if (entity.size) {
      ellipse(entity.pos.x, entity.pos.y, entity.size, entity.size);
    } else if (entity.width && entity.height) {
      rect(entity.pos.x, entity.pos.y, entity.width, entity.height);
    }
    pop();
  }
}

class AmbientMusicGenerator {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.baseVolume = 0.15;
    this.energyFactor = 1;

    // Musical parameters
    this.scale = [0, 2, 4, 5, 7, 9, 11]; // Major scale
    this.baseNote = 48; // C2 for a deeper sound
    this.chordProgression = [0, 5, 3, 4]; // I-VI-IV-V progression
    this.currentChordIndex = 0;

    this.pads = [];
    this.melody = null;

    this.createPads();
    this.createMelody();
    this.isPlaying = false;
  }

  createPads() {
    for (let i = 0; i < 4; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();

      osc.type = 'sine';
      gain.gain.value = this.baseVolume * 0.25;

      lfo.type = 'sine';
      lfo.frequency.value = 0.01 + Math.random() * 0.02; // 0.01 to 0.03 Hz (30 to 100 seconds per cycle)
      lfoGain.gain.value = 0.1 + Math.random() * 0.1; // 0.1 to 0.2 Hz depth

      osc.connect(gain);
      gain.connect(this.masterGain);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      this.pads.push({ osc, gain, lfo, lfoGain });
    }
  }

  createMelody() {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc.type = 'sine';
    gain.gain.value = 0;
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    this.melody = { osc, gain, filter };
  }

  start() {
    if (this.isPlaying) return;
    
    const now = this.audioContext.currentTime;
    this.pads.forEach(pad => {
      pad.osc.start(now);
      pad.lfo.start(now);
    });
    this.melody.osc.start(now);
    this.playChordProgression();
    this.playMelody();
    this.isPlaying = true;
  }

  stop() {
    if (!this.isPlaying) return;
    
    const now = this.audioContext.currentTime;
    this.pads.forEach(pad => {
      pad.osc.stop(now);
      pad.lfo.stop(now);
    });
    this.melody.osc.stop(now);
    this.isPlaying = false;
  }

  reset() {
    this.stop();
    this.pads = [];
    this.melody = null;
    this.currentChordIndex = 0;
    this.energyFactor = 1;
    this.createPads();
    this.createMelody();
  }

  playChordProgression() {
    const now = this.audioContext.currentTime;
    const chordRoot = this.baseNote + this.chordProgression[this.currentChordIndex];
    
    this.pads.forEach((pad, i) => {
      const noteInChord = chordRoot + this.scale[i * 2 % this.scale.length];
      const freq = this.midiToFreq(noteInChord);
      pad.osc.frequency.setTargetAtTime(freq, now, 5); // Slow transition over 5 seconds
    });

    this.currentChordIndex = (this.currentChordIndex + 1) % this.chordProgression.length;
    setTimeout(() => this.playChordProgression(), 30000); // Change chord every 30 seconds
  }

  playMelody() {
    const now = this.audioContext.currentTime;
    const noteIndex = Math.floor(Math.random() * this.scale.length);
    const note = this.baseNote + this.scale[noteIndex] + 12; // One octave higher
    const freq = this.midiToFreq(note);

    this.melody.osc.frequency.setTargetAtTime(freq, now, 2);
    this.melody.gain.gain.setTargetAtTime(this.baseVolume * 0.1, now, 2);
    this.melody.gain.gain.setTargetAtTime(0, now + 5, 3);

    const nextNoteTime = 10 + Math.random() * 10; // Play a note every 10-20 seconds
    setTimeout(() => this.playMelody(), nextNoteTime * 1000);
  }

  setEnergyFactor(factor) {
    this.energyFactor = factor;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.setTargetAtTime(this.baseVolume * factor, now, 5);

    // Adjust LFO depths based on energy
    this.pads.forEach(pad => {
      const newDepth = (0.1 + Math.random() * 0.1) * factor;
      pad.lfoGain.gain.setTargetAtTime(newDepth, now, 5);
    });

    // Adjust melody filter frequency
    const newFilterFreq = 500 * factor;
    this.melody.filter.frequency.setTargetAtTime(newFilterFreq, now, 5);
  }

  newLevel() {
    const now = this.audioContext.currentTime;
    
    // Gentle swell
    this.masterGain.gain.setTargetAtTime(this.baseVolume * 1.5, now, 5);
    
    // Return to normal after swell
    setTimeout(() => {
      this.masterGain.gain.setTargetAtTime(this.baseVolume * this.energyFactor, now + 10, 5);
    }, 15000);

    // Slowly change the base note
    this.baseNote = 48 + Math.floor(Math.random() * 7) * 2; // Random even number between 48 and 60
    this.playChordProgression();
  }

  mute() {
    this.masterGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 2);
  }

  unmute() {
    this.masterGain.gain.setTargetAtTime(this.baseVolume * this.energyFactor, this.audioContext.currentTime, 2);
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}

