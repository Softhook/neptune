/*
Neptune

Christian Nold & Sebastian Nold Boraschi 2024
with Claude 3.5 Sonnet 

Version 67 Planetary Methane, Magentic Storms and Walker Robots

*/



//let debug = false;

let gameMode = 'singlePlayer'; // 'singlePlayer' or 'twoPlayer'
let alienEnergy = 10000;

let font;
let wingman;

let atEarth = false;

// Global variables
let ship;
let pod;
let moonBase;
let gravity;
let baseEnergy = 10000;
let maxEnergy = 15000;
let energy;
let money;
let gameState;
let moonSurface;
let cameraOffset = 0;
let worldWidth = 6000;
let astronaut;
let isWalking = false;
let astronautSprite;
let level = 1;
let explosions = [];
let wind;
let windAngle;
let windForce = 0;
let maxWindForce = 0.01; // Maximum wind force
let backgroundStars = [];

let shootingStars = [];
let shootingStarFrequency = 0.0001;





let showLevelTransition = false;
let soundManager;
let gameOverSoundPlayed = false;
let windSound;

let viewLeft, viewRight, viewTop, viewBottom;

let loadingProgress = 0;
let totalAssets = 0;
let loadedAssets = 0;

let skyColors;
let dayNightCycle = 0; // 0 to 1, representing the full cycle
const DAWN = [255, 200, 100];
const DAY = [135, 206, 235];
const DUSK = [255, 100, 100];
const NIGHT = [0, 0, 0];
const TWO_PI = Math.PI * 2;
const CYCLE_SPEED = 0.00002;
// Moon surface color constants
const MOON_SURFACE_DAY = [0, 0, 255];   
const MOON_SURFACE_NIGHT = [0, 0, 50];  

let surfaceRemadeAfterFullScreen = false;

let frameRates = [];
let lastFPSUpdateTime = 0;
const FPS_UPDATE_INTERVAL = 1000; // Update FPS every 1 second
let avgFPS =0;

let activeMissile = null;
let cameraFollowsMissile = false;
let upgrades, upgradeMenu;
let debug;

let ambientMusic;
let introMusic = true;
let earthquakeManager;
let magneticStorm;
let methaneBlizzard;

let alienKing = null;

let profilerSeq;


function setup() {
  createCanvas(1200, 800);
  windSound = new WindSoundGenerator();
  createBackgroundGraphics();
  debug  = Debug.getInstance();
  gameState = 'loading';
  skyColors = [NIGHT, DAWN, DAY, DUSK, NIGHT].map(c => color(...c)); // Precompute color arrays for faster interpolation
  
    upgrades = new Upgrades();
  upgradeMenu = new UpgradeMenu(upgrades);
  earthquakeManager = new EarthquakeManager();
  methaneBlizzard = new MethaneBlizzard();
  
  
    alienQueen = AlienQueen.create();
    alienKing = AlienKing.create();
  
  //profilerSeq = new ProfilerSequential(100);
 //profilerSeq.addFunction('Original drawWindLines', drawWindLines);
  //profilerSeq.addFunction('Optimized drawWindLines', drawWindLinesOptimized);
  


  
  announcer = new Announcement();
  
  // Set properties if needed
  //announcer.setVolume(1);
  //announcer.setRate(1);
  //announcer.setPitch(1.0);
  
  ambientMusic = new AmbientMusicGenerator();
  magneticStorm = new MagneticStorm();

  
  generateMoonSurface();
}

function draw() {
  GameTimer.update();
  
  
  
  switch(gameState) {
    case 'loading':
      displayLoadingScreen();
      break;
    case 'title':
      displayTitleScreen();
      break;
    case 'start':
      displayStartScreen();
      break;
    case 'playing':
      updateGame();
      drawGame();
      break;
    case 'gameOver':
      displayGameOver();
      break;
    case 'victory':
      victory();
      break;
    case 'error':
      displayErrorScreen();
      break;
      
 
  }
  
  //announcer.update(); //every loop update needed for delayed annoucments

}

function averageFPS() {
  if (!debug.isEnabled) return 0; // Return 0 if debug is not enabled
  
  frameRates.push(frameRate());  // Always push the current frame rate
  if (millis() - lastFPSUpdateTime > FPS_UPDATE_INTERVAL) { // Time to update average?
    if (frameRates.length > 0) {
      let sum = frameRates.reduce((a, b) => a + b, 0);
      avgFPS = sum / frameRates.length;
      frameRates = []; // Reset the array for the next interval
    }
    lastFPSUpdateTime = millis();
  }
  return avgFPS;
}

function getTimeOfDay() {
  const cyclePosition = dayNightCycle * 4; // Multiply by 4 because we have 4 phases
  
  if (cyclePosition < 1) {
    return "NIGHT";
  } else if (cyclePosition < 2) {
    return "DAWN";
  } else if (cyclePosition < 3) {
    return "DAY";
  } else {
    return "DUSK";
  }
}

function displayLoadingScreen() {
  background(0);
  fill(255);
  
  
  push();
  imageMode(CENTER);
  translate(1500, 0); // Translate to the top-right corner
  rotate(frameCount * 0.0005); // Slow rotation
  image(neptuneImage, 0, 0); // Draw the image at the rotation center
  pop();
  
  textAlign(CENTER, CENTER);
  textFont(font);
  textSize(50);
  text('Loading...', width / 2, height / 2 - 50);
  
  // Draw loading bar
  let barWidth = width * 0.6;
  let barHeight = 20;
  noFill();
  stroke(255);
  rect(width / 2 - barWidth / 2, height / 2, barWidth, barHeight);
  fill(255);
  noStroke();
  rect(width / 2 - barWidth / 2, height / 2, barWidth * loadingProgress, barHeight);
  
  if (loadingProgress >= 1) {
    gameState = 'title';
  }
}

function displayErrorScreen() {
  background(0);
  fill(255, 0, 0);
  textAlign(CENTER, CENTER);
  textSize(32);
  text('An error occurred', width / 2, height / 2 - 50);
  textSize(16);
  text('Press any key to restart', width / 2, height / 2 + 50);
}


window.onerror = function(message, source, lineno, colno, error) { // Global error handler
  debug.error("Unhandled error:", error);
  gameState = 'error';
  alert("An unexpected error occurred. The game will restart.");
  resetGame();
  return true;
};

function preload() {
  font = loadFont('assets/Neptune.otf');
  neptuneImage = loadImage('assets/neptune.jpg');
  earthImage = loadImage('assets/earth.png');
  soundManager = new SoundManager();
  totalAssets = soundManager.getTotalAssets();
  soundManager.preloadWithCallback(assetLoaded);
}

function assetLoaded() {
  loadedAssets++;
  loadingProgress = loadedAssets / totalAssets;
}

function isInView(pos, size) {
  return pos.x + size > viewLeft && 
         pos.x - size < viewRight &&
         pos.y + size > viewTop && 
         pos.y - size < viewBottom;
}

function updateViewBoundaries() {
  viewLeft = cameraOffset;
  viewRight = cameraOffset + width;
  viewTop = 0;
  viewBottom = height;
}


function drawSurface(){

  
  // Draw moon surface
  const surfaceColor = getMoonSurfaceColor();
  fill(surfaceColor);
  beginShape();
  vertex(0, height); //enclose shape bottom left
  for (let point of moonSurface) {
    vertex(point.x, point.y);
  }
  vertex(worldWidth, height); //enclose shape bottom right
  endShape();

}

function drawClusterOverlays() {
  noStroke();
  for (let center of AlienPlant.clusterCenters) {
    let clusterRadius = 100; // Adjust this value based on your desired cluster size
    let alpha = map(sin(dayNightCycle * TWO_PI), -1, 1, 100, 100); // Vary transparency with day/night cycle
    
    // Create a gradient effect
    for (let r = clusterRadius; r > 0; r -= 10) {
      let interAlpha = map(r, 0, clusterRadius, alpha, 0);
      fill(red(center.color), green(center.color), blue(center.color), interAlpha);
      
      beginShape();
      for (let a = 0; a < TWO_PI; a += 0.1) {
        let x = center.x + cos(a) * r;
        let y = getSurfaceYAtX(x) - sin(a) * r * 0.5; // Flatten the bottom of the shape
        vertex(x, y);
      }
      endShape(CLOSE);
    }
  }
}


function drawGame() {
  
  push();
  
  let cameraShake = earthquakeManager.getCameraShake();
  translate(-cameraOffset + cameraShake.x, cameraShake.y);
  
  drawBackground();
  
  magneticStorm.draw();
  
  
  drawSurface(); 
  drawClusterOverlays();

  
  RuinedBase.drawAll();
  RuinedShip.drawAll();
  

  
  
  if (cameraFollowsMissile) {
  cameraOffset = constrain(activeMissile.pos.x - width / 2, 0, worldWidth - width);
} else if (!isWalking) {
  cameraOffset = constrain(ship.pos.x - width / 2, 0, worldWidth - width);

} else {
  cameraOffset = constrain(astronaut.pos.x - width / 2, 0, worldWidth - width);
}
  
  
    MoonBase.drawAll();
  
  for (let turret of turrets) {
    if (isInView(turret.pos, turret.size)) {
      turret.draw();
    }
  }
  
  AlienPlant.drawPlants();
  Nest.drawNests();
  
  alienQueen.draw();
  
  if (alienKing) {
    alienKing.draw();
  }
  
  Particle.drawParticles();
  Alien.drawAliens();
  Zapper.drawZappers();
  Destroyer.drawDestroyers();
  Hunter.drawHunters();
  AlienWorm.drawWorms();
  
  DrillRig.drawRigs();
  Bullet.drawBullets();
  Shield.drawShields(); 

  pod.draw();  
  ship.draw(); 
  astronaut.draw();
  
 Wingman.drawWingmen();
  WalkerRobot.drawWalkers();
  
  Meteor.drawMeteors();
  DiamondRain.drawDiamonds();
  Missile.drawMissile();

  for (let bomb of bombs) {
      bomb.draw();
  }
  
  for (let explosion of explosions) {
      explosion.draw();
  }
  

  MissionControl.draw();
  methaneBlizzard.draw();


  
  pop();
  
  drawHUD();
  drawPodIndicator();
  displayLevelTransition();
  
  upgradeMenu.draw();  
}

function updateGame() {
   
  if (upgradeMenu.isOpen) {    
    return; // If the upgrade menu is open, don't update the game state
  }
  
  Meteor.updateMeteors();
  DiamondRain.updateDiamonds();
  Missile.updateMissile();
  RuinedBase.updatePositions();
  
  windSound.setWindForce(windForce);
  
  if (showLevelTransition) {
      levelTransitionTimer--;
    } else {
    if (levelTransitionTimer <= 0) {
      showLevelTransition = false;
    }
  }
  
  
  
  if (!isWalking) {
    ship.update();
  } else {
    astronaut.update();
  }
  
  
  
  updateViewBoundaries();
  
  Zapper.updateZappers();
  Destroyer.updateDestroyers();
  Hunter.updateHunters();
  moonBase.update(); /////????
  Shield.updateShields();
  Alien.updateAliens();
  AlienWorm.updateWorms();
  AlienPlant.update();
  
  Nest.updateNests();
  MoonBase.updateAll();
  Turret.updateTurrets();
  Bullet.updateBullets();
  Bomb.updateBombs();
  Particle.updateParticles();
  RuinedShip.updatePositions();
  WalkerRobot.updateWalkers();
  
  DrillRig.updateRigs();
  
  if (energy <= 0) {
    gameState = 'gameOver';
    debug.log("Player died");
    GameTimer.clearAllTimers();
  }
  
  Wingman.updateWingmen();

    if (!MissionControl.currentMission && random() < 0.00005) { // Adjust probability as needed
    MissionControl.startRandomMission();
  }

  
  MissionControl.update();
  magneticStorm.update();


  
 

  if (Alien.aliens.length <= 1 && !alienKing.hasDied) {
    startNewLevel();   // If all Aliens are destroyed and its not the end of the game
  }
  

  alienQueen.update();
  
  if (alienKing) {
    alienKing.update();
  }
  
  earthquakeManager.update();
  methaneBlizzard.update();
  
  if (frameCount % 60 === 0) {
    updateEnergyFactorBasedOnAliens();
}

}

function drawPodIndicator() {
  if (!pod) return;

  let podScreenPos = createVector(pod.pos.x - cameraOffset, pod.pos.y);
  let playerPos = isWalking ? astronaut.pos : ship.pos;
  let playerScreenPos = createVector(playerPos.x - cameraOffset, playerPos.y);

  // Check if pod is off-screen
  if (podScreenPos.x < 0 || podScreenPos.x > width || podScreenPos.y < 0 || podScreenPos.y > height) {
    let angle = atan2(podScreenPos.y - playerScreenPos.y, podScreenPos.x - playerScreenPos.x);
    
    // Calculate indicator position at screen edge
    let indicatorPos = createVector(
      constrain(playerScreenPos.x + cos(angle) * width, 20, width - 20),
      constrain(playerScreenPos.y + sin(angle) * height, 20, height - 20)
    );

    push();
    translate(indicatorPos.x, indicatorPos.y);
    rotate(angle);
    fill(255, 0, 0);
    noStroke();
    triangle(-10, -5, 10, 0, -10, 5);
    pop();
  }
}

function updateEnergyFactorBasedOnAliens() {
    const percentageRemaining = (Alien.aliens.length / Alien.MAX_ALIENS) * 100;
  
    let minFactor = 0.5; //
    let maxFactor = 6;
    let energyFactor = minFactor + (percentageRemaining / 100) * (maxFactor - minFactor);
  
    energyFactor = Math.max(minFactor, Math.min(maxFactor, energyFactor));
  ambientMusic.setEnergyFactor(energyFactor);
}




function getTotalAlienCount() {
  return Alien.aliens.length +
         Hunter.hunters.length +
         Zapper.zappers.length +
         Destroyer.destroyers.length;
}


// Function to log active timers
function logActiveTimers() {
  const activeTimers = GameTimer.getActiveTimers();
  console.log(`Number of Active Timers: ${activeTimers.length}`);
  activeTimers.forEach(timer => {
    console.log(`Timer Key: ${timer.key}, Delay: ${timer.delay}, Time Remaining: ${Math.round(timer.timeRemaining)}`);
  });
}

function resetGame() {
  if (loadingProgress < 1) {
    console.error("Assets not fully loaded");
    gameState = 'loading';
    return;
  }
  
  // Reset announcer
  //announcer.dispose();
  announcer.initialize();
  
  GameTimer.clearAllTimers();
  initializeNarrativeSystem();


  

  // Reset game state
  level = 1;
  energy = baseEnergy;
  money = 0;
  gameState = 'playing';
  cameraOffset = 0;
  isWalking = false;
  dayNightCycle = 0;
  alienEnergy = 10000;
  showLevelTransition = false;
  levelTransitionTimer = 0;
  gameOverSoundPlayed = false;
  cameraFollowsMissile = false;

  // Reset entities

  astronaut = new Astronaut(createVector(0, 0), 20);
  ship = new Ship(createVector(width / 2, height / 2), createVector(0, 0), 20);
  ship.isMainShip = true; // Identify this as the player's ship
  
  Wingman.resetWingmen();
  
  gravity = createVector(0, 0.02);
  pod = null;
  Alien.aliens = [];
  Hunter.hunters = [];
  Zapper.zappers = [];
  Destroyer.destroyers = [];
  Nest.nests = [];
  MoonBase.moonBases = [];
  turrets = [];
  //Shield.shields = [];
  AlienPlant.plants = [];
  AlienWorm.worms = [];
  Meteor.meteors = [];
  DiamondRain.diamonds = [];
  bombs = [];
  explosions = [];
  alienQueen.reset();
  
  // Reset object pools
  Bullet.pool = [];
  Bullet.activeObjects = [];
  Particle.pool = [];
  Particle.activeParticles = [];

  // Reset static properties
  Alien.totalAliens = 0;
  Alien.currentAlienCount = 0;
  Alien.lastAttackAnnouncementTime = 0;
  MoonBase.totalBases = 0;
  MoonBase.resetBases();
  Meteor.meteorShowerActive = false;
  Meteor.meteorShowerDuration = 0;
  Meteor.meteorShowerCooldown = floor(random(7200, 21600));
  DiamondRain.isActive = false;
  DiamondRain.duration = 0;
  DiamondRain.cooldown = floor(random(3600, 7200));
  AlienPlant.clusterCenters = [];
  AlienPlant.lastSpawnTime = 0;
  Bullet.damageMultiplier = 1;
  Bomb.defaultExplosionRadius = 30;
  Bomb.defaultBombDamage = 3;
  Turret.defaultHealth = 4;
  Turret.defaultRange = 200;
  Shield.MAX_SHIELDS = 3;
  Wingman.MAX_WINGMEN = 1;
  MoonBase.maxBalloons = 0;
  Missile.lastLaunchTime = 0;
  Missile.lastAnnouncementTime = 0;
  Missile.defaultExplosionRadius = 100;
  Missile.defaultDamage = 5;

  MissionControl.resetAllMissions();

  earthquakeManager = new EarthquakeManager();


    // Start sequential profiling
  //profilerSeq.startProfiling();
  
  // Reset upgrades
  upgrades.reset();
  upgradeMenu.refresh();
  


  // Reinitialize game elements
  initializeWind();
  createMoonBase();
  ship.placeOnMoonBase();
  AlienPlant.createNewCluster();
  AlienPlant.spawnNewPlant();
  placePodOnSurface();
  WalkerRobot.resetWalkers();

  // Reset audio systems
  soundManager.reset();
  windSound.stop();
  windSound.start();
  
  if (introMusic == false){
  ambientMusic.reset();
  ambientMusic.start();
}else{
  introMusic = false;
}

  // Reset background elements
  backgroundStars = [];
  createBackgroundGraphics();

  // Reset performance monitoring
  frameRates = [];
  lastFPSUpdateTime = 0;
  avgFPS = 0;


  // Spawn initial game entities
  if (gameMode === 'twoPlayer') {
    Alien.createAliens(6);
    Nest.createNests(1);
    announcer.speak(`This is two player mode Human versus Alien. One of you is the Alien player and can spawn when they have enough Alien energy.`,0, 2, 2000);
  } else {
    Alien.createAliens(6);
    Nest.createNests(1);
    announcer.speak(`Welcome to ${getTimeOfDay()} on Neptune Commander. Good hunting!`,0, 2, 2000);
  }

  // Force garbage collection if available
  if (window.gc) {
    window.gc();
  }

  NoFlyZoneMission.resetMission();
  //console.log("Game fully reset");
  


}


function displayTitleScreen() {
  background(0);
  
  // Slowly rotating planet image
  push();
  
  imageMode(CENTER);
  translate(1500, 0); // Translate to the top-right corner
  rotate(frameCount * 0.0005); // Slow rotation
  image(neptuneImage, 0, 0); // Draw the image at the rotation center
  pop();

  textAlign(CENTER, CENTER);
  textFont(font);
  textSize(180);
  
  // Slowly changing random colors
  let r = sin(frameCount * 0.02) * 127 + 180;
  let g = sin(frameCount * 0.03) * 127 + 180;
  let b = sin(frameCount * 0.01) * 127 + 180;
  fill(r, g, b);
  text("neptune", width / 2, height / 2);
  
  fill(255);
  text("NEPTUNE", width / 2, height / 2);
  
    textSize(25);
  text("CHRISTIAN NOLD + SEBASTIAN NOLD BORASCHI", width / 2, height / 2 + 120);
  textSize(12);
  text("Version 67 - Planetary Methane, Magentic Storms and Walker Robots", width / 2, height / 2 + 160);
  
  let pulseOpacity = sin(frameCount * 0.05) * 127 + 128; // Value between 1 and 255 
  textSize(20);
  fill(255, pulseOpacity);
  text("PRESS ENTER", width / 2, height / 2 + 220);
}

function displayStartScreen() {
  background(0);
  
  push();
  imageMode(CENTER);
  translate(1500, 0); // Translate to the top-right corner
  rotate(frameCount * 0.0005); // Slow rotation
  image(neptuneImage, 0, 0); // Draw the image at the rotation center
  pop();
  
  textAlign(CENTER, CENTER);
  textFont(font);
  textSize(80);
  
    // Slowly changing random colors
  let r = sin(frameCount * 0.02) * 127 + 180;
  let g = sin(frameCount * 0.03) * 127 + 180;
  let b = sin(frameCount * 0.01) * 127 + 180;
  
  fill(r, g, b);
  text("neptune", width / 2, height / 4- 170);
  fill(255);
  text("NEPTUNE", width / 2, height / 4- 170);
  
  
  //text("NeptuNe", width / 2, height / 3- 150);
  textSize(30);
  let pulseOpacity = sin(frameCount * 0.005) * 127 + 128; // Value between 1 and 255
  //fill(255,0,0);
  fill(255,pulseOpacity,pulseOpacity);
  text("PRESS 1 FOR SOLO OR 2 FOR HUMAN vs. ALIEN PLAYER", width / 2, height / 4 - 80);
  
  fill(255);
  textSize(16);
  let instructions = [
"Objective:",
"DESTROY THE ALIEN ECOSYSTEM AND BRING RED HYRODOGEN PODS TO YOUR BASE.",
"",
"SHIP CONTROLS:",
"LEFT - RIGHT ARROW KEYS: STEER SHIP",
"UP ARROW: SHIP THRUST",
"SPACE BAR: SHOOT",
"DOWN ARROW: DROP BOMB",
"A: TOGGLE PARACHUTE", 
"",
"ASTRONAUT CONTROLS",
"LEFT - RIGHT ARROW KEYS: WALK",
"UP - DOWN ARROW KEYS: TARGETING",
"SPACE BAR: THROW BOMB - HOLD FOR LONGER THROW",
"Z: JUMP",
"T: PLACE TURRET",
"S: PLACE SHIELD",
"R: PLACE DRILL RIG (IN HYDROGEN ZONES)",
"E: LAUNCH WALKER ROBOT",
"",
"Q: LAUNCH WINGMAN DRONE",
"W: LAUNCH GUIDED MISSILE",
"X: ENTER OR EXIT - SHIP OR WALKER ROBOT",
"D: DEPLOY BASE",
"U: BUY UPGRADES",
"F5: SAVE GAME",
"F6: LOAD GAME",
  ];
  
  for (let i = 0; i < instructions.length; i++) {
    text(instructions[i], width / 2, height / 4 + i * 25);
  }
  textFont(font);
}






function keyPressed() {
  switch (gameState) {
    case 'error':
      resetGame();
      return false;
    case 'title':
      if (keyCode === ENTER) {
        gameState = 'start';
        ambientMusic.start();
      }
    case 'start':
      if (key === '1' || key === '2') {
        gameMode = key === '1' ? 'singlePlayer' : 'twoPlayer';
        gameState = 'playing';
        resetGame();
      }
      return false;
    case 'playing':
      handlePlayingState();
      return false;
    case 'gameOver':
      if (keyCode === ENTER) {
        gameState = 'start';
      }
      return false;
    case 'victory':
      if (keyCode === ENTER) {
        resetGame();
        gameState = 'start';
      }
      return false;
  }
  return false;
  
}

function handlePlayingState() {
  
  if (gameMode === 'twoPlayer') {
    handleTwoPlayerKeys();
  }
  if (!cameraFollowsMissile) {  // Only handle these keys if missile is not active
    if (key === 'x') {
      handleXKeyInteraction();
    } else if (isWalking) {
      handleWalkingKeys();
    } else {
      handleShipKeys();
    }
    
     if (key === 'r') {
      astronaut.placeDrillRig();
    }
    
    if (key === 'q') {
      Wingman.spawnWingman();
    }
  
    if (key === 'u') {
      upgradeMenu.toggle();
      return;
    }
    
    if (upgradeMenu.isOpen) {
    upgradeMenu.handleInput(keyCode);
    return;
  }

    
    // Add save and load functionality here F5 and F6
    if (keyIsDown(116)){
      if (GameStateManager.saveGame()) {
        announcer.speak("Game saved",0, 2);
      } else {
        announcer.speak("Failed to save game",0, 2);
      }
    } else if (keyIsDown(117)){
      if (GameStateManager.loadGame()) {
        announcer.speak("Game loaded",0, 2);
      } else {
        announcer.speak("Failed to load game",0, 2);
      }
    }
    
    
    
    
  }

  
  
  
  
  ///// New section
  // Debug controls
  if (keyCode === 219) { 
    debug.toggle();
    return false;
  }
  if (keyCode === 221 && debug.isEnabled) {
    debug.saveLogsToFile();
    return false;
  }
      
  
  // Always allow missile launch
  if (key === 'w') {
    Missile.launchMissile();
  }
}

function handleTwoPlayerKeys() {
  const alienActions = {
    '1': { cost: 200, action: () => Alien.createAliens(1) },
    '2': { cost: 500, action: () => Destroyer.spawnDestroyer() },
    '3': { cost: 1000, action: () => Hunter.spawnHunter() },
    '4': { cost: 1000, action: () => Zapper.spawnZapper() },
    '5': { cost: 1000, action: () => Nest.createNests(1) }
  };

  const actionInfo = alienActions[key];
  if (actionInfo && alienEnergy >= actionInfo.cost) {
      actionInfo.action();
      alienEnergy -= actionInfo.cost;
    }   
}

function handleWalkingKeys() {
  
  switch (key) {
    case 's':
      astronaut.placeShield();
      break;
    case 't':
      astronaut.placeTurret();
      break;
    case 'd':
      astronaut.dropBase();
      break;
    case 'e':
       WalkerRobot.spawnWalker(astronaut.pos);
      break;     
  }

  if (keyIsDown(32)) { // Spacebar
    if (!astronaut.isHoldingBombThrow) {
      astronaut.startBombThrow();
    }
  } else if (astronaut.isHoldingBombThrow) {
    astronaut.releaseBombThrow();
  }
}


function handleShipKeys() {
  
  switch (key) {
    case 'a':
      ship.toggleParachute();
      break;
    case ' ':
      ship.shoot();
      break;
    case 'd':
      ship.dropBase();
      break;     
  }
    
  if (keyCode === DOWN_ARROW && !upgradeMenu.isOpen) {
    ship.shootBomb();
  }
}

function toggleWalkingState() {
  if (!isWalking && ship.isLanded) {
    // Exit ship
    isWalking = true;
    astronaut.isInShip = false;
    astronaut.pos = ship.pos.copy();
    astronaut.pos.y = getSurfaceYAtX(astronaut.pos.x) - astronaut.size / 2;
  } else if (isWalking && astronaut.isCloseToShip()) {
    // Enter ship only if close enough
    isWalking = false;
    astronaut.isInShip = true;
    ship.pos.x = astronaut.pos.x;
    ship.pos.y = getSurfaceYAtX(ship.pos.x) - ship.size / 2;
    ship.vel.set(0, 0);
    ship.angle = -PI / 2;
    ship.isLanded = true;
  }
}

function handleXKeyInteraction() {
  if (isWalking) {
    if (astronaut.isCloseToShip()) {
      toggleWalkingState(); // Enter ship
    } else {
      astronaut.checkWalkerInteraction();
    }
  } else {
    toggleWalkingState(); // Exit ship
  }
}


function mousePressed() {
  if (mouseX > 0 && mouseX < windowWidth && mouseY > 0 && mouseY < windowHeight) {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  //This remakes the surface when we go fullscreen the first time because due new screen dimensions
  if (!surfaceRemadeAfterFullScreen){
    generateMoonSurface();
    surfaceRemadeAfterFullScreen = true;
  }
  
  if (upgradeMenu) {
    upgradeMenu.updateDimensions();
  }
}

function initializeWind() {
  windAngle = random(TWO_PI);
  windForce = random(0, maxWindForce);
  wind = p5.Vector.fromAngle(windAngle).mult(windForce);
}

function generateMoonSurface() {
  moonSurface = [];
  let x = 0;
  let smoothness = 0;
  const minHeight = height; // Minimum height for the surface

  while (x < worldWidth) {
    if (x % 800 === 0) {
      smoothness = random(0.3, 0.7);
    }
    
    let y;
    if (Math.random() < smoothness) {
      y = noise(x * 0.005) * (height / 2) + height / 2;
    } else {
      y = random(height / 2, minHeight);
    }
    
    // Ensure y is not below minHeight
    y = min(y, minHeight);
    
    moonSurface.push(createVector(x, y));
    x += random(20, 50);
  }
  moonSurface.push(createVector(worldWidth, min(random(height / 2, height - 50), minHeight)));
}

function createMoonBase() {
  moonBase = new MoonBase(100, 20); // width: 100, height: 20
}




function placePodOnSurface() {
  const minDistanceFromPlayer = 800; // Minimum distance from player
  let playerX;
  
  // Determine player position based on whether they're walking or in the ship
  if (isWalking && !astronaut.isInShip) {
    playerX = astronaut.pos.x;
  } else {
    playerX = ship.pos.x;
  }

  let podX, podY;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    podX = random(worldWidth);
    podY = Math.max(15, getSurfaceYAtX(podX) - 15);
    attempts++;
  } while (abs(podX - playerX) < minDistanceFromPlayer && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    debug.warn("Couldn't find a suitable position for the pod after maximum attempts.");
    // Fallback to a random position
    podX = random(worldWidth);
    podY = Math.max(15, getSurfaceYAtX(podX) - 15);
  }
  
  if (!pod) {
    pod = new Pod(createVector(podX, podY), 30);
  } else {
    pod.podDropOff(createVector(podX, podY));
  }
}

function drawHUD() {
  const leftMargin = 40;
  const topMargin = 20;
  const lineHeight = 20;

  textSize(16);
  textAlign(LEFT);

  // Energy display
  fill(energy < 1500 ? 'red' : 'white');
        if (energy < maxEnergy){
  text(`Energy: ${energy}`, leftMargin, topMargin);
        }else{
  text(`Energy: ${energy} MAX`, leftMargin, topMargin);        
        }
   
  if (energy < 1500 && !soundManager.isPlaying('warning')) {
    soundManager.play('warning');
  }

  // General game info
  fill('white');
  [
    `Money: ${money}`,
    ``,
    `Level: ${level}`,
    `Aliens: ${getTotalAlienCount()}`,
    `Nests: ${Nest.nests.length}`,
    `Plants: ${AlienPlant.plants.length}`,
    `Bases: ${MoonBase.moonBases.length}`,
    `Wind: ${Math.round((wind.mag() / maxWindForce) * 100)}%`,

  ].forEach((line, index) => {
    text(line, leftMargin, topMargin + (index + 2) * lineHeight);
  });
  
   // If there is a mission display the info
  if (MissionControl.currentMission) {  
    const timeLeft = MissionControl.getTimeRemaining();
    const missionName = MissionControl.currentMission.charAt(0).toUpperCase() + MissionControl.currentMission.slice(1);
    const missionInfoY = topMargin + 16 * lineHeight;
    
    fill('red');
    if (timeLeft > 0){
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    text(`Mission: ${missionName} ${minutes}:${seconds.toString().padStart(2, '0')}`, leftMargin, missionInfoY);
    }else{
        text(`Mission: ${missionName}`, leftMargin, missionInfoY);
    }
    fill('white');
  }

  // Player-specific instructions
if (isWalking) {
  if (astronaut.isCloseToShip()) {
    text('Press X to enter ship', leftMargin, topMargin + 11 * lineHeight);
  }
  text('Press T - turret', leftMargin, topMargin + 12 * lineHeight);
  text('Press S - shield', leftMargin, topMargin + 13 * lineHeight);
  text('Press D - base', leftMargin, topMargin + 14 * lineHeight);
  text('Press R - rig', leftMargin, topMargin + 15 * lineHeight);
} else if (ship.isLanded) {
  text('Press X to exit ship', leftMargin, topMargin + 11 * lineHeight);
  text('Press D - base', leftMargin, topMargin + 12 * lineHeight);
}

  // Two-player mode info
  if (gameMode === 'twoPlayer') {
    const rightMargin = width - 200;
    text(`Alien Energy: ${alienEnergy}`, rightMargin, topMargin);
    [
      "1: Alien (200)",
      "2: Destroyer (500)",
      "3: Hunter (1000)",
      "4: Zapper (1000)",
      "5: Nest (1000)"
    ].forEach((line, index) => {
      text(line, rightMargin, topMargin + (index + 2) * lineHeight);
    });
  }

  if (debug.isEnabled) {
    text(`FPS: ${averageFPS().toFixed(2)}`, 10, height - 10);
  }

}

function createBackgroundGraphics() {
  // Create stars
  for (let i = 0; i < 200; i++) {
    backgroundStars.push({
      x: random(worldWidth),
      y: random(height),
      size: random(1, 3)
    });
  }
  

}

function getMoonSurfaceColor() {
  const cycleEffect = (sin(dayNightCycle * TWO_PI) + 1) / 2; // Range 0 to 1
  return color(
    lerp(MOON_SURFACE_NIGHT[0], MOON_SURFACE_DAY[0], cycleEffect),
    lerp(MOON_SURFACE_NIGHT[1], MOON_SURFACE_DAY[1], cycleEffect),
    lerp(MOON_SURFACE_NIGHT[2], MOON_SURFACE_DAY[2], cycleEffect)
  );
}

function getSkyColor(t) {
  const index = Math.floor(t * 4);
  const fraction = (t * 4) % 1;
  return lerpColor(skyColors[index], skyColors[index + 1], fraction);
}

function drawBackground() {
  // Update day-night cycle
  dayNightCycle = (dayNightCycle + CYCLE_SPEED) % 1;

  // Draw sky
  const skyColor = getSkyColor(dayNightCycle);
  background(skyColor);

  // Calculate cycle-based effects
  const cycleEffect = (sin(dayNightCycle * TWO_PI) + 1) / 2; // Range 0 to 1
  const starBrightness = map(cycleEffect, 0, 1, 255, 0);

  // Draw stars
  if (starBrightness > 10) { // Small threshold to avoid drawing very faint stars
    fill(255, starBrightness);
    for (const star of backgroundStars) {
      ellipse(star.x, star.y, star.size);
    }
  }

  // Draw the rotating planet image if atEarth is true
  if (atEarth) {
    drawRotatingEarth();
  }

  // Shooting stars logic
  if (random() < shootingStarFrequency) {
    createShootingStar();
  }
  updateShootingStars();

  //drawWindLines();
  drawWindLinesOptimized();
     //profilerSeq.profileFrame();
}

function drawRotatingEarth() {
  push();
  imageMode(CENTER);
  translate(worldWidth / 2, 600); // Translate to the top-right corner
  rotate(frameCount * 0.0005); // Slow rotation
  image(earthImage, 0, 0); // Draw the image at the rotation center
  pop();
}


function createShootingStar() {
  let startX, startY, angle;
  const direction = random() > 0.5 ? 1 : -1; // Randomly choose direction

  if (direction > 0) {
    // Top-left to bottom-right
    startX = random(viewLeft, viewLeft + (viewRight - viewLeft) / 3);
    startY = random(viewTop, viewTop + (viewBottom - viewTop) / 3);
    angle = radians(random(10, 80));  // Changed to 10-80 degrees
  } else {
    // Top-right to bottom-left
    startX = random(viewRight - (viewRight - viewLeft) / 3, viewRight);
    startY = random(viewTop, viewTop + (viewBottom - viewTop) / 3);
    angle = radians(random(125, 180));  // Changed to 125-180 degrees
  }

  const speed = random(10, 15);
  const length = random(50, 200);
  shootingStars.push({ x: startX, y: startY, speed: speed, angle: angle, length: length });
}

function updateShootingStars() {
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const star = shootingStars[i];
    star.x += cos(star.angle) * star.speed;
    star.y += sin(star.angle) * star.speed;
    star.length = max(0, star.length - star.speed * 0.1);

    if (isInView({ x: star.x, y: star.y }, 2)) {
      push();
      // Draw the fading trail
      for (let j = 0; j < 6; j++) {
        const alpha = map(j, 0, 9, 255, 0);
        const segmentLength = star.length / 6;
        const segmentStartX = star.x - cos(star.angle) * (j * segmentLength);
        const segmentStartY = star.y - sin(star.angle) * (j * segmentLength);
        const segmentEndX = star.x - cos(star.angle) * ((j + 1) * segmentLength);
        const segmentEndY = star.y - sin(star.angle) * ((j + 1) * segmentLength);
        
        stroke(200, alpha);
        strokeWeight(2 - j * 0.2); // Gradually thinner trail
        line(segmentStartX, segmentStartY, segmentEndX, segmentEndY);
      }
      pop();
    }

    if (star.length <= 0 || !isInView({ x: star.x, y: star.y }, 2)) {
      shootingStars.splice(i, 1);
    }
  }
}

function drawWindLines() {
  push();
  // translate(-cameraOffset, 0); // Uncomment if cameraOffset is needed

  const windMagnitude = windForce / maxWindForce; // Normalize to 0-1 range
  const invertedWindAngle = windAngle + PI; // Invert the angle
  const windDirX = cos(invertedWindAngle);
  const windDirY = sin(invertedWindAngle);
  
  noFill();
  
  const amplitude = 100 * windMagnitude; // Pre-calculate amplitude
  const phaseIncrement = 0.02; // Phase increment

  // Draw swirling gas bands
  for (let i = -80; i < height; i += 30) {
    stroke(255, 100 * windMagnitude); // Adjust color as needed
    beginShape();

    for (let x = -100; x < worldWidth+100; x += 10) {
      // Project the point onto the inverted wind direction
      const proj = x * windDirX + i * windDirY;

      // Calculate phase based on projection
      const phase = proj * 0.01 + frameCount * phaseIncrement;

      // Calculate offset in inverted wind direction
      const offset = sin(phase) * amplitude;
      const xOffset = offset * windDirX;
      const yOffset = offset * windDirY;

      vertex(x + xOffset, i + yOffset);
    }

    endShape();
  }
  
  pop();
}


function drawWindLinesOptimized() {
  push();
  
  // translate(-cameraOffset.x, 0); // Uncomment if cameraOffset is needed

  const windMagnitude = windForce / maxWindForce; // Normalize to 0-1 range
  const invertedWindAngle = windAngle + PI; // Invert the angle
  const windDirX = cos(invertedWindAngle);
  const windDirY = sin(invertedWindAngle);
  
  noFill();
  
  const amplitude = 100 * windMagnitude; // Pre-calculate amplitude
  const phaseIncrement = 0.02; // Phase increment

  // Define step sizes
  const stepY = 30;
  const stepX = 10;

  // Define buffer to extend beyond the view boundaries horizontally
  const buffer = amplitude; // Adjust buffer as needed

  // Calculate extended horizontal view boundaries
  const extendedLeft = viewLeft - buffer;
  const extendedRight = viewRight + buffer;

  // Since all y positions are always in view, set size to cover the entire vertical span
  const verticalSize = height; // Ensures vertical checks always pass

  // Draw swirling gas bands
  for (let y = -30; y <= height; y += stepY) {
    stroke(255, 100 * windMagnitude); // Adjust color and opacity as needed
    beginShape();

    for (let x = extendedLeft; x <= extendedRight; x += stepX) {
      const pos = { x: x, y: y };
      
      // Use isInView to determine if the vertex should be drawn
      // Set size to verticalSize to ensure vertical checks always pass
      if (!isInView(pos, verticalSize)) continue;

      // Project the point onto the inverted wind direction
      const proj = x * windDirX + y * windDirY;

      // Calculate phase based on projection and frame count
      const phase = proj * 0.01 + frameCount * phaseIncrement;

      // Calculate offset in inverted wind direction
      const offset = sin(phase) * amplitude;
      const xOffset = offset * windDirX;
      const yOffset = offset * windDirY;

      vertex(x + xOffset, y + yOffset);
    }

    endShape();
  }
  
  pop();
}



function displayGameOver() {
  if (ship.hasGrabbedPod) {
    pod.carrierKilled(ship.pos.copy());
    ship.hasGrabbedPod = false;
    debug.log("Released pod");
  }
  
  
  if (!gameOverSoundPlayed) {
    RuinedShip.createFromShip(ship);   
    windSound.stop();
    soundManager.stop('shipThrust');
    soundManager.stop('warning');
    announcer.dispose();
    soundManager.play('gameOver');
    gameOverSoundPlayed = true;
    
    cameraOffset = 0; // Center the camera
    updateViewBoundaries(); // Recalculate viewLeft, viewRight, etc. 
  }
  
  drawBackground();
  fill(255);
  textSize(80);
  textAlign(CENTER, CENTER);
  text('Game over', width / 2, height / 2-100);
  textSize(40);
  text(`Level: ${level}`, width / 2, height / 2+40);
  textSize(16);
  text('Press ENTER', width / 2, height / 2 + 80);
  
}


function updateViewBoundaries() {
  viewLeft = cameraOffset;
  viewRight = cameraOffset + width;
  viewTop = 0;
  viewBottom = height;
}


function victory() {
  
  if (ship.hasGrabbedPod) {
    pod.carrierKilled(ship.pos.copy());
    ship.hasGrabbedPod = false;
    debug.log("Released pod");
  }
  
  
  if (!gameOverSoundPlayed) {
    RuinedShip.createFromShip(ship);   
    soundManager.stop('shipThrust');
    soundManager.stop('warning');
    announcer.stop();
    gameOverSoundPlayed = true;
  }
  
  background(0);
  
    // Slowly rotating planet image
  push();
    translate(width/2, height/2); // Translate to the top-right corner
  imageMode(CENTER);
  rotate(frameCount * 0.0005); // Slow rotation
  image(earthImage, 0, 0); // Draw the image at the rotation center
  pop();
  
  textSize(80);
  textAlign(CENTER, CENTER);
  text('Congratulations Commander', width / 2, height / 2-100);
  text('You have saved Earth!', width / 2, height / 2);
  textSize(40);
  text(`Level: ${level}`, width / 2, height / 2+80);
  textSize(16);
  text('Press ENTER', width / 2, height / 2 + 120);
}

function startNewLevel() {
  soundManager.reset();
  level++;
  soundManager.play('nextLevel');
    ambientMusic.newLevel();
  
  
  if (level > 3 && !alienQueen.hasDied){ 
    alienQueen.appearOnPlanet();   //from level 4 the queen apears from level 4
  }

  if (level > 7 && alienQueen.hasDied && !alienKing.hasDied){ 
    alienKing.appearOnPlanet();   //if queen is dead the the King apears every level from 8
  }

  
  // Base number of aliens to spawn
  let totalAliens = 8 + level * 2;
  
  // Calculate percentages for special aliens
  let destroyerChance = Math.min(3 + level, 10); // Starts at 4%, caps at 10%
  let hunterChance = Math.min(3 + level, 10); // Starts at 4%, caps at 10%
  let zapperChance = Math.min(2+ level, 10); // Starts at 3%, caps at 10%
  
  // Spawn special aliens
  let destroyersToSpawn = Math.floor(totalAliens * (destroyerChance / 100));
  let huntersToSpawn = Math.floor(totalAliens * (hunterChance / 100));
  let zappersToSpawn = Math.floor(totalAliens * (zapperChance / 100));
  
  // Spawn regular aliens for the remaining slots
  let regularAliensToSpawn = totalAliens - (destroyersToSpawn + huntersToSpawn + zappersToSpawn);
  
  // Spawn the aliens
  Alien.createAliens(regularAliensToSpawn);
  for (let i = 0; i < destroyersToSpawn; i++) Destroyer.spawnDestroyer();
  for (let i = 0; i < huntersToSpawn; i++) Hunter.spawnHunter();
  for (let i = 0; i < zappersToSpawn; i++) Zapper.spawnZapper();

  money += 3000; // Bonus for completing a level
  initializeWind(); // Change wind for the new level
  announcer.speak(`Level ${level}. The wind force changed to ${Math.round((wind.mag() / maxWindForce) * 100)}%.`,0, 2, 3000);
  
  showLevelTransition = true;
  levelTransitionTimer = 3000; // 3 seconds

  GameTimer.create('levelTransition', () => {
    showLevelTransition = false;
    levelTransitionTimer = 0;
  }, 3000);
  
  
}

function displayLevelTransition() {
  if (showLevelTransition) {
    fill(0, 0, 0, 50); // Semi-transparent black background
    rect(0, 0, width, height);
    
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(60);
    text(`Level ${level}`, width / 2, height / 2 - 60);
  }
}

//helper functions

function distToSegment(p, v, w) {
  let l2 = p5.Vector.sub(w, v).magSq();
  if (l2 == 0) return p5.Vector.dist(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = constrain(t, 0, 1);
  let proj = p5.Vector.add(v, p5.Vector.sub(w, v).mult(t));
  return p5.Vector.dist(p, proj);
}

function getSurfaceYAtX(x) {
  for (let i = 0; i < moonSurface.length - 1; i++) {
    let start = moonSurface[i];
    let end = moonSurface[i + 1];
    if (x >= start.x && x < end.x) {
      let t = (x - start.x) / (end.x - start.x);
      return lerp(start.y, end.y, t);
    }
  }
  return height; 
}

function isOutOfBounds(pos) {
  return pos.x < 0 || pos.x > worldWidth || pos.y < 0 || pos.y > height;
}