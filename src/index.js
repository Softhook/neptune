/**
 * Neptune Game - Refactored Module Entry Point
 * Barrel export for all refactored modules
 */

// Core systems
export { default as StateManager } from './core/StateManager.js';
export { default as EntityManager } from './core/EntityManager.js';
export { default as EventSystem, GameEvents } from './core/EventSystem.js';
export { default as ConfigManager } from './core/ConfigManager.js';

// Base classes
export { default as BaseEntity } from './entities/BaseEntity.js';
export { default as BaseMission } from './missions/BaseMission.js';

// Entity classes
export * from './entities/index.js';

// Mission classes
export * from './missions/index.js';

// System classes
export * from './systems/index.js';

// System managers (to be created)
// export { default as RenderManager } from './systems/RenderManager.js';
// export { default as PhysicsManager } from './systems/PhysicsManager.js';

/**
 * Initialize all core systems
 */
export async function initializeNeptuneCore() {
  console.log('Initializing Neptune Core Systems...');
  
  // Initialize service locator first
  const { default: ServiceLocator } = await import('./systems/ServiceLocator.js');
  const serviceLocator = ServiceLocator;
  
  // Initialize logger
  const { default: Logger } = await import('./systems/Logger.js');
  serviceLocator.register('logger', Logger);
  Logger.info('Logger system initialized', null, 'system');
  
  // Load saved configurations
  const { default: ConfigManager } = await import('./core/ConfigManager.js');
  const configManager = new ConfigManager();
  configManager.load();
  serviceLocator.register('configManager', configManager);
  Logger.info('Configuration system initialized', null, 'system');
  
  // Initialize state manager with config
  const { default: StateManager } = await import('./core/StateManager.js');
  const stateManager = new StateManager();
  serviceLocator.register('stateManager', stateManager);
  Logger.info('State management system initialized', null, 'system');
  
  // Initialize entity manager
  const { default: EntityManager } = await import('./core/EntityManager.js');
  const entityManager = new EntityManager();
  serviceLocator.register('entityManager', entityManager);
  
  // Register common entity types with pooling
  entityManager.registerCollection('bullets', 200, 50);
  entityManager.registerCollection('particles', 150, 30);
  entityManager.registerCollection('aliens', 100);
  entityManager.registerCollection('hunters', 50);
  entityManager.registerCollection('zappers', 20);
  entityManager.registerCollection('destroyers', 20);
  entityManager.registerCollection('worms', 10);
  entityManager.registerCollection('walkers', 5);
  entityManager.registerCollection('plants', 70);
  entityManager.registerCollection('nests', 20);
  entityManager.registerCollection('bases', 10);
  entityManager.registerCollection('explosions', 20, 10);
  entityManager.registerCollection('meteors', 15);
  entityManager.registerCollection('diamonds', 30, 10);
  entityManager.registerCollection('drillRigs', 10);
  entityManager.registerCollection('balloons', 20, 5);
  Logger.info('Entity management system initialized', null, 'system');
  
  // Initialize event system
  const { default: EventSystem, GameEvents } = await import('./core/EventSystem.js');
  const eventSystem = EventSystem;
  serviceLocator.register('eventSystem', eventSystem);
  Logger.info('Event system initialized', null, 'system');
  
  // Initialize input manager
  const { default: InputManager } = await import('./systems/InputManager.js');
  const inputManager = new InputManager();
  serviceLocator.register('inputManager', inputManager);
  Logger.info('Input management system initialized', null, 'system');
  
  // Initialize audio manager
  const { default: AudioManager } = await import('./systems/AudioManager.js');
  const audioManager = new AudioManager();
  serviceLocator.register('audioManager', audioManager);
  Logger.info('Audio management system initialized', null, 'system');
  
  // Initialize mission system
  const { default: MissionManager } = await import('./missions/MissionManager.js');
  const missionManager = new MissionManager();
  serviceLocator.register('missionManager', missionManager);
  Logger.info('Mission management system initialized', null, 'system');
  
  // Set up event system listeners for integration
  // Link state changes to events
  stateManager.subscribe('energy', (newValue, oldValue) => {
    eventSystem.emit(GameEvents.ENERGY_CHANGE, { newValue, oldValue });
    if (newValue < configManager.get('player', 'startingEnergy') * 0.2) {
      eventSystem.emit(GameEvents.RESOURCE_LOW, { resource: 'energy', value: newValue });
    }
  });
  
  stateManager.subscribe('money', (newValue, oldValue) => {
    eventSystem.emit(GameEvents.MONEY_CHANGE, { newValue, oldValue });
  });
  
  stateManager.subscribe('currentState', (newValue, oldValue) => {
    if (newValue === 'playing' && oldValue !== 'playing') {
      eventSystem.emit(GameEvents.GAME_START);
    } else if (newValue === 'gameOver') {
      eventSystem.emit(GameEvents.GAME_OVER);
    }
  });
  
  // Set up input context switching based on game state
  stateManager.subscribe('isWalking', (isWalking) => {
    inputManager.setContext(isWalking ? 'astronaut' : 'ship');
  });
  
  Logger.info('Neptune Core Systems initialized successfully', null, 'system');
  console.log('Neptune Core Systems initialized successfully');
  
  return {
    serviceLocator,
    stateManager,
    entityManager,
    eventSystem,
    configManager,
    inputManager,
    audioManager,
    missionManager,
    logger: Logger
  };
}

/**
 * Global access for backward compatibility
 * This allows existing code to gradually migrate to the new system
 */
export function setupGlobalAccess(systems) {
  if (typeof window !== 'undefined') {
    window.Neptune = {
      ...systems,
      version: '2.0.0',
      initialized: true
    };
  }
  
  // Make core systems globally available for easy access
  globalThis.serviceLocator = systems.serviceLocator;
  globalThis.stateManager = systems.stateManager;
  globalThis.entityManager = systems.entityManager;
  globalThis.eventSystem = systems.eventSystem;
  globalThis.configManager = systems.configManager;
  globalThis.inputManager = systems.inputManager;
  globalThis.audioManager = systems.audioManager;
  globalThis.missionManager = systems.missionManager;
  globalThis.logger = systems.logger;
}

/**
 * Migration helpers for existing code
 */
export const MigrationHelpers = {
  /**
   * Migrate global variables to state manager
   */
  migrateGlobalState() {
    const globalVars = [
      'gameMode', 'energy', 'money', 'level', 'gameState', 'worldWidth',
      'cameraOffset', 'isWalking', 'atEarth', 'dayNightCycle', 'windAngle',
      'windForce', 'showLevelTransition', 'gameOverSoundPlayed'
    ];
    
    globalVars.forEach(varName => {
      if (typeof window[varName] !== 'undefined') {
        const stateKey = varName === 'gameState' ? 'currentState' : 
                         varName === 'gameMode' ? 'mode' : varName;
        globalThis.stateManager.set(stateKey, window[varName]);
      }
    });
  },
  
  /**
   * Migrate static collections to entity manager
   */
  migrateStaticCollections() {
    const collections = [
      { name: 'bullets', source: 'Bullet.activeObjects' },
      { name: 'aliens', source: 'Alien.aliens' },
      { name: 'hunters', source: 'Hunter.hunters' },
      { name: 'zappers', source: 'Zapper.zappers' },
      { name: 'destroyers', source: 'Destroyer.destroyers' },
      { name: 'worms', source: 'AlienWorm.worms' },
      { name: 'walkers', source: 'WalkerRobot.walkers' },
      { name: 'plants', source: 'AlienPlant.plants' },
      { name: 'nests', source: 'Nest.nests' },
      { name: 'bases', source: 'MoonBase.moonBases' }
    ];
    
    collections.forEach(({ name, source }) => {
      const [className, propName] = source.split('.');
      if (typeof window[className] !== 'undefined' && 
          Array.isArray(window[className][propName])) {
        
        window[className][propName].forEach(entity => {
          globalThis.entityManager.addEntity(name, entity);
        });
      }
    });
  }
};