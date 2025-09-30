/**
 * Input Management System
 * Handles keyboard, mouse, and gamepad input with proper event distribution
 */

import eventSystem, { GameEvents } from '../core/EventSystem.js';
import configManager from '../core/ConfigManager.js';
import stateManager from '../core/StateManager.js';

class InputManager {
  constructor() {
    this.keys = new Map();
    this.mouse = {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      buttons: new Map(),
      wheel: 0
    };
    
    this.gamepad = {
      connected: false,
      index: -1,
      buttons: new Map(),
      axes: []
    };
    
    this.inputBindings = new Map();
    this.actionStates = new Map();
    
    // Input context system
    this.contexts = new Map();
    this.activeContext = 'default';
    
    this.setupDefaultBindings();
    this.setupEventListeners();
  }
  
  setupDefaultBindings() {
    // Default key bindings for different contexts
    this.setContext('ship', {
      // Ship movement
      'thrust': ['KeyW', 'ArrowUp'],
      'turnLeft': ['KeyA', 'ArrowLeft'],
      'turnRight': ['KeyD', 'ArrowRight'],
      'shoot': ['Space'],
      'switchMode': ['KeyE'],
      'brake': ['KeyS', 'ArrowDown'],
      
      // UI
      'pause': ['KeyP', 'Escape'],
      'menu': ['KeyM'],
      'debug': ['KeyF1'],
      'save': ['KeyF5'],
      'load': ['KeyF6']
    });
    
    this.setContext('astronaut', {
      // Astronaut movement
      'walkLeft': ['KeyA', 'ArrowLeft'],
      'walkRight': ['KeyD', 'ArrowRight'],
      'jump': ['Space', 'KeyW', 'ArrowUp'],
      'jetpack': ['KeyF'],
      'switchMode': ['KeyE'],
      'interact': ['KeyR'],
      'mount': ['KeyQ'],
      
      // UI (same as ship)
      'pause': ['KeyP', 'Escape'],
      'menu': ['KeyM'],
      'debug': ['KeyF1'],
      'save': ['KeyF5'],
      'load': ['KeyF6']
    });
    
    this.setContext('walker', {
      // Walker robot controls
      'walkLeft': ['KeyA', 'ArrowLeft'],  
      'walkRight': ['KeyD', 'ArrowRight'],
      'shoot': ['Space'],
      'switchWeapon': ['KeyF'],
      'dismount': ['KeyE'],
      'burst': ['KeyQ'],
      
      // UI
      'pause': ['KeyP', 'Escape'],
      'menu': ['KeyM'],
      'debug': ['KeyF1']
    });
    
    this.setContext('menu', {
      'up': ['ArrowUp', 'KeyW'],
      'down': ['ArrowDown', 'KeyS'],
      'left': ['ArrowLeft', 'KeyA'],
      'right': ['ArrowRight', 'KeyD'],
      'select': ['Space', 'Enter'],
      'back': ['Escape', 'KeyB'],
      'close': ['Escape']
    });
    
    // Set default context
    this.activeContext = 'ship';
  }
  
  setupEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    // Mouse events
    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('wheel', (e) => this.handleWheel(e));
    
    // Gamepad events
    window.addEventListener('gamepadconnected', (e) => this.handleGamepadConnected(e));
    window.addEventListener('gamepaddisconnected', (e) => this.handleGamepadDisconnected(e));
    
    // Prevent default browser shortcuts
    document.addEventListener('keydown', (e) => {
      // Prevent F5 refresh, F12 devtools, etc. during gameplay
      if (stateManager.get('currentState') === 'playing') {
        if (['F5', 'F6', 'F12'].includes(e.code)) {
          e.preventDefault();
        }
      }
    });
  }
  
  handleKeyDown(e) {
    const code = e.code;
    
    if (!this.keys.get(code)) {
      this.keys.set(code, {
        pressed: true,
        justPressed: true,
        timestamp: Date.now()
      });
      
      this.processAction(code, true);
      
      eventSystem.emit('input:keydown', { code, key: e.key, event: e });
    }
  }
  
  handleKeyUp(e) {
    const code = e.code;
    const keyState = this.keys.get(code);
    
    if (keyState) {
      keyState.pressed = false;
      keyState.justReleased = true;
      keyState.releaseDuration = Date.now() - keyState.timestamp;
      
      this.processAction(code, false);
      
      eventSystem.emit('input:keyup', { code, key: e.key, duration: keyState.releaseDuration, event: e });
    }
  }
  
  handleMouseDown(e) {
    this.mouse.buttons.set(e.button, {
      pressed: true,
      justPressed: true,
      timestamp: Date.now()
    });
    
    this.updateMouseWorldPosition();
    
    eventSystem.emit('input:mousedown', {
      button: e.button,
      x: this.mouse.x,
      y: this.mouse.y,
      worldX: this.mouse.worldX,
      worldY: this.mouse.worldY,
      event: e
    });
  }
  
  handleMouseUp(e) {
    const buttonState = this.mouse.buttons.get(e.button);
    
    if (buttonState) {
      buttonState.pressed = false;
      buttonState.justReleased = true;
      buttonState.releaseDuration = Date.now() - buttonState.timestamp;
      
      this.updateMouseWorldPosition();
      
      eventSystem.emit('input:mouseup', {
        button: e.button,
        x: this.mouse.x,
        y: this.mouse.y,
        worldX: this.mouse.worldX,
        worldY: this.mouse.worldY,
        duration: buttonState.releaseDuration,
        event: e
      });
    }
  }
  
  handleMouseMove(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.updateMouseWorldPosition();
    
    eventSystem.emit('input:mousemove', {
      x: this.mouse.x,
      y: this.mouse.y,
      worldX: this.mouse.worldX,
      worldY: this.mouse.worldY,
      event: e
    });
  }
  
  handleWheel(e) {
    this.mouse.wheel = e.deltaY;
    
    eventSystem.emit('input:wheel', {
      delta: e.deltaY,
      x: this.mouse.x,
      y: this.mouse.y,
      event: e
    });
  }
  
  handleGamepadConnected(e) {
    this.gamepad.connected = true;
    this.gamepad.index = e.gamepad.index;
    
    console.log(`Gamepad connected: ${e.gamepad.id}`);
    eventSystem.emit('input:gamepadConnected', { gamepad: e.gamepad });
  }
  
  handleGamepadDisconnected(e) {
    this.gamepad.connected = false;
    this.gamepad.index = -1;
    
    console.log('Gamepad disconnected');
    eventSystem.emit('input:gamepadDisconnected', { gamepad: e.gamepad });
  }
  
  updateMouseWorldPosition() {
    const cameraOffset = stateManager.get('cameraOffset') || 0;
    this.mouse.worldX = this.mouse.x + cameraOffset;
    this.mouse.worldY = this.mouse.y;
  }
  
  processAction(inputCode, pressed) {
    const context = this.contexts.get(this.activeContext);
    if (!context) return;
    
    // Find actions bound to this input
    for (const [action, bindings] of Object.entries(context)) {
      if (bindings.includes(inputCode)) {
        this.setActionState(action, pressed);
        break;
      }
    }
  }
  
  setActionState(action, active) {
    const oldState = this.actionStates.get(action) || false;
    this.actionStates.set(action, active);
    
    if (oldState !== active) {
      eventSystem.emit('input:action', {
        action,
        active,
        context: this.activeContext
      });
      
      // Emit specific action events
      if (active) {
        eventSystem.emit(`input:${action}:start`);
      } else {
        eventSystem.emit(`input:${action}:end`);
      }
    }
  }
  
  update() {
    // Update gamepad state
    this.updateGamepad();
    
    // Clear just pressed/released flags
    this.clearTransientStates();
  }
  
  updateGamepad() {
    if (!this.gamepad.connected) return;
    
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[this.gamepad.index];
    
    if (!gamepad) return;
    
    // Update button states
    for (let i = 0; i < gamepad.buttons.length; i++) {
      const button = gamepad.buttons[i];
      const oldState = this.gamepad.buttons.get(i);
      
      if (!oldState) {
        this.gamepad.buttons.set(i, {
          pressed: button.pressed,
          justPressed: button.pressed,
          value: button.value
        });
      } else {
        oldState.justPressed = button.pressed && !oldState.pressed;
        oldState.justReleased = !button.pressed && oldState.pressed;
        oldState.pressed = button.pressed;
        oldState.value = button.value;
      }
      
      // Process gamepad actions
      this.processGamepadAction(i, button.pressed);
    }
    
    // Update axes
    this.gamepad.axes = Array.from(gamepad.axes);
  }
  
  processGamepadAction(buttonIndex, pressed) {
    // Map gamepad buttons to actions based on context
    const gamepadMappings = {
      0: 'select', // A button
      1: 'back',   // B button
      2: 'jump',   // X button
      3: 'shoot',  // Y button
      4: 'turnLeft', // Left bumper
      5: 'turnRight', // Right bumper
      9: 'pause',  // Start button
      12: 'up',    // D-pad up
      13: 'down',  // D-pad down
      14: 'left',  // D-pad left
      15: 'right'  // D-pad right
    };
    
    const action = gamepadMappings[buttonIndex];
    if (action) {
      this.setActionState(action, pressed);
    }
  }
  
  clearTransientStates() {
    // Clear just pressed/released flags for keys
    for (const [code, state] of this.keys.entries()) {
      state.justPressed = false;
      state.justReleased = false;
    }
    
    // Clear just pressed/released flags for mouse
    for (const [button, state] of this.mouse.buttons.entries()) {
      state.justPressed = false;
      state.justReleased = false;
    }
    
    // Clear just pressed/released flags for gamepad
    for (const [button, state] of this.gamepad.buttons.entries()) {
      state.justPressed = false;
      state.justReleased = false;
    }
    
    // Reset mouse wheel
    this.mouse.wheel = 0;
  }
  
  // Public API methods
  
  isKeyPressed(code) {
    const state = this.keys.get(code);
    return state ? state.pressed : false;
  }
  
  isKeyJustPressed(code) {
    const state = this.keys.get(code);
    return state ? state.justPressed : false;
  }
  
  isKeyJustReleased(code) {
    const state = this.keys.get(code);
    return state ? state.justReleased : false;
  }
  
  isActionActive(action) {
    return this.actionStates.get(action) || false;
  }
  
  isMousePressed(button = 0) {
    const state = this.mouse.buttons.get(button);
    return state ? state.pressed : false;
  }
  
  isMouseJustPressed(button = 0) {
    const state = this.mouse.buttons.get(button);
    return state ? state.justPressed : false;
  }
  
  getMousePosition() {
    return { x: this.mouse.x, y: this.mouse.y };
  }
  
  getMouseWorldPosition() {
    return { x: this.mouse.worldX, y: this.mouse.worldY };
  }
  
  getGamepadAxes() {
    return [...this.gamepad.axes];
  }
  
  isGamepadButtonPressed(button) {
    const state = this.gamepad.buttons.get(button);
    return state ? state.pressed : false;
  }
  
  setContext(name, bindings = null) {
    if (bindings) {
      this.contexts.set(name, bindings);
    }
    this.activeContext = name;
    
    // Clear action states when switching context
    this.actionStates.clear();
    
    eventSystem.emit('input:contextChanged', { context: name });
  }
  
  getActiveContext() {
    return this.activeContext;
  }
  
  bindAction(action, keys, context = null) {
    const targetContext = context || this.activeContext;
    const contextBindings = this.contexts.get(targetContext) || {};
    
    contextBindings[action] = Array.isArray(keys) ? keys : [keys];
    this.contexts.set(targetContext, contextBindings);
  }
  
  unbindAction(action, context = null) {
    const targetContext = context || this.activeContext;
    const contextBindings = this.contexts.get(targetContext);
    
    if (contextBindings && contextBindings[action]) {
      delete contextBindings[action];
    }
  }
  
  getBindings(context = null) {
    const targetContext = context || this.activeContext;
    const bindings = this.contexts.get(targetContext);
    return bindings ? { ...bindings } : {};
  }
  
  // Configuration
  setSensitivity(sensitivity) {
    configManager.update('input', { mouseSensitivity: sensitivity });
  }
  
  getSensitivity() {
    return configManager.get('input', 'mouseSensitivity') || 1.0;
  }
  
  // Debug information
  getDebugInfo() {
    return {
      activeContext: this.activeContext,
      pressedKeys: Array.from(this.keys.entries()).filter(([_, state]) => state.pressed).map(([code, _]) => code),
      activeActions: Array.from(this.actionStates.entries()).filter(([_, active]) => active).map(([action, _]) => action),
      mousePosition: { x: this.mouse.x, y: this.mouse.y },
      mouseWorldPosition: { x: this.mouse.worldX, y: this.mouse.worldY },
      gamepadConnected: this.gamepad.connected
    };
  }
}

export default InputManager;