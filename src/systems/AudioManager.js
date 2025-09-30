/**
 * Audio Management System
 * Enhanced audio system with spatial audio, music management, and sound pools
 */

import eventSystem, { GameEvents } from '../core/EventSystem.js';
import configManager from '../core/ConfigManager.js';
import stateManager from '../core/StateManager.js';

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.voiceGain = null;
    
    this.sounds = new Map();
    this.music = new Map();
    this.soundPools = new Map();
    
    this.currentMusic = null;
    this.musicFading = false;
    this.musicCrossfade = null;
    
    // Spatial audio
    this.listener = null;
    this.spatialSounds = new Map();
    
    // Sound categories for organization
    this.categories = {
      ui: { volume: 1.0, sounds: [] },
      weapon: { volume: 1.0, sounds: [] },
      engine: { volume: 0.8, sounds: [] },
      ambient: { volume: 0.6, sounds: [] },
      explosion: { volume: 1.2, sounds: [] },
      voice: { volume: 1.0, sounds: [] },
      music: { volume: 0.7, sounds: [] }
    };
    
    this.initialized = false;
    this.setupAudioContext();
    this.setupEventListeners();
  }
  
  async setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create gain nodes for volume control
      this.masterGain = this.audioContext.createGain();
      this.musicGain = this.audioContext.createGain();
      this.sfxGain = this.audioContext.createGain();
      this.voiceGain = this.audioContext.createGain();
      
      // Connect gain nodes
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.voiceGain.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      
      // Set up spatial audio listener
      if (this.audioContext.listener) {
        this.listener = this.audioContext.listener;
        this.listener.setPosition(0, 0, 0);
        this.listener.setOrientation(0, 0, -1, 0, 1, 0);
      }
      
      // Load initial volume settings
      this.updateVolumes();
      
      this.initialized = true;
      console.log('AudioManager initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
    }
  }
  
  setupEventListeners() {
    // Game events
    eventSystem.on(GameEvents.GAME_START, () => {
      this.playMusic('gameplay');
    });
    
    eventSystem.on(GameEvents.GAME_OVER, () => {
      this.playMusic('gameOver');
    });
    
    eventSystem.on('ship:landed', () => {
      this.play('shipLanding');
    });
    
    eventSystem.on('ship:takeoff', () => {
      this.play('shipTakeoff');
    });
    
    eventSystem.on(GameEvents.ENTITY_COLLISION, (data) => {
      if (data.bullet && data.target) {
        this.play('bulletHit');
      }
    });
    
    // Configuration changes
    eventSystem.on('config:changed', (data) => {
      if (data.category === 'audio') {
        this.updateVolumes();
      }
    });
    
    // Handle user interaction for audio context (required by browsers)
    document.addEventListener('click', () => this.resumeAudioContext(), { once: true });
    document.addEventListener('keydown', () => this.resumeAudioContext(), { once: true });
  }
  
  async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('Audio context resumed');
    }
  }
  
  updateVolumes() {
    if (!this.initialized) return;
    
    const audioConfig = configManager.get('audio');
    
    this.masterGain.gain.value = audioConfig.masterVolume;
    this.musicGain.gain.value = audioConfig.musicVolume;
    this.sfxGain.gain.value = audioConfig.sfxVolume;
    this.voiceGain.gain.value = audioConfig.voiceVolume;
  }
  
  /**
   * Load a sound file
   */
  async loadSound(name, url, category = 'sfx', options = {}) {
    if (!this.initialized) {
      console.warn('AudioManager not initialized');
      return null;
    }
    
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const soundData = {
        buffer: audioBuffer,
        category: category,
        volume: options.volume || 1.0,
        loop: options.loop || false,
        spatial: options.spatial || false,
        poolSize: options.poolSize || 0
      };
      
      this.sounds.set(name, soundData);
      
      // Add to category
      if (this.categories[category]) {
        this.categories[category].sounds.push(name);
      }
      
      // Create sound pool if requested
      if (options.poolSize > 0) {
        this.createSoundPool(name, options.poolSize);
      }
      
      console.log(`Loaded sound: ${name}`);
      return soundData;
      
    } catch (error) {
      console.error(`Failed to load sound ${name}:`, error);
      return null;
    }
  }
  
  /**
   * Create a pool of sound sources for frequently played sounds
   */
  createSoundPool(soundName, poolSize) {
    const soundData = this.sounds.get(soundName);
    if (!soundData) return;
    
    const pool = [];
    for (let i = 0; i < poolSize; i++) {
      pool.push({
        source: null,
        gain: null,
        panner: null,
        playing: false
      });
    }
    
    this.soundPools.set(soundName, pool);
  }
  
  /**
   * Get available sound source from pool
   */
  getPooledSource(soundName) {
    const pool = this.soundPools.get(soundName);
    if (!pool) return null;
    
    // Find available source
    for (const source of pool) {
      if (!source.playing) {
        return source;
      }
    }
    
    // If no available source, use the oldest one
    return pool[0];
  }
  
  /**
   * Play a sound effect
   */
  play(soundName, options = {}) {
    if (!this.initialized) return null;
    
    const soundData = this.sounds.get(soundName);
    if (!soundData) {
      console.warn(`Sound not found: ${soundName}`);
      return null;
    }
    
    // Try to use pooled source first
    let sourceData = this.getPooledSource(soundName);
    const usePool = sourceData !== null;
    
    if (!sourceData) {
      sourceData = {
        source: null,
        gain: null,
        panner: null,
        playing: false
      };
    }
    
    // Stop previous sound if using pooled source
    if (usePool && sourceData.playing) {
      this.stopSource(sourceData);
    }
    
    // Create audio nodes
    sourceData.source = this.audioContext.createBufferSource();
    sourceData.gain = this.audioContext.createGain();
    sourceData.source.buffer = soundData.buffer;
    
    // Set up audio graph
    let outputNode = sourceData.gain;
    
    // Spatial audio setup
    if (soundData.spatial && options.position) {
      sourceData.panner = this.audioContext.createPanner();
      sourceData.panner.panningModel = 'HRTF';
      sourceData.panner.distanceModel = 'inverse';
      sourceData.panner.refDistance = 100;
      sourceData.panner.maxDistance = 1000;
      sourceData.panner.rolloffFactor = 1;
      
      sourceData.panner.setPosition(
        options.position.x || 0,
        options.position.y || 0,
        options.position.z || 0
      );
      
      sourceData.source.connect(sourceData.panner);
      sourceData.panner.connect(sourceData.gain);
    } else {
      sourceData.source.connect(sourceData.gain);
    }
    
    // Set volume
    const categoryVolume = this.categories[soundData.category]?.volume || 1.0;
    const finalVolume = (options.volume || 1.0) * soundData.volume * categoryVolume;
    sourceData.gain.gain.value = finalVolume;
    
    // Connect to appropriate output
    if (soundData.category === 'music') {
      sourceData.gain.connect(this.musicGain);
    } else if (soundData.category === 'voice') {
      sourceData.gain.connect(this.voiceGain);
    } else {
      sourceData.gain.connect(this.sfxGain);
    }
    
    // Set loop
    sourceData.source.loop = options.loop || soundData.loop;
    
    // Play
    sourceData.source.start(options.when || 0);
    sourceData.playing = true;
    
    // Handle end of sound
    sourceData.source.onended = () => {
      sourceData.playing = false;
      if (sourceData.panner) {
        sourceData.panner.disconnect();
        sourceData.panner = null;
      }
      if (sourceData.gain) {
        sourceData.gain.disconnect();
        sourceData.gain = null;
      }
      sourceData.source = null;
    };
    
    // Store spatial sound reference
    if (soundData.spatial && options.trackingId) {
      this.spatialSounds.set(options.trackingId, sourceData);
    }
    
    return sourceData;
  }
  
  /**
   * Play spatial sound with 3D positioning
   */
  playSpatial(soundName, position, options = {}) {
    return this.play(soundName, {
      ...options,
      position: position,
      spatial: true
    });
  }
  
  /**
   * Update spatial sound position
   */
  updateSpatialSound(trackingId, position) {
    const sourceData = this.spatialSounds.get(trackingId);
    if (sourceData && sourceData.panner && sourceData.playing) {
      sourceData.panner.setPosition(position.x, position.y, position.z || 0);
    }
  }
  
  /**
   * Stop a sound source
   */
  stopSource(sourceData) {
    if (sourceData.source && sourceData.playing) {
      sourceData.source.stop();
      sourceData.playing = false;
    }
  }
  
  /**
   * Stop all sounds in a category
   */
  stopCategory(category) {
    const categoryData = this.categories[category];
    if (!categoryData) return;
    
    for (const soundName of categoryData.sounds) {
      const pool = this.soundPools.get(soundName);
      if (pool) {
        for (const sourceData of pool) {
          if (sourceData.playing) {
            this.stopSource(sourceData);
          }
        }
      }
    }
  }
  
  /**
   * Play music with crossfade
   */
  async playMusic(musicName, fadeTime = 2000) {
    if (this.currentMusic === musicName) return;
    
    const musicData = this.sounds.get(musicName);
    if (!musicData) {
      console.warn(`Music not found: ${musicName}`);
      return;
    }
    
    // Stop current music with fade
    if (this.currentMusic && !this.musicFading) {
      await this.fadeOutMusic(fadeTime / 2);
    }
    
    // Start new music
    const musicSource = this.play(musicName, {
      loop: true,
      volume: 0 // Start silent for fade in
    });
    
    if (musicSource) {
      this.currentMusic = musicName;
      this.musicCrossfade = musicSource;
      
      // Fade in
      await this.fadeInMusic(fadeTime / 2);
    }
  }
  
  /**
   * Fade out current music
   */
  async fadeOutMusic(duration = 2000) {
    if (!this.musicCrossfade || this.musicFading) return;
    
    this.musicFading = true;
    const startVolume = this.musicCrossfade.gain.gain.value;
    const fadeSteps = 60; // 60 steps for smooth fade
    const stepTime = duration / fadeSteps;
    const volumeStep = startVolume / fadeSteps;
    
    for (let i = 0; i < fadeSteps; i++) {
      const volume = startVolume - (volumeStep * i);
      this.musicCrossfade.gain.gain.value = Math.max(0, volume);
      await new Promise(resolve => setTimeout(resolve, stepTime));
    }
    
    this.stopSource(this.musicCrossfade);
    this.musicCrossfade = null;
    this.currentMusic = null;
    this.musicFading = false;
  }
  
  /**
   * Fade in music
   */
  async fadeInMusic(duration = 2000) {
    if (!this.musicCrossfade) return;
    
    const targetVolume = this.categories.music.volume || 0.7;
    const fadeSteps = 60;
    const stepTime = duration / fadeSteps;
    const volumeStep = targetVolume / fadeSteps;
    
    for (let i = 0; i < fadeSteps; i++) {
      const volume = volumeStep * i;
      this.musicCrossfade.gain.gain.value = Math.min(targetVolume, volume);
      await new Promise(resolve => setTimeout(resolve, stepTime));
    }
  }
  
  /**
   * Set category volume
   */
  setCategoryVolume(category, volume) {
    if (this.categories[category]) {
      this.categories[category].volume = volume;
      
      // Update currently playing sounds in this category
      const pool = this.soundPools.get(category);
      if (pool) {
        for (const sourceData of pool) {
          if (sourceData.playing && sourceData.gain) {
            const soundData = this.sounds.get(category);
            const finalVolume = volume * (soundData?.volume || 1.0);
            sourceData.gain.gain.value = finalVolume;
          }
        }
      }
    }
  }
  
  /**
   * Update listener position for spatial audio
   */
  updateListener(position, orientation = null) {
    if (!this.listener) return;
    
    this.listener.setPosition(position.x, position.y, position.z || 0);
    
    if (orientation) {
      this.listener.setOrientation(
        orientation.forward.x, orientation.forward.y, orientation.forward.z || 0,
        orientation.up.x, orientation.up.y, orientation.up.z || 1
      );
    }
  }
  
  /**
   * Create procedural sound effect
   */
  createProceduralSound(type, parameters = {}) {
    if (!this.initialized) return null;
    
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    oscillator.connect(gain);
    gain.connect(this.sfxGain);
    
    switch (type) {
      case 'explosion':
        oscillator.type = 'noise'; // Pink/white noise
        oscillator.frequency.value = 100;
        gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1);
        break;
        
      case 'laser':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        break;
        
      case 'powerup':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        break;
    }
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + (parameters.duration || 1));
    
    return { oscillator, gain };
  }
  
  /**
   * Get audio statistics
   */
  getStats() {
    const activeSounds = Array.from(this.spatialSounds.values()).filter(s => s.playing).length;
    const totalSounds = this.sounds.size;
    const loadedCategories = Object.keys(this.categories).filter(cat => 
      this.categories[cat].sounds.length > 0
    );
    
    return {
      initialized: this.initialized,
      totalSounds: totalSounds,
      activeSounds: activeSounds,
      currentMusic: this.currentMusic,
      categories: loadedCategories,
      audioContextState: this.audioContext?.state
    };
  }
  
  /**
   * Preload common game sounds
   */
  async preloadSounds() {
    const soundsToLoad = [
      { name: 'shoot', url: 'assets/sounds/shoot.mp3', category: 'weapon', poolSize: 10 },
      { name: 'explosion', url: 'assets/sounds/explosion.mp3', category: 'explosion', poolSize: 5 },
      { name: 'shipEngine', url: 'assets/sounds/engine.mp3', category: 'engine', loop: true },
      { name: 'bulletHit', url: 'assets/sounds/hit.mp3', category: 'weapon', poolSize: 8 },
      { name: 'shipLanding', url: 'assets/sounds/landing.mp3', category: 'engine' },
      { name: 'shipTakeoff', url: 'assets/sounds/takeoff.mp3', category: 'engine' },
      { name: 'menuMusic', url: 'assets/music/menu.mp3', category: 'music', loop: true },
      { name: 'gameplayMusic', url: 'assets/music/gameplay.mp3', category: 'music', loop: true },
      { name: 'gameOverMusic', url: 'assets/music/gameover.mp3', category: 'music', loop: true }
    ];
    
    const loadPromises = soundsToLoad.map(sound => 
      this.loadSound(sound.name, sound.url, sound.category, sound)
    );
    
    try {
      await Promise.all(loadPromises);
      console.log('All sounds preloaded successfully');
    } catch (error) {
      console.error('Error preloading sounds:', error);
    }
  }
}

export default AudioManager;