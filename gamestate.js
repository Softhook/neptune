class GameStateManager {
  static STORAGE_KEY = 'neptuneGameState';
  static VERSION = '2.4';

  static saveGame() {
    try {
      const gameVariables = GameVariableSerializer.serialize();
      const entities = EntitySerializer.serializeAll();
      const world = WorldSerializer.serialize();
      const upgradesData = UpgradeSerializer.serialize(upgrades);
      const timers = GameTimer.serializeTimers();
      const missions = MissionSerializer.serializeMissions();

      const gameState = {
        version: GameStateManager.VERSION,
        gameVariables: gameVariables,
        entities: entities,
        world: world,
        upgrades: upgradesData,
        timers: timers,
        missions: missions
      };

      localStorage.setItem(GameStateManager.STORAGE_KEY, JSON.stringify(gameState));
      return true;
    } catch (error) {
      console.error('Error saving game:', error);
      console.error('Error stack:', error.stack);
      return false;
    }
  }

  static loadGame() {
    try {
      const savedState = localStorage.getItem(GameStateManager.STORAGE_KEY);
      if (!savedState) {
        console.log('No saved game found');
        return false;
      }

      const gameState = JSON.parse(savedState);

      if (gameState.version !== GameStateManager.VERSION) {
        console.warn(`Saved game version mismatch. Expected ${GameStateManager.VERSION}, but got ${gameState.version}. Loading may fail or cause issues.`);
      }

      if (gameState.gameVariables) {
        GameVariableSerializer.deserialize(gameState.gameVariables);
        
        // Ensure energy doesn't exceed maxEnergy
       energy = Math.min(energy, maxEnergy);
        
        // Handle level transition state
        if (showLevelTransition) {
          // If a level transition was in progress, we need to reset it
          showLevelTransition = false;
          levelTransitionTimer = 0;
          GameTimer.clearTimer('levelTransition');
        }
      }

      if (gameState.entities) {
        EntitySerializer.deserializeAll(gameState.entities);
      }
      
      if (gameState.world) {
        WorldSerializer.deserialize(gameState.world);
      }

      if (gameState.upgrades) {
        UpgradeSerializer.deserialize(gameState.upgrades);
      }

      if (gameState.timers) {
        GameTimer.deserializeTimers(gameState.timers);
      }

      if (gameState.missions) {
        MissionSerializer.deserializeMissions(gameState.missions);
      }
 
      this.validateLoadedState();
      this.setupEntityReferences();
      
      return true;
    } catch (error) {
      console.error('Error loading game:', error);
      console.error('Error stack:', error.stack);
      resetGame();  // Reset the game on error
      return false;
    }
  }

static setupEntityReferences() {
  // Set up walker riders
  for (let walker of WalkerRobot.walkers) {
    if (walker.hasRider) {
      walker.rider = astronaut.uniqueId === walker.riderId ? astronaut : null;
      if (!walker.rider) {
        console.warn(`Rider not found for walker ${walker.uniqueId}`);
      }
    }
  }

  // Set up astronaut's ridingWalker
  if (astronaut.isRidingWalker) {
    astronaut.ridingWalker = WalkerRobot.walkers.find(walker => walker.uniqueId === astronaut.ridingWalker);
    if (!astronaut.ridingWalker) {
      console.warn(`Walker not found for astronaut's ridingWalker`);
      astronaut.isRidingWalker = false;
    } else {
      astronaut.ridingWalker.rider = astronaut;
      astronaut.ridingWalker.hasRider = true;
    }
  }
}

  static validateLoadedState() {
    console.log('Validating loaded game state...');

      if (upgrades && upgrades.availableUpgrades) {
    for (const [upgradeName, upgrade] of Object.entries(upgrades.availableUpgrades)) {
      if (typeof upgrade.level !== 'number' || upgrade.level < 0 || upgrade.level > upgrade.maxLevel) {
        console.warn(`Invalid upgrade level for ${upgradeName}, resetting to 0`);
        upgrade.level = 0;
      } else {
        console.log(`${upgradeName} upgrade level: ${upgrade.level}`);
      }
    }
  } else {
    console.warn('Upgrades object not found or invalid');
  }
    
    if (!pod || !pod.pos) {
      console.warn('Invalid pod state after loading, resetting pod');
      placePodOnSurface();
    } else {
      console.log('Pod state valid:', pod);
    }

    if (!ship || !ship.pos) {
      console.warn('Invalid ship state after loading, resetting ship');
      ship = new Ship(createVector(width / 2, height / 2), createVector(0, 0), 20);
    } else {
      console.log('Ship state valid:', ship);
    }

    if (!astronaut || !astronaut.pos) {
      console.warn('Invalid astronaut state after loading, resetting astronaut');
      astronaut = new Astronaut(createVector(ship.pos.x, ship.pos.y), 20);
    } else {
      console.log('Astronaut state valid:', astronaut);
    }

    if (!Array.isArray(Alien.aliens)) {
      console.warn('Invalid aliens state after loading, resetting aliens');
      Alien.aliens = [];
    } else {
      console.log('Aliens state valid, count:', Alien.aliens.length);
    }

    if (!Array.isArray(MoonBase.moonBases)) {
      console.warn('Invalid moon bases state after loading, resetting moon bases');
      MoonBase.moonBases = [];
    } else {
      console.log('Moon bases state valid, count:', MoonBase.moonBases.length);
    }

    if (!Array.isArray(Nest.nests)) {
      console.warn('Invalid nests state after loading, resetting nests');
      Nest.nests = [];
    } else {
      console.log('Nests state valid, count:', Nest.nests.length);
    }

    if (typeof energy !== 'number' || isNaN(energy)) {
      console.warn('Invalid energy state after loading, resetting energy');
      energy = baseEnergy;
    } else {
      console.log('Energy state valid:', energy);
    }

    if (typeof money !== 'number' || isNaN(money)) {
      console.warn('Invalid cash state after loading, resetting cash');
      money = 0;
    } else {
      console.log('Money state valid:', money);
    }

    if (typeof level !== 'number' || isNaN(level) || level < 1) {
      console.warn('Invalid level state after loading, resetting level');
      level = 1;
    } else {
      console.log('Level state valid:', level);
    }

    console.log('Game state validation complete');
  }


}

class GameVariableSerializer {
  static serialize() {
    return {
      energy: energy,
      maxEnergy: maxEnergy,
      alienEnergy: alienEnergy,
      money: money,
      level: level,
      gameState: gameState,
      isWalking: isWalking,
      windAngle: windAngle,
      windForce: windForce,
      cameraOffset: cameraOffset,
      levelTransitionTimer: levelTransitionTimer,
      showLevelTransition: showLevelTransition,
      gameOverSoundPlayed: gameOverSoundPlayed,
      dayNightCycle: dayNightCycle,
      cameraFollowsMissile: cameraFollowsMissile,
      atEarth: atEarth,
      currentMission: MissionControl.currentMission,
      showLevelTransition: showLevelTransition,
      levelTransitionTimer: levelTransitionTimer,
    };
  }

static deserialize(vars) {
  let tempMaxEnergy;

  Object.keys(vars).forEach(key => {
    if (typeof vars[key] !== 'undefined') {
      if (key === 'currentMission') {
        MissionControl.currentMission = vars[key];
      } else if (key === 'maxEnergy') {
        tempMaxEnergy = vars[key];
      } else {
        eval(`${key} = vars[key]`);
      }
    } else {
      console.warn(`Warning: ${key} is undefined in the saved state.`);
    }
  });

  // Set maxEnergy after all other variables have been set
  if (tempMaxEnergy !== undefined) {
    maxEnergy = tempMaxEnergy;
    // Ensure energy doesn't exceed maxEnergy
    if (typeof energy !== 'undefined') {
      energy = Math.min(energy, maxEnergy);
    }
  }

  if (typeof windAngle !== 'undefined' && typeof windForce !== 'undefined') {
    wind = p5.Vector.fromAngle(windAngle).mult(windForce);
  }

  // Handle level transition state
  if (showLevelTransition) {
    // If a level transition was in progress when the game was saved,
    // we need to ensure the timer is properly set up
    GameTimer.create('levelTransition', () => {
      showLevelTransition = false;
    }, 3000); // 3 seconds
  }
}
  
}

class EntitySerializer {
  
  static serializeAll() {
    return {
      ship: ship ? this.serializeShip(ship) : null,
      astronaut: astronaut ? this.serializeAstronaut(astronaut) : null,
      pod: pod ? this.serializePod(pod) : null,
      aliens: Array.isArray(Alien.aliens) ? Alien.aliens.map(alien => this.serializeAlien(alien)) : [],
      hunters: Array.isArray(Hunter.hunters) ? Hunter.hunters.map(hunter => this.serializeHunter(hunter)) : [],
      zappers: Array.isArray(Zapper.zappers) ? Zapper.zappers.map(zapper => this.serializeZapper(zapper)) : [],
      destroyers: Array.isArray(Destroyer.destroyers) ? Destroyer.destroyers.map(destroyer => this.serializeDestroyer(destroyer)) : [],
      nests: Array.isArray(Nest.nests) ? Nest.nests.map(nest => this.serializeNest(nest)) : [],
      moonBases: Array.isArray(MoonBase.moonBases) ? MoonBase.moonBases.map(base => this.serializeMoonBase(base)) : [],
      turrets: Array.isArray(turrets) ? turrets.map(turret => this.serializeTurret(turret)) : [],
      shields: Array.isArray(Shield.shields) ? Shield.shields.map(shield => this.serializeShield(shield)) : [],
      alienPlants: Array.isArray(AlienPlant.plants) ? AlienPlant.plants.map(plant => this.serializeAlienPlant(plant)) : [],
      alienWorms: Array.isArray(AlienWorm.worms) ? AlienWorm.worms.map(worm => this.serializeAlienWorm(worm)) : [],
      meteors: Array.isArray(Meteor.meteors) ? Meteor.meteors.map(meteor => this.serializeMeteor(meteor)) : [],
      diamonds: Array.isArray(DiamondRain.diamonds) ? DiamondRain.diamonds.map(diamond => this.serializeDiamond(diamond)) : [],
      activeMissile: activeMissile ? this.serializeMissile(activeMissile) : null,
      bombs: Array.isArray(bombs) ? bombs.map(bomb => this.serializeBomb(bomb)) : [],
      ruinedShips: RuinedShip.ruinedShips.map(ship => this.serializeRuinedShip(ship)),
      explosions: Array.isArray(explosions) ? explosions.map(explosion => this.serializeExplosion(explosion)) : [],
      alienQueen: alienQueen ? this.serializeAlienQueen(alienQueen) : null,
      alienKing: alienKing ? this.serializeAlienKing(alienKing) : null,
      wingmen: Wingman.wingmen.map(wingman => this.serializeWingman(wingman)),
      drillRigs: DrillRig.rigs.map(rig => this.serializeDrillRig(rig)),
      strandedAstronaut: RescueMission.strandedAstronaut ? this.serializeStrandedAstronaut(RescueMission.strandedAstronaut) : null,
      walkers: WalkerRobot.walkers.map(walker => this.serializeWalker(walker)),
      activeMissile: activeMissile ? this.serializeMissile(activeMissile) : null,
    };
  }

  static deserializeAll(entities) {
    if (!entities) return;
    
    ship = entities.ship ? this.deserializeShip(entities.ship) : null;
    astronaut = entities.astronaut ? this.deserializeAstronaut(entities.astronaut) : null;
    pod = entities.pod ? this.deserializePod(entities.pod) : null;
    
    Alien.aliens = entities.aliens ? entities.aliens.map(alien => this.deserializeAlien(alien)) : [];
    Hunter.hunters = entities.hunters ? entities.hunters.map(hunter => this.deserializeHunter(hunter)) : [];
    Zapper.zappers = entities.zappers ? entities.zappers.map(zapper => this.deserializeZapper(zapper)) : [];
    Destroyer.destroyers = entities.destroyers ? entities.destroyers.map(destroyer => this.deserializeDestroyer(destroyer)) : [];
    Nest.nests = entities.nests ? entities.nests.map(nest => this.deserializeNest(nest)) : [];
    MoonBase.moonBases = entities.moonBases ? entities.moonBases.map(base => this.deserializeMoonBase(base)) : [];
    turrets = entities.turrets ? entities.turrets.map(turret => this.deserializeTurret(turret)) : [];
    Shield.shields = entities.shields ? entities.shields.map(shield => this.deserializeShield(shield)) : [];
    AlienPlant.plants = entities.alienPlants ? entities.alienPlants.map(plant => this.deserializeAlienPlant(plant)) : [];
    AlienWorm.worms = entities.alienWorms ? entities.alienWorms.map(worm => this.deserializeAlienWorm(worm)) : [];
    Meteor.meteors = entities.meteors ? entities.meteors.map(meteor => this.deserializeMeteor(meteor)) : [];
    DiamondRain.diamonds = entities.diamonds ? entities.diamonds.map(diamond => this.deserializeDiamond(diamond)) : [];
    activeMissile = entities.activeMissile ? this.deserializeMissile(entities.activeMissile) : null;
    bombs = entities.bombs ? entities.bombs.map(bomb => this.deserializeBomb(bomb)) : [];
    RuinedShip.ruinedShips = entities.ruinedShips ? entities.ruinedShips.map(ship => this.deserializeRuinedShip(ship)) : [];
    explosions = entities.explosions ? entities.explosions.map(explosion => this.deserializeExplosion(explosion)) : [];
    Wingman.wingmen = entities.wingmen ? entities.wingmen.map(wingman => this.deserializeWingman(wingman)) : [];
    DrillRig.rigs = entities.drillRigs ? entities.drillRigs.map(rig => this.deserializeDrillRig(rig)) : [];
    WalkerRobot.walkers = entities.walkers ? entities.walkers.map(walkerData => this.deserializeWalker(walkerData)) : [];
    activeMissile = entities.activeMissile ? this.deserializeMissile(entities.activeMissile) : null;
    
    if (entities.alienQueen) {
      alienQueen = this.deserializeAlienQueen(entities.alienQueen);
      console.log("Alien Queen deserialized:", alienQueen);
      console.log("Alien Queen alive:", alienQueen.isAlive);
      console.log("Alien Queen position:", alienQueen.pos);
      console.log("Alien Queen size:", alienQueen.size);
    } else {
      alienQueen = null;
      console.log("No Alien Queen data in saved game");
    }
    
      if (entities.alienKing) {
    try {
      alienKing = this.deserializeAlienKing(entities.alienKing);
      debug.log("Alien King deserialized:", alienKing);
      if (alienKing && (!alienKing.corners || !alienKing.springs)) {
        debug.warn("King physics invalid, reinitializing");
        alienKing.initializeShape();
      }
    } catch (error) {
      debug.error("Error deserializing King:", error);
      alienKing = null;
    }
    }
      
    if (entities.strandedAstronaut) {
      RescueMission.strandedAstronaut = this.deserializeStrandedAstronaut(entities.strandedAstronaut);
    } else {
      RescueMission.strandedAstronaut = null;
    }
    
    
  }

  static serializeVector(vector) {
    return vector ? { x: vector.x, y: vector.y } : null;
  }

  static deserializeVector(obj) {
    if (obj && typeof obj.x === 'number' && typeof obj.y === 'number') {
      return createVector(obj.x, obj.y);
    } else {
      console.error('Invalid vector data:', obj);
      return createVector(0, 0);
    }
  }
  
    static serializeWalker(walker) {
    return {
      uniqueId: walker.uniqueId,
      pos: this.serializeVector(walker.pos),
      vel: this.serializeVector(walker.vel),
      size: walker.size,
      health: walker.health,
      direction: walker.direction,
      legAngle: walker.legAngle,
      legSpeed: walker.legSpeed,
      shootCooldown: walker.shootCooldown,
      hasRider: !!walker.rider, // Add this line
      riderId: walker.rider ? walker.rider.uniqueId : null // Change this line
    };
  }

  static deserializeWalker(walkerData) {
    let walker = new WalkerRobot(this.deserializeVector(walkerData.pos));
    walker.uniqueId = walkerData.uniqueId;
    walker.vel = this.deserializeVector(walkerData.vel);
    walker.size = walkerData.size;
    walker.health = walkerData.health;
    walker.direction = walkerData.direction;
    walker.legAngle = walkerData.legAngle;
    walker.legSpeed = walkerData.legSpeed;
    walker.shootCooldown = walkerData.shootCooldown;
    walker.hasRider = walkerData.hasRider;
    walker.riderId = walkerData.riderId;
    return walker;
  }

  static serializeShip(ship) {
    return {
      pos: this.serializeVector(ship.pos),
      vel: this.serializeVector(ship.vel),
      size: ship.size,
      angle: ship.angle,
      health: ship.health,
      isLanded: ship.isLanded,
      hasParachute: ship.hasParachute,
      parachuteDeployed: ship.parachuteDeployed,
      hasGrabbedPod: ship.hasGrabbedPod
    };
  }

  static deserializeShip(shipData) {
    const newShip = new Ship(
      this.deserializeVector(shipData.pos),
      this.deserializeVector(shipData.vel),
      shipData.size
    );
    newShip.angle = shipData.angle;
    newShip.health = shipData.health;
    newShip.isLanded = shipData.isLanded;
    newShip.hasParachute = shipData.hasParachute;
    newShip.parachuteDeployed = shipData.parachuteDeployed;
    newShip.hasGrabbedPod = shipData.hasGrabbedPod;
    return newShip;
  }

  static serializeRuinedShip(ship) {
  return {
    pos: this.serializeVector(ship.pos),
    size: ship.size,
    angle: ship.angle
  };
}
  
  static deserializeRuinedShip(shipData) {
  return new RuinedShip(
    this.deserializeVector(shipData.pos),
    shipData.size
  );
}
  
  static serializeArtifact(artifact) {
    return {
      pos: this.serializeVector(artifact.pos),
      size: artifact.size,
      baseColor: this.serializeColor(artifact.baseColor),
      glowColor: this.serializeColor(artifact.glowColor),
      shape: artifact.shape,
      rotation: artifact.rotation,
      rotationSpeed: artifact.rotationSpeed,
      pulseSpeed: artifact.pulseSpeed,
      pulseAmount: artifact.pulseAmount,
      time: artifact.time
    };
  }
  static deserializeArtifact(artifactData) {
    let artifact = new Artifact(
      this.deserializeVector(artifactData.pos),
      artifactData.size
    );
    artifact.baseColor = this.deserializeColor(artifactData.baseColor);
    artifact.glowColor = this.deserializeColor(artifactData.glowColor);
    artifact.shape = artifactData.shape;
    artifact.rotation = artifactData.rotation;
    artifact.rotationSpeed = artifactData.rotationSpeed;
    artifact.pulseSpeed = artifactData.pulseSpeed;
    artifact.pulseAmount = artifactData.pulseAmount;
    artifact.time = artifactData.time;
    return artifact;
  }
  
  
  static serializeAstronaut(astronaut) {
    return {
      pos: this.serializeVector(astronaut.pos),
      vel: this.serializeVector(astronaut.vel),
      size: astronaut.size,
      hasGrabbedPod: astronaut.hasGrabbedPod,
      isInShip: astronaut.isInShip,
      facing: astronaut.facing,
      targetAngle: astronaut.targetAngle,
      isJumping: astronaut.isJumping,
      jumpCooldown: astronaut.jumpCooldown,
      ridingWalker: astronaut.ridingWalker ? astronaut.ridingWalker.uniqueId : null,
      isRidingWalker: !!astronaut.ridingWalker
    };
  }

  static deserializeAstronaut(astronautData) {
    const newAstronaut = new Astronaut(
      this.deserializeVector(astronautData.pos),
      astronautData.size
    );
    newAstronaut.vel = this.deserializeVector(astronautData.vel);
    newAstronaut.hasGrabbedPod = astronautData.hasGrabbedPod;
    newAstronaut.isInShip = astronautData.isInShip;
    newAstronaut.facing = astronautData.facing;
    newAstronaut.targetAngle = astronautData.targetAngle;
    newAstronaut.isJumping = astronautData.isJumping;
    newAstronaut.jumpCooldown = astronautData.jumpCooldown; 
    newAstronaut.isRidingWalker = astronautData.isRidingWalker;
    return newAstronaut;
  }

  static serializeStrandedAstronaut(astronaut) {
    return {
      pos: this.serializeVector(astronaut.pos),
      size: astronaut.size,
      isRescued: astronaut.isRescued,
      moveSpeed: astronaut.moveSpeed,
      isInShip: astronaut.isInShip,
      health: astronaut.health
    };
  }

  static deserializeStrandedAstronaut(astronautData) {
    const newAstronaut = new StrandedAstronaut(
      this.deserializeVector(astronautData.pos),
      astronautData.size
    );
    newAstronaut.isRescued = astronautData.isRescued;
    newAstronaut.moveSpeed = astronautData.moveSpeed;
    newAstronaut.isInShip = astronautData.isInShip;
    newAstronaut.health = astronautData.health;
    return newAstronaut;
  }
  
  
  
static serializePod(pod) {
  const serializedPod = {
    pos: this.serializeVector(pod.pos),
    size: pod.size,
    pickedUpByShip: pod.pickedUpByShip,
    pickedUpByAlien: pod.pickedUpByAlien,
    pickedUpByAstronaut: pod.pickedUpByAstronaut
  };
  return serializedPod;
}

static deserializePod(podData) {
  console.log('Deserializing Pod:', podData);
  if (!podData || !podData.pos) {
    console.error('Invalid pod data:', podData);
    return null;
  }
  try {
    const newPod = new Pod(
      this.deserializeVector(podData.pos),
      podData.size || 30 // Provide a default size if missing
    );
    newPod.pickedUpByShip = !!podData.pickedUpByShip;
    newPod.pickedUpByAlien = !!podData.pickedUpByAlien;
    newPod.pickedUpByAstronaut = !!podData.pickedUpByAstronaut;
    newPod.logState('Deserialized');
    return newPod;
  } catch (error) {
    console.error('Error deserializing pod:', error);
    return null;
  }
}

  static serializeAlien(alien) {
    return {
      pos: this.serializeVector(alien.pos),
      vel: this.serializeVector(alien.vel),
      size: alien.size,
      health: alien.health,
      hasGrabbedPod: alien.hasGrabbedPod,
      shootingRange: alien.shootingRange,
      speed: alien.speed,
      color: { r: red(alien.color), g: green(alien.color), b: blue(alien.color) }
    };
  }

  static deserializeAlien(alienData) {
    const newAlien = new Alien(
      this.deserializeVector(alienData.pos),
      this.deserializeVector(alienData.vel),
      alienData.size,
      alienData.shootingRange
    );
    newAlien.health = alienData.health;
    newAlien.hasGrabbedPod = alienData.hasGrabbedPod;
    newAlien.speed = alienData.speed;
    newAlien.color = color(alienData.color.r, alienData.color.g, alienData.color.b);
    return newAlien;
  }

  static serializeHunter(hunter) {
    return {
      pos: this.serializeVector(hunter.pos),
      vel: this.serializeVector(hunter.vel),
      size: hunter.size,
      health: hunter.health,
      circlingRadius: hunter.circlingRadius,
      circlingSpeed: hunter.circlingSpeed,
      circlingAngle: hunter.circlingAngle,
      state: hunter.state
    };
  }

  static deserializeHunter(hunterData) {
    const newHunter = new Hunter(
      this.deserializeVector(hunterData.pos),
      this.deserializeVector(hunterData.vel),
      hunterData.size
    );
    newHunter.health = hunterData.health;
    newHunter.circlingRadius = hunterData.circlingRadius;
    newHunter.circlingSpeed = hunterData.circlingSpeed;
    newHunter.circlingAngle = hunterData.circlingAngle;
    newHunter.state = hunterData.state;
    return newHunter;
  }

  static serializeZapper(zapper) {
    return {
      pos: this.serializeVector(zapper.pos),
      vel: this.serializeVector(zapper.vel),
      size: zapper.size,
      health: zapper.health,
      zapCooldown: zapper.zapCooldown,
      isZapping: zapper.isZapping
    };
  }

  static deserializeZapper(zapperData) {
    const newZapper = new Zapper(
      this.deserializeVector(zapperData.pos),
      this.deserializeVector(zapperData.vel),
      zapperData.size
    );
    newZapper.health = zapperData.health;
    newZapper.zapCooldown = zapperData.zapCooldown;
    newZapper.isZapping = zapperData.isZapping;
    return newZapper;
  }

  static serializeDestroyer(destroyer) {
    return {
      pos: this.serializeVector(destroyer.pos),
      vel: this.serializeVector(destroyer.vel),
      size: destroyer.size,
      health: destroyer.health,
      target: destroyer.target ? this.serializeVector(destroyer.target.pos) : null
    };
  }

  static deserializeDestroyer(destroyerData) {
    const newDestroyer = new Destroyer(
      this.deserializeVector(destroyerData.pos),
      this.deserializeVector(destroyerData.vel),
      destroyerData.size
    );
    newDestroyer.health = destroyerData.health;
    if (destroyerData.target) {
      newDestroyer.target = { pos: this.deserializeVector(destroyerData.target) };
    }
    return newDestroyer;
  }

  static serializeNest(nest) {
    return {
      pos: this.serializeVector(nest.pos),
      size: nest.size,
      health: nest.health,
      podsCollected: nest.podsCollected,
      color: nest.color.toString()
    };
  }

  static deserializeNest(nestData) {
    const newNest = new Nest(
      this.deserializeVector(nestData.pos),
      nestData.size,
      color(nestData.color)
    );
    newNest.health = nestData.health;
    newNest.podsCollected = nestData.podsCollected;
    return newNest;
  }

  static serializeMoonBase(base) {
    return {
      width: base.width,
      height: base.height,
      pos: EntitySerializer.serializeVector(base.pos),
      health: base.health,
      maxHealth: base.maxHealth,
      healRate: base.healRate,
      healInterval: base.healInterval,
      healTimer: base.healTimer,
      balloonLaunchCooldown: base.balloonLaunchCooldown,
      balloons: base.balloons.map(balloon => EntitySerializer.serializeBarrageBalloon(balloon))
    };
  }

  static deserializeMoonBase(data) {
    let base = new MoonBase(data.width, data.height, EntitySerializer.deserializeVector(data.pos));
    base.health = data.health;
    base.maxHealth = data.maxHealth;
    base.healRate = data.healRate;
    base.healInterval = data.healInterval;
    base.healTimer = data.healTimer;
    base.balloonLaunchCooldown = data.balloonLaunchCooldown;
    base.balloons = data.balloons.map(balloonData => EntitySerializer.deserializeBarrageBalloon(balloonData));
    return base;
  }

    static serializeBarrageBalloon(balloon) {
    return {
      pos: this.serializeVector(balloon.pos),
      vel: this.serializeVector(balloon.vel),
      size: balloon.size,
      anchorX: balloon.anchorX,
      tetherLength: balloon.tetherLength,
      maxTetherLength: balloon.maxTetherLength,
      maxHeight: balloon.maxHeight,
      windInfluence: balloon.windInfluence,
      swayAngle: balloon.swayAngle,
      swaySpeed: balloon.swaySpeed,
      swayAmount: balloon.swayAmount,
      riseSpeed: balloon.riseSpeed,
      isRising: balloon.isRising,
      health: balloon.health,
      explosionRadius: balloon.explosionRadius
    };
  }
  
    static deserializeBarrageBalloon(data) {
    let balloon = new BarrageBalloon(
      this.deserializeVector(data.pos),
      data.size
    );
    balloon.vel = this.deserializeVector(data.vel);
    balloon.anchorX = data.anchorX;
    balloon.tetherLength = data.tetherLength;
    balloon.maxTetherLength = data.maxTetherLength;
    balloon.maxHeight = data.maxHeight;
    balloon.windInfluence = data.windInfluence;
    balloon.swayAngle = data.swayAngle;
    balloon.swaySpeed = data.swaySpeed;
    balloon.swayAmount = data.swayAmount;
    balloon.riseSpeed = data.riseSpeed;
    balloon.isRising = data.isRising;
    balloon.health = data.health;
    balloon.explosionRadius = data.explosionRadius;
    return balloon;
  }
  
  static serializeTurret(turret) {
    return {
      pos: this.serializeVector(turret.pos),
      size: turret.size,
      health: turret.health,
      angle: turret.angle
    };
  }

  static deserializeTurret(turretData) {
    const newTurret = new Turret(this.deserializeVector(turretData.pos));
    newTurret.size = turretData.size;
    newTurret.health = turretData.health;
    newTurret.angle = turretData.angle;
    return newTurret;
  }

  static serializeShield(shield) {
    return {
      pos: this.serializeVector(shield.pos),
      radius: shield.radius,
      health: shield.health
    };
  }

  static deserializeShield(shieldData) {
    const newShield = new Shield(this.deserializeVector(shieldData.pos));
    newShield.radius = shieldData.radius;
    newShield.health = shieldData.health;
    return newShield;
  }
  
  static serializeAlienPlant(plant) {
    return {
      pos: this.serializeVector(plant.pos),
      size: plant.size,
      maxSize: plant.maxSize,
      currentSize: plant.currentSize,
      growthRate: plant.growthRate,
      health: plant.health,
      decayRate: plant.decayRate,
      color: plant.color.toString(),
      fullyGrown: plant.fullyGrown,
      isDecaying: plant.isDecaying,
      decayChance: plant.decayChance
    };
  }

  static deserializeAlienPlant(plantData) {
    const newPlant = new AlienPlant(
      this.deserializeVector(plantData.pos),
      plantData.size,
      color(plantData.color)
    );
    newPlant.maxSize = plantData.maxSize;
    newPlant.currentSize = plantData.currentSize;
    newPlant.growthRate = plantData.growthRate;
    newPlant.health = plantData.health;
    newPlant.decayRate = plantData.decayRate;
    newPlant.fullyGrown = plantData.fullyGrown;
    newPlant.isDecaying = plantData.isDecaying;
    newPlant.decayChance = plantData.decayChance;
    return newPlant;
  }

  static serializeAlienWorm(worm) {
    return {
      segments: worm.segments.map(segment => ({
        pos: this.serializeVector(segment.pos),
        size: segment.size,
        angle: segment.angle,
        tentacles: segment.tentacles
      })),
      health: worm.health,
      speed: worm.speed,
      direction: worm.direction,
      color: worm.color.toString()
    };
  }

  static deserializeAlienWorm(wormData) {
    const newWorm = new AlienWorm(
      this.deserializeVector(wormData.segments[0].pos),
      color(wormData.color)
    );
    newWorm.segments = wormData.segments.map(segment => ({
      pos: this.deserializeVector(segment.pos),
      size: segment.size,
      angle: segment.angle,
      tentacles: segment.tentacles
    }));
    newWorm.health = wormData.health;
    newWorm.speed = wormData.speed;
    newWorm.direction = wormData.direction;
    return newWorm;
  }

  static serializeMeteor(meteor) {
    return {
      pos: this.serializeVector(meteor.pos),
      vel: this.serializeVector(meteor.vel),
      size: meteor.size,
      explosionRadius: meteor.explosionRadius,
      damage: meteor.damage
    };
  }

  static deserializeMeteor(meteorData) {
    const meteor = new Meteor(
      this.deserializeVector(meteorData.pos),
      this.deserializeVector(meteorData.vel),
      meteorData.size
    );
    meteor.explosionRadius = meteorData.explosionRadius;
    meteor.damage = meteorData.damage;
    return meteor;
  }

  static serializeDiamond(diamond) {
    return {
      pos: this.serializeVector(diamond.pos),
      vel: this.serializeVector(diamond.vel),
      size: diamond.size,
      color: diamond.color.toString(),
      buildHeight: diamond.buildHeight
    };
  }

  static deserializeDiamond(diamondData) {
    const diamond = new DiamondRain(
      this.deserializeVector(diamondData.pos),
      this.deserializeVector(diamondData.vel),
      diamondData.size
    );
    diamond.color = color(diamondData.color);
    diamond.buildHeight = diamondData.buildHeight;
    return diamond;
  }

  static serializeMissile(missile) {
    return {
      pos: this.serializeVector(missile.pos),
      vel: this.serializeVector(missile.vel),
      size: missile.size,
      active: missile.active,
      fuel: missile.fuel,
      explosionRadius: missile.explosionRadius,
      damage: missile.damage
    };
  }

  static deserializeMissile(missileData) {
    const missile = new Missile(
      this.deserializeVector(missileData.pos),
      missileData.size
    );
    missile.vel = this.deserializeVector(missileData.vel);
    missile.active = missileData.active;
    missile.fuel = missileData.fuel;
    missile.explosionRadius = missileData.explosionRadius;
    missile.damage = missileData.damage;
    return missile;
  }

  static serializeBomb(bomb) {
    return {
      pos: this.serializeVector(bomb.pos),
      vel: this.serializeVector(bomb.vel),
      size: bomb.size,
      explosionRadius: bomb.explosionRadius,
      craterDepth: bomb.craterDepth,
      craterWidth: bomb.craterWidth
    };
  }

  static deserializeBomb(bombData) {
    const bomb = new Bomb(
      this.deserializeVector(bombData.pos),
      this.deserializeVector(bombData.vel),
      bombData.size
    );
    bomb.explosionRadius = bombData.explosionRadius;
    bomb.craterDepth = bombData.craterDepth;
    bomb.craterWidth = bombData.craterWidth;
    return bomb;
  }

  static serializeExplosion(explosion) {
    return {
      pos: this.serializeVector(explosion.pos),
      maxSize: explosion.maxSize,
      currentSize: explosion.currentSize,
      lifetime: explosion.lifetime,
      outerColor: explosion.outerColor.toString(),
      innerColor: explosion.innerColor.toString()
    };
  }

  static deserializeExplosion(explosionData) {
    const explosion = new Explosion(
      this.deserializeVector(explosionData.pos),
      explosionData.maxSize,
      color(explosionData.outerColor),
      color(explosionData.innerColor)
    );
    explosion.currentSize = explosionData.currentSize;
    explosion.lifetime = explosionData.lifetime;
    return explosion;
  }
  
  
    static serializeAlienQueen(queen) {
    return {
      pos: this.serializeVector(queen.pos),
      size: queen.size,
      health: queen.health,
      maxHealth: queen.maxHealth,
      isAlive: queen.isAlive,
      isLeaving: queen.isLeaving,
      hasDied: queen.hasDied,
      spawnCooldownTime: queen.spawnCooldownTime,
      burstDefenseRadius: queen.burstDefenseRadius,
      burstDefenseMaxCooldown: queen.burstDefenseMaxCooldown,
      burstDefenseForce: queen.burstDefenseForce,
      burstDefenseAnimationFrames: queen.burstDefenseAnimationFrames,
      currentBurstFrame: queen.currentBurstFrame,
      leavingSpeed: queen.leavingSpeed,
      leaveDelay: queen.leaveDelay,
      spawnCooldownTimer: GameTimer.getTimerState('queenSpawn'),
      burstDefenseCooldownTimer: GameTimer.getTimerState('queenBurstDefense'),
      leaveTimer: GameTimer.getTimerState('queenLeave'),
      corners: queen.corners.map(corner => this.serializeVector(corner.pos)),
      springs: queen.springs.map(spring => ({
      cornerA: queen.corners.indexOf(spring.cornerA),
      cornerB: queen.corners.indexOf(spring.cornerB),
      restLength: spring.restLength,
      strength: spring.strength
    }))
  };      
  }

  static deserializeAlienQueen(queenData) {
    let queen = new AlienQueen(this.deserializeVector(queenData.pos), queenData.size);
    queen.health = queenData.health;
    queen.maxHealth = queenData.maxHealth;
    queen.isAlive = queenData.isAlive;
    queen.isLeaving = queenData.isLeaving;
    queen.hasDied = queenData.hasDied ?? false;
    queen.spawnCooldownTime = queenData.spawnCooldownTime;
    queen.burstDefenseRadius = queenData.burstDefenseRadius;
    queen.burstDefenseMaxCooldown = queenData.burstDefenseMaxCooldown;
    queen.burstDefenseForce = queenData.burstDefenseForce;
    queen.burstDefenseAnimationFrames = queenData.burstDefenseAnimationFrames;
    queen.currentBurstFrame = queenData.currentBurstFrame;
    queen.leavingSpeed = queenData.leavingSpeed;
    queen.leaveDelay = queenData.leaveDelay;
    
    if (queenData.spawnCooldownTimer) {
      GameTimer.create('queenSpawn', queen.spawnMinion.bind(queen), queenData.spawnCooldownTimer.delay, queenData.spawnCooldownTimer.repeat);
    }
    if (queenData.burstDefenseCooldownTimer) {
      GameTimer.create('queenBurstDefense', () => {}, queenData.burstDefenseCooldownTimer.delay, queenData.burstDefenseCooldownTimer.repeat);
    }
    if (queenData.leaveTimer) {
      GameTimer.create('queenLeave', queen.leavePlanet.bind(queen), queenData.leaveTimer.delay, queenData.leaveTimer.repeat);
    }
    
  queen.corners = queenData.corners.map(cornerPos => new Corner(cornerPos.x, cornerPos.y));
  queen.springs = queenData.springs.map(springData => 
    new Spring(
      queen.corners[springData.cornerA],
      queen.corners[springData.cornerB],
      springData.restLength,
      springData.strength
    )
  );

  return queen;
}
  
  
  static serializeAlienKing(king) {
  if (!king) return null;
  return {
    pos: this.serializeVector(king.pos),
    vel: this.serializeVector(king.vel),
    size: king.size,
    health: king.health,
    maxHealth: king.maxHealth,
    isAlive: king.isAlive,
    isLeaving: king.isLeaving,
    hasDied: king.hasDied,
    
    phase: king.phase,
    phaseChangeTimer: king.phaseChangeTimer,
    phaseChangeInterval: king.phaseChangeInterval,
    currentColor: this.serializeColor(king.currentColor),
    targetColor: this.serializeColor(king.targetColor),
    colorTransitionSpeed: king.colorTransitionSpeed,

    laserCooldown: king.laserCooldown,
    laserMaxCooldown: king.laserMaxCooldown,
    laserDuration: king.laserDuration,
    laserCurrentDuration: king.laserCurrentDuration,
    shootingRange: king.shootingRange,
    teleportCooldown: king.teleportCooldown,
    teleportMaxCooldown: king.teleportMaxCooldown,

    corners: king.corners?.map(corner => ({
      pos: this.serializeVector(corner.pos),
      vel: this.serializeVector(corner.vel),
      acc: this.serializeVector(corner.acc),
      mass: corner.mass
    })) || [],
    
    springs: king.springs?.map(spring => ({
      cornerA: king.corners.indexOf(spring.cornerA),
      cornerB: king.corners.indexOf(spring.cornerB),
      restLength: spring.restLength,
      strength: spring.strength
    })) || [],

    timers: {
      kingLeave: GameTimer.getTimerState('kingLeave'),
      kingEnter: GameTimer.getTimerState('kingEnter'),
      kingAppear: GameTimer.getTimerState('kingAppear'),
      kingBurstDefense: GameTimer.getTimerState('kingBurstDefense')
    }
  };
}

static deserializeAlienKing(kingData) {
  if (!kingData || !kingData.pos) {
    debug.warn("Invalid king data");
    return null;
  }

  try {
    const king = new AlienKing(
      this.deserializeVector(kingData.pos),
      kingData.size || 500
    );

    Object.assign(king, {
      health: kingData.health ?? king.maxHealth,
      maxHealth: kingData.maxHealth,
      isAlive: kingData.isAlive ?? false,
      isLeaving: kingData.isLeaving ?? false,
      hasDied: kingData.hasDied ?? false,
      vel: this.deserializeVector(kingData.vel),
      
      phase: kingData.phase ?? 1,
      phaseChangeTimer: kingData.phaseChangeTimer,
      phaseChangeInterval: kingData.phaseChangeInterval,
      colorTransitionSpeed: kingData.colorTransitionSpeed,
      
      laserCooldown: kingData.laserCooldown ?? 0,
      laserMaxCooldown: kingData.laserMaxCooldown,
      laserDuration: kingData.laserDuration,
      laserCurrentDuration: kingData.laserCurrentDuration ?? 0,
      shootingRange: kingData.shootingRange,
      teleportCooldown: kingData.teleportCooldown ?? 0,
      teleportMaxCooldown: kingData.teleportMaxCooldown
    });

    king.currentColor = this.deserializeColor(kingData.currentColor) || king.phaseColors[0];
    king.targetColor = this.deserializeColor(kingData.targetColor) || king.phaseColors[0];

    if (kingData.corners?.length > 0 && kingData.springs?.length > 0) {
      king.corners = kingData.corners.map(cornerData => {
        const corner = new Corner(cornerData.pos.x, cornerData.pos.y);
        corner.vel = this.deserializeVector(cornerData.vel);
        corner.acc = this.deserializeVector(cornerData.acc);
        corner.mass = cornerData.mass;
        return corner;
      });

      king.springs = kingData.springs.map(springData => 
        new Spring(
          king.corners[springData.cornerA],
          king.corners[springData.cornerB],
          springData.restLength,
          springData.strength
        )
      );
    } else {
      debug.warn("Reinitializing king physics");
      king.initializeShape();
    }

    if (kingData.timers) {
      if (kingData.timers.kingLeave) {
        GameTimer.create('kingLeave', () => king.leavePlanet(), 
          kingData.timers.kingLeave.timeRemaining || kingData.timers.kingLeave.delay);
      }
      if (kingData.timers.kingEnter) {
        GameTimer.create('kingEnter', () => {}, 
          kingData.timers.kingEnter.timeRemaining || kingData.timers.kingEnter.delay);
      }
      if (kingData.timers.kingAppear) {
        GameTimer.create('kingAppear', () => {}, 
          kingData.timers.kingAppear.timeRemaining || kingData.timers.kingAppear.delay);
      }
      if (kingData.timers.kingBurstDefense) {
        GameTimer.create('kingBurstDefense', () => {}, 
          kingData.timers.kingBurstDefense.timeRemaining || kingData.timers.kingBurstDefense.delay);
      }
    }

    return king;
  } catch (error) {
    debug.error("Failed to deserialize king:", error);
    return null;
  }
}
  

  static serializeWingman(wingman) {
    return {
      pos: this.serializeVector(wingman.pos),
      vel: this.serializeVector(wingman.vel),
      size: wingman.size,
      health: wingman.health,
      maxHealth: wingman.maxHealth,
      isActive: wingman.isActive,
      targetPosition: this.serializeVector(wingman.targetPosition),
      state: wingman.state,
      attackRange: wingman.attackRange,
      defendRange: wingman.defendRange,
      shootCooldown: wingman.shootCooldown,
      bombCooldown: wingman.bombCooldown,
      maxSpeed: wingman.maxSpeed,
      wingmanIndex: wingman.wingmanIndex
    };
  }

  static deserializeWingman(wingmanData) {
    let wingman = new Wingman(
      this.deserializeVector(wingmanData.pos),
      this.deserializeVector(wingmanData.vel),
      wingmanData.size
    );
    wingman.health = wingmanData.health;
    wingman.maxHealth = wingmanData.maxHealth;
    wingman.isActive = wingmanData.isActive;
    wingman.targetPosition = this.deserializeVector(wingmanData.targetPosition);
    wingman.state = wingmanData.state;
    wingman.attackRange = wingmanData.attackRange;
    wingman.defendRange = wingmanData.defendRange;
    wingman.shootCooldown = wingmanData.shootCooldown;
    wingman.bombCooldown = wingmanData.bombCooldown;
    wingman.maxSpeed = wingmanData.maxSpeed;
    wingman.wingmanIndex = wingmanData.wingmanIndex;
    return wingman;
  }

  static serializeDrillRig(rig) {
    return {
      pos: this.serializeVector(rig.pos),
      size: rig.size,
      health: rig.health,
      isInCluster: rig.isInCluster,
      energyGenerated: rig.energyGenerated,
      placementTime: rig.placementTime
    };
  }

  static deserializeDrillRig(rigData) {
    let rig = new DrillRig(this.deserializeVector(rigData.pos));
    rig.size = rigData.size;
    rig.health = rigData.health;
    rig.isInCluster = rigData.isInCluster;
    rig.energyGenerated = rigData.energyGenerated;
    rig.placementTime = rigData.placementTime;
    return rig;
  }
  
  
  
  

  // Helper method to serialize color objects
  static serializeColor(c) {
    return [c.levels[0], c.levels[1], c.levels[2], c.levels[3]];
  }

  // Helper method to deserialize color arrays
  static deserializeColor(colorArray) {
    return color(colorArray[0], colorArray[1], colorArray[2], colorArray[3]);
  }
}

class WorldSerializer {
  static serialize() {
    return {
      moonSurface: this.serializeMoonSurface(moonSurface),
      backgroundStars: backgroundStars,
      wind: EntitySerializer.serializeVector(wind),
      magneticStorm: this.serializeMagneticStorm(magneticStorm),
      methaneBlizzard: this.serializeMethaneBlizzard(methaneBlizzard),
      alienPlantClusters: AlienPlant.clusterCenters.map(center => ({
         x: center.x,
         y: center.y,
        color: EntitySerializer.serializeColor(center.color)
     })),
      ruinedBases: RuinedBase.ruinedBases.map(base => ({
        pos: EntitySerializer.serializeVector(base.pos),
        width: base.width,
        height: base.height
      }))
    };
  }

  static deserialize(world) {
    moonSurface = this.deserializeMoonSurface(world.moonSurface);
    backgroundStars = world.backgroundStars;
    wind = EntitySerializer.deserializeVector(world.wind);
    AlienPlant.clusterCenters = world.alienPlantClusters.map(center => ({
      x: center.x,
      y: center.y,
      color: EntitySerializer.deserializeColor(center.color)
    }));
    RuinedBase.ruinedBases = world.ruinedBases.map(baseData => 
      new RuinedBase(
        EntitySerializer.deserializeVector(baseData.pos),
        baseData.width,
        baseData.height
      )
    );
    
    if (world.magneticStorm) {
      this.deserializeMagneticStorm(world.magneticStorm);
    }
    if (world.methaneBlizzard) {
      this.deserializeMethaneBlizzard(world.methaneBlizzard);
    }
  }

  static serializeMoonSurface(surface) {
    return surface.map(point => EntitySerializer.serializeVector(point));
  }

  static deserializeMoonSurface(surfaceData) {
    return surfaceData.map(point => EntitySerializer.deserializeVector(point));
  }
  
    static serializeMagneticStorm(storm) {
    return {
      isActive: storm.isActive,
      duration: storm.duration,
      alpha: storm.alpha
      // Add any other relevant properties
    };
  }

  static serializeMethaneBlizzard(blizzard) {
    return {
      isActive: blizzard.isActive,
      duration: blizzard.duration,
      windStrength: blizzard.windStrength,
      visibility: blizzard.visibility
      // Add any other relevant properties
    };
  }

  static deserializeMagneticStorm(stormData) {
    magneticStorm.isActive = stormData.isActive;
    magneticStorm.duration = stormData.duration;
    magneticStorm.alpha = stormData.alpha;
    // Set any other relevant properties
  }

  static deserializeMethaneBlizzard(blizzardData) {
    methaneBlizzard.isActive = blizzardData.isActive;
    methaneBlizzard.duration = blizzardData.duration;
    methaneBlizzard.windStrength = blizzardData.windStrength;
    methaneBlizzard.visibility = blizzardData.visibility;
    // Set any other relevant properties
  }
  
}

class UpgradeSerializer {
  static serialize(upgrades) {
    return {
      availableUpgrades: Object.fromEntries(
        Object.entries(upgrades.availableUpgrades).map(([key, upgrade]) => [
          key,
          {
            cost: upgrade.cost,
            level: upgrade.level,
            maxLevel: upgrade.maxLevel,
            description: upgrade.description
          }
        ])
      ),
      bulletDamageMultiplier: Bullet.damageMultiplier,
      bombExplosionRadius: Bomb.defaultExplosionRadius,
      bombDamage: Bomb.defaultBombDamage,
      turretHealth: Turret.defaultHealth,
      turretRange: Turret.defaultRange,
      maxShields: Shield.MAX_SHIELDS,
      maxBalloons: MoonBase.maxBalloons
    };
  }

static deserialize(upgradeData) {
  if (!upgradeData || !upgradeData.availableUpgrades) {
    console.warn('Invalid upgrade data, unable to deserialize');
    return;
  }

  // Reset upgrades to initial state
  upgrades.reset();

  // Apply saved upgrade levels
  for (const [upgradeName, upgradeInfo] of Object.entries(upgradeData.availableUpgrades)) {
    if (upgrades.availableUpgrades.hasOwnProperty(upgradeName)) {
      const upgrade = upgrades.availableUpgrades[upgradeName];
      upgrade.cost = upgradeInfo.cost;
      upgrade.level = upgradeInfo.level;
      upgrade.maxLevel = upgradeInfo.maxLevel;
      upgrade.description = upgradeInfo.description;

      // Apply the upgrade effects for each level
      for (let i = 0; i < upgrade.level; i++) {
        upgrades.applyUpgrade(upgradeName);
      }
    } else {
      console.warn(`Upgrade ${upgradeName} not found in current game version`);
    }
  }

  // Restore bullet damage multiplier
  if (typeof upgradeData.bulletDamageMultiplier === 'number') {
    Bullet.damageMultiplier = upgradeData.bulletDamageMultiplier;
  } else {
    console.warn('Bullet damage multiplier not found in saved data, using default');
    Bullet.damageMultiplier = 1;
  }

  // Restore bomb explosion radius
  if (typeof upgradeData.bombExplosionRadius === 'number') {
    Bomb.defaultExplosionRadius = upgradeData.bombExplosionRadius;
  } else {
    console.warn('Bomb explosion radius not found in saved data, using default');
    Bomb.defaultExplosionRadius = 30; // Assuming 30 is the default value
  }

  // Restore bomb damage
  if (typeof upgradeData.bombDamage === 'number') {
    Bomb.defaultBombDamage = upgradeData.bombDamage;
  } else {
    console.warn('Bomb damage not found in saved data, using default');
    Bomb.defaultBombDamage = 3; // Assuming 3 is the default value
  }

  // Restore turret health
  if (typeof upgradeData.turretHealth === 'number') {
    Turret.defaultHealth = upgradeData.turretHealth;
  } else {
    console.warn('Turret health not found in saved data, using default');
    Turret.defaultHealth = 4; // Assuming 4 is the default value
  }

  // Restore turret range
  if (typeof upgradeData.turretRange === 'number') {
    Turret.defaultRange = upgradeData.turretRange;
  } else {
    console.warn('Turret range not found in saved data, using default');
    Turret.defaultRange = 200; // Assuming 200 is the default value
  }

  // Restore max shields
  if (typeof upgradeData.maxShields === 'number') {
    Shield.MAX_SHIELDS = upgradeData.maxShields;
  } else {
    console.warn('Max shields not found in saved data, using default');
    Shield.MAX_SHIELDS = 3; // Assuming 3 is the default value
  }

  // Restore max balloons
  if (typeof upgradeData.maxBalloons === 'number') {
    MoonBase.maxBalloons = upgradeData.maxBalloons;
  } else {
    console.warn('Max balloons not found in saved data, using default');
    MoonBase.maxBalloons = 0; // Assuming 0 is the default value
  }
}
  
static validate(upgradeData) {
  if (!upgradeData || typeof upgradeData !== 'object') {
    console.error('Invalid upgrade data structure');
    return false;
  }

  if (!upgradeData.availableUpgrades || typeof upgradeData.availableUpgrades !== 'object') {
    console.error('Invalid availableUpgrades structure');
    return false;
  }

  for (const [upgradeName, upgradeInfo] of Object.entries(upgradeData.availableUpgrades)) {
    if (typeof upgradeInfo.cost !== 'number' ||
        typeof upgradeInfo.level !== 'number' ||
        typeof upgradeInfo.maxLevel !== 'number' ||
        typeof upgradeInfo.description !== 'string') {
      console.error(`Invalid upgrade info for ${upgradeName}`);
      return false;
    }
  }

  const additionalProperties = [
    'bulletDamageMultiplier',
    'bombExplosionRadius',
    'bombDamage',
    'turretHealth',
    'turretRange',
    'maxShields',
    'maxBalloons'
  ];

  for (const prop of additionalProperties) {
    if (typeof upgradeData[prop] !== 'number') {
      console.error(`Invalid or missing ${prop}`);
      return false;
    }
  }

  return true;
}
  
}

class MissionSerializer {
  static serializeMissions() {
    return {
      currentMission: MissionControl.currentMission,
      missionTimers: this.serializeMissionTimers(),
      earthDefense: EarthDefenseMission.isActive ? this.serializeEarthDefenseMission() : null,
      alienPlantInfestation: AlienPlantInfestation.isActive ? this.serializeAlienPlantInfestation() : null,
      wormHunt: WormHuntMission.isActive ? this.serializeWormHuntMission() : null,
      buildBase: BuildBaseMission.isActive ? this.serializeBuildBaseMission() : null,
      rescueMission: RescueMission.isActive ? this.serializeRescueMission() : null,
      noFlyZone: NoFlyZoneMission.isActive ? this.serializeNoFlyZoneMission() : null,
      attackMission: AttackMission.isActive ? this.serializeAttackMission() : null,
      artifactRecovery: ArtifactRecoveryMission.isActive ? this.serializeArtifactRecoveryMission() : null,
    };
  }

  static serializeMissionTimers() {
    return GameTimer.getActiveTimers()
      .filter(timer => timer.key.startsWith('mission'))
      .map(timer => ({
        key: timer.key,
        timeRemaining: timer.timeRemaining,
        delay: timer.delay,
        repeat: timer.repeat
      }));
  }

  static deserializeMissions(missionData) {
    if (missionData.currentMission) {
      MissionControl.currentMission = missionData.currentMission;
    }
    if (missionData.missionTimers) {
      this.deserializeMissionTimers(missionData.missionTimers);
    }
    if (missionData.earthDefense) this.deserializeEarthDefenseMission(missionData.earthDefense);
    if (missionData.alienPlantInfestation) this.deserializeAlienPlantInfestation(missionData.alienPlantInfestation);
    if (missionData.wormHunt) this.deserializeWormHuntMission(missionData.wormHunt);
    if (missionData.buildBase) this.deserializeBuildBaseMission(missionData.buildBase);
    if (missionData.rescueMission) this.deserializeRescueMission(missionData.rescueMission);
    if (missionData.noFlyZone) this.deserializeNoFlyZoneMission(missionData.noFlyZone);
    if (missionData.attackMission) this.deserializeAttackMission(missionData.attackMission);
    if (missionData.artifactRecovery) this.deserializeArtifactRecoveryMission(missionData.artifactRecovery);
  }

  static deserializeMissionTimers(timerData) {
    timerData.forEach(timer => {
      GameTimer.create(timer.key, () => {}, timer.timeRemaining, timer.repeat);
    });
  }

  static serializeEarthDefenseMission() {
    return {
      isActive: EarthDefenseMission.isActive,
      teleportationInProgress: EarthDefenseMission.teleportationInProgress,
      fadeAlpha: EarthDefenseMission.fadeAlpha,
      hasMissionOccurred: EarthDefenseMission.hasMissionOccurred,
      missionTimer: GameTimer.getTimerState(EarthDefenseMission.missionTimerKey)
    };
  }

  static deserializeEarthDefenseMission(data) {
    EarthDefenseMission.isActive = data.isActive;
    EarthDefenseMission.teleportationInProgress = data.teleportationInProgress;
    EarthDefenseMission.fadeAlpha = data.fadeAlpha;
    EarthDefenseMission.hasMissionOccurred = data.hasMissionOccurred;
    if (data.isActive && data.missionTimer) {
      GameTimer.create(
        EarthDefenseMission.missionTimerKey,
        EarthDefenseMission.completeMission.bind(EarthDefenseMission, false),
        data.missionTimer.timeRemaining,
        data.missionTimer.repeat
      );
    }
  }

  static serializeAlienPlantInfestation() {
    return {
      isActive: AlienPlantInfestation.isActive,
      plantsDestroyed: AlienPlantInfestation.plantsDestroyed,
      lastKnownPlants: AlienPlantInfestation.lastKnownPlants.map(plant => EntitySerializer.serializeAlienPlant(plant)),
      missionTimer: GameTimer.getTimerState(AlienPlantInfestation.missionTimerKey)
    };
  }

  static deserializeAlienPlantInfestation(data) {
    AlienPlantInfestation.isActive = data.isActive;
    AlienPlantInfestation.plantsDestroyed = data.plantsDestroyed;
    AlienPlantInfestation.lastKnownPlants = data.lastKnownPlants.map(plantData => EntitySerializer.deserializeAlienPlant(plantData));
    if (data.isActive && data.missionTimer) {
      GameTimer.create(
        AlienPlantInfestation.missionTimerKey,
        AlienPlantInfestation.completeMission.bind(AlienPlantInfestation, false),
        data.missionTimer.timeRemaining,
        data.missionTimer.repeat
      );
    }
  }

  static serializeWormHuntMission() {
    return {
      isActive: WormHuntMission.isActive,
      wormsDestroyed: WormHuntMission.wormsDestroyed,
      startTime: WormHuntMission.startTime,
      lastKnownWorms: WormHuntMission.lastKnownWorms.map(worm => EntitySerializer.serializeAlienWorm(worm)),
      missionTimer: GameTimer.getTimerState(WormHuntMission.missionTimerKey)
    };
  }

  static deserializeWormHuntMission(data) {
    WormHuntMission.isActive = data.isActive;
    WormHuntMission.wormsDestroyed = data.wormsDestroyed;
    WormHuntMission.startTime = data.startTime;
    WormHuntMission.lastKnownWorms = data.lastKnownWorms.map(wormData => EntitySerializer.deserializeAlienWorm(wormData));
    if (data.isActive && data.missionTimer) {
      GameTimer.create(
        WormHuntMission.missionTimerKey,
        WormHuntMission.completeMission.bind(WormHuntMission, false),
        data.missionTimer.timeRemaining,
        data.missionTimer.repeat
      );
    }
  }

  static serializeBuildBaseMission() {
    return {
      isActive: BuildBaseMission.isActive,
      initialBaseCount: BuildBaseMission.initialBaseCount,
      missionTimer: GameTimer.getTimerState(BuildBaseMission.missionTimerKey)
    };
  }

  static deserializeBuildBaseMission(data) {
    BuildBaseMission.isActive = data.isActive;
    BuildBaseMission.initialBaseCount = data.initialBaseCount;
    if (data.isActive && data.missionTimer) {
      GameTimer.create(
        BuildBaseMission.missionTimerKey,
        BuildBaseMission.completeMission.bind(BuildBaseMission),
        data.missionTimer.timeRemaining,
        data.missionTimer.repeat
      );
    }
  }

  static serializeRescueMission() {
    return {
      isActive: RescueMission.isActive,
      crashedShip: RescueMission.crashedShip ? EntitySerializer.serializeRuinedShip(RescueMission.crashedShip) : null,
      strandedAstronaut: RescueMission.strandedAstronaut ? EntitySerializer.serializeStrandedAstronaut(RescueMission.strandedAstronaut) : null,
      missionLevel: RescueMission.missionLevel,
      missionTimer: GameTimer.getTimerState(RescueMission.missionTimerKey)
    };
  }

  static deserializeRescueMission(data) {
    RescueMission.isActive = data.isActive;
    RescueMission.crashedShip = data.crashedShip ? EntitySerializer.deserializeRuinedShip(data.crashedShip) : null;
    RescueMission.strandedAstronaut = data.strandedAstronaut ? EntitySerializer.deserializeStrandedAstronaut(data.strandedAstronaut) : null;
    RescueMission.missionLevel = data.missionLevel;
    if (data.isActive && data.missionTimer) {
      GameTimer.create(
        RescueMission.missionTimerKey,
        () => Hunter.spawnHunter(),
        data.missionTimer.timeRemaining,
        data.missionTimer.repeat
      );
    }
  }

  static serializeNoFlyZoneMission() {
    return {
      isActive: NoFlyZoneMission.isActive,
      hasViolatedNoFlyZone: NoFlyZoneMission.hasViolatedNoFlyZone,
      missionTimer: GameTimer.getTimerState(NoFlyZoneMission.missionTimerKey),
      gracePeriodTimer: GameTimer.getTimerState('noFlyZoneGracePeriod')
    };
  }

  static deserializeNoFlyZoneMission(data) {
    NoFlyZoneMission.isActive = data.isActive;
    NoFlyZoneMission.hasViolatedNoFlyZone = data.hasViolatedNoFlyZone;
    if (data.isActive) {
      if (data.missionTimer) {
        GameTimer.create(
          NoFlyZoneMission.missionTimerKey,
          NoFlyZoneMission.completeMission.bind(NoFlyZoneMission),
          data.missionTimer.timeRemaining,
          data.missionTimer.repeat
        );
      }
      if (data.gracePeriodTimer) {
        GameTimer.create(
          'noFlyZoneGracePeriod',
          () => {
            if (!ship.isLanded) {
              NoFlyZoneMission.hasViolatedNoFlyZone = true;
            }
          },
          data.gracePeriodTimer.timeRemaining,
          data.gracePeriodTimer.repeat
        );
      }
    }
  }

  static serializeAttackMission() {
    return {
      isActive: AttackMission.isActive,
      missionTimer: GameTimer.getTimerState(AttackMission.missionTimerKey)
    };
  }

  static deserializeAttackMission(data) {
    AttackMission.isActive = data.isActive;
    if (data.isActive && data.missionTimer) {
      GameTimer.create(
        AttackMission.missionTimerKey,
        AttackMission.completeMission.bind(AttackMission),
        data.missionTimer.timeRemaining,
        data.missionTimer.repeat
      );
    }
  }

  static serializeArtifactRecoveryMission() {
    return {
      isActive: ArtifactRecoveryMission.isActive,
      artifacts: ArtifactRecoveryMission.artifacts.map(artifact => EntitySerializer.serializeArtifact(artifact)),
      collectedArtifacts: ArtifactRecoveryMission.collectedArtifacts
    };
  }

  static deserializeArtifactRecoveryMission(data) {
    ArtifactRecoveryMission.isActive = data.isActive;
    ArtifactRecoveryMission.artifacts = data.artifacts.map(artifactData => EntitySerializer.deserializeArtifact(artifactData));
    ArtifactRecoveryMission.collectedArtifacts = data.collectedArtifacts;
    if (data.isActive) {
      ArtifactRecoveryMission.startMission();
    }
  }
}


class TestUtility {
  static testEnergyLevelAfterLoad() {
    console.log("Starting energy level test after game load...");

    // Initialize game variables
    energy = 90000;
    money = 56;
    level = 9;
    gameMode = 'singlePlayer';  // Changed from gameState to gameMode
    isWalking = false;
    windAngle = 2;
    windForce = 5;
    dayNightCycle = 8;  // Added dayNightCycle
    cameraOffset = 14;
    showLevelTransition = false;
    levelTransitionTimer = 0;
    gameOverSoundPlayed = false;

    const initialEnergy = energy;
    console.log('Initial energy:', energy);

    // Save the game state
    console.log('Saving game state...');
    const saveResult = GameStateManager.saveGame();
    console.log('Save result:', saveResult);

    if (!saveResult) {
      console.error('Failed to save game state. Aborting test.');
      return;
    }

    // Simulate a game reset
    console.log('Resetting game...');
      resetGame();
    console.log('Energy after reset:', energy);

    // Manually set the energy level to a different value
    energy = 1000;
    console.log('Energy manually set to:', energy);

    // Load the game state
    console.log('Loading game state...');
    const loadResult = GameStateManager.loadGame();
    if (!loadResult) {
      console.error('Failed to load game state. Aborting test.');
      return;
    }

    console.log('Energy after loading:', energy);

    // Verify if the energy level is correctly restored
    if (energy === initialEnergy) {
      console.log("SUCCESS: Energy level matches the expected value after loading.");
    } else {
      console.error(`FAILURE: Energy level does not match the expected value. Expected ${initialEnergy}, but got ${energy}.`);
    }

    // Display saved state for debugging
    const savedState = localStorage.getItem(GameStateManager.STORAGE_KEY);
    console.log('Saved state:', savedState);

    // Additional checks
    this.checkOtherVariables(initialEnergy);
  }

  static checkOtherVariables(initialEnergy) {
    console.log("Checking other variables...");
    console.log(`Money: ${money}`);
    console.log(`Level: ${level}`);
    console.log(`Game Mode: ${gameMode}`);
    console.log(`Day-Night Cycle: ${dayNightCycle}`);
    console.log(`Wind Angle: ${windAngle}`);
    console.log(`Wind Force: ${windForce}`);

    if (money !== 56 || level !== 9 || gameMode !== 'singlePlayer') {
      console.error("FAILURE: One or more game variables were not correctly restored.");
    } else {
      console.log("SUCCESS: Other game variables were correctly restored.");
    }
  }
}