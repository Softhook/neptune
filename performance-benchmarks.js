/**
 * Performance Benchmark Utilities for Neptune Game
 * 
 * Run these benchmarks in the browser console to measure optimization impact.
 * Usage: Copy and paste functions into browser console while game is running.
 */

// ============================================================================
// Benchmark 1: Distance Calculation Comparison
// ============================================================================

function benchmarkDistanceCalculations() {
  console.log("=== Distance Calculation Benchmark ===");
  
  const iterations = 100000;
  const pos1 = { x: 100, y: 200 };
  const pos2 = { x: 350, y: 450 };
  const threshold = 300;
  
  // Method 1: Using p5.Vector.dist (with sqrt)
  console.time("p5.Vector.dist method");
  let count1 = 0;
  for (let i = 0; i < iterations; i++) {
    const p1 = createVector(pos1.x, pos1.y);
    const p2 = createVector(pos2.x, pos2.y);
    if (p5.Vector.dist(p1, p2) < threshold) {
      count1++;
    }
  }
  console.timeEnd("p5.Vector.dist method");
  
  // Method 2: Using .dist() method (with sqrt)
  console.time(".dist() method");
  let count2 = 0;
  for (let i = 0; i < iterations; i++) {
    const p1 = createVector(pos1.x, pos1.y);
    const p2 = createVector(pos2.x, pos2.y);
    if (p1.dist(p2) < threshold) {
      count2++;
    }
  }
  console.timeEnd(".dist() method");
  
  // Method 3: Using squared distance (optimized)
  console.time("Squared distance method (optimized)");
  let count3 = 0;
  const thresholdSq = threshold * threshold;
  for (let i = 0; i < iterations; i++) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    if (dx * dx + dy * dy < thresholdSq) {
      count3++;
    }
  }
  console.timeEnd("Squared distance method (optimized)");
  
  console.log(`All methods matched: ${count1 === count2 && count2 === count3}`);
  console.log(`Results: ${count1} collisions detected in ${iterations} iterations`);
}

// ============================================================================
// Benchmark 2: Graphics State Change Impact
// ============================================================================

function benchmarkGraphicsStateBatching() {
  console.log("=== Graphics State Batching Benchmark ===");
  
  const iterations = 1000;
  const numShapes = 100;
  
  // Method 1: Set fill for each shape
  console.time("Fill per shape");
  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < numShapes; j++) {
      fill(255, 0, 0);
      // Note: Can't actually render without affecting game, just measure state changes
    }
  }
  console.timeEnd("Fill per shape");
  
  // Method 2: Set fill once for all shapes
  console.time("Fill once (batched)");
  for (let i = 0; i < iterations; i++) {
    fill(255, 0, 0);
    for (let j = 0; j < numShapes; j++) {
      // Shapes would be drawn here
    }
  }
  console.timeEnd("Fill once (batched)");
  
  console.log(`Batching eliminates ${(numShapes - 1) * iterations} fill() calls`);
}

// ============================================================================
// Benchmark 3: Loop Performance (forEach vs for)
// ============================================================================

function benchmarkLoopPerformance() {
  console.log("=== Loop Performance Benchmark ===");
  
  const arraySize = 10000;
  const testArray = Array.from({ length: arraySize }, (_, i) => ({ x: i, y: i * 2 }));
  
  // Method 1: forEach
  console.time("forEach loop");
  let sum1 = 0;
  testArray.forEach(item => {
    sum1 += item.x + item.y;
  });
  console.timeEnd("forEach loop");
  
  // Method 2: for...of
  console.time("for...of loop");
  let sum2 = 0;
  for (let item of testArray) {
    sum2 += item.x + item.y;
  }
  console.timeEnd("for...of loop");
  
  // Method 3: indexed for loop
  console.time("indexed for loop");
  let sum3 = 0;
  for (let i = 0; i < testArray.length; i++) {
    sum3 += testArray[i].x + testArray[i].y;
  }
  console.timeEnd("indexed for loop");
  
  // Method 4: cached length for loop
  console.time("cached length for loop");
  let sum4 = 0;
  const len = testArray.length;
  for (let i = 0; i < len; i++) {
    sum4 += testArray[i].x + testArray[i].y;
  }
  console.timeEnd("cached length for loop");
  
  console.log(`All methods matched: ${sum1 === sum2 && sum2 === sum3 && sum3 === sum4}`);
  console.log(`Sum: ${sum1}`);
}

// ============================================================================
// Benchmark 4: Measure Actual Game Performance
// ============================================================================

function measureGamePerformance(duration = 5000) {
  console.log("=== Game Performance Measurement ===");
  console.log(`Measuring for ${duration}ms...`);
  
  const startTime = millis();
  const startFrame = frameCount;
  let minFPS = Infinity;
  let maxFPS = 0;
  let fpsReadings = [];
  
  const intervalId = setInterval(() => {
    const currentFPS = frameRate();
    fpsReadings.push(currentFPS);
    minFPS = Math.min(minFPS, currentFPS);
    maxFPS = Math.max(maxFPS, currentFPS);
  }, 100);
  
  setTimeout(() => {
    clearInterval(intervalId);
    const endTime = millis();
    const endFrame = frameCount;
    
    const totalFrames = endFrame - startFrame;
    const totalTime = endTime - startTime;
    const avgFPS = (totalFrames / totalTime) * 1000;
    
    console.log(`\nResults:`);
    console.log(`Total frames: ${totalFrames}`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average FPS: ${avgFPS.toFixed(2)}`);
    console.log(`Min FPS: ${minFPS.toFixed(2)}`);
    console.log(`Max FPS: ${maxFPS.toFixed(2)}`);
    console.log(`FPS variance: ${(maxFPS - minFPS).toFixed(2)}`);
    
    // Entity counts
    console.log(`\nCurrent entity counts:`);
    console.log(`Aliens: ${Alien.aliens.length}`);
    console.log(`Hunters: ${Hunter.hunters.length}`);
    console.log(`Bullets: ${Bullet.activeObjects.length}`);
    console.log(`Particles: ${Particle.activeParticles.length}`);
    console.log(`Nests: ${Nest.nests.length}`);
    console.log(`Wingmen: ${Wingman.wingmen.length}`);
  }, duration);
}

// ============================================================================
// Benchmark 5: Specific Function Profiling
// ============================================================================

function profileFunction(fn, name, iterations = 1000) {
  console.log(`\n=== Profiling: ${name} ===`);
  console.time(name);
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  console.timeEnd(name);
  console.log(`Average time per call: ${(performance.now() / iterations).toFixed(4)}ms`);
}

// ============================================================================
// Run All Benchmarks
// ============================================================================

function runAllBenchmarks() {
  console.log("\n" + "=".repeat(60));
  console.log("NEPTUNE GAME PERFORMANCE BENCHMARKS");
  console.log("=".repeat(60) + "\n");
  
  benchmarkDistanceCalculations();
  console.log("\n");
  
  benchmarkGraphicsStateBatching();
  console.log("\n");
  
  benchmarkLoopPerformance();
  console.log("\n");
  
  // Measure actual game performance for 5 seconds
  console.log("Starting game performance measurement...");
  measureGamePerformance(5000);
}

// ============================================================================
// Instructions
// ============================================================================

console.log(`
Neptune Game Performance Benchmarks Loaded!

Available functions:
  - runAllBenchmarks()           : Run all benchmark tests
  - benchmarkDistanceCalculations() : Compare distance calculation methods
  - benchmarkGraphicsStateBatching() : Compare batched vs per-item rendering
  - benchmarkLoopPerformance()   : Compare loop styles (forEach, for, etc.)
  - measureGamePerformance(ms)   : Measure actual game FPS for specified duration
  - profileFunction(fn, name, iterations) : Profile a specific function

Quick start:
  1. Make sure the game is running
  2. Type: runAllBenchmarks()
  3. Wait for results

Example:
  measureGamePerformance(10000)  // Measure FPS for 10 seconds
`);
