// Performance Test Utilities for Neptune Game
// Run these in the browser console to validate optimizations

/**
 * Benchmark squared distance vs regular distance calculation
 */
function benchmarkDistanceCalculations() {
  const iterations = 1000000;
  const p1 = { x: 100, y: 200 };
  const p2 = { x: 300, y: 400 };
  const threshold = 150;
  
  console.log('=== Distance Calculation Benchmark ===');
  console.log(`Iterations: ${iterations.toLocaleString()}`);
  
  // Test 1: Using .dist() with sqrt
  let start = performance.now();
  let count1 = 0;
  for (let i = 0; i < iterations; i++) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < threshold) count1++;
  }
  let time1 = performance.now() - start;
  
  // Test 2: Using squared distance (optimized)
  start = performance.now();
  let count2 = 0;
  const thresholdSq = threshold * threshold;
  for (let i = 0; i < iterations; i++) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (dx * dx + dy * dy < thresholdSq) count2++;
  }
  let time2 = performance.now() - start;
  
  console.log(`\nWith sqrt():           ${time1.toFixed(2)}ms`);
  console.log(`Without sqrt():        ${time2.toFixed(2)}ms`);
  console.log(`Speedup:               ${(time1/time2).toFixed(2)}x faster`);
  console.log(`Time saved:            ${(time1 - time2).toFixed(2)}ms (${(((time1-time2)/time1)*100).toFixed(1)}%)`);
}

/**
 * Benchmark for...of vs indexed for loop
 */
function benchmarkLoopPatterns() {
  const iterations = 100000;
  const testArray = Array.from({length: 100}, (_, i) => ({ x: i, y: i * 2, value: Math.random() }));
  
  console.log('\n=== Loop Pattern Benchmark ===');
  console.log(`Iterations: ${iterations.toLocaleString()}`);
  console.log(`Array size: ${testArray.length}`);
  
  // Test 1: for...of loop
  let start = performance.now();
  let sum1 = 0;
  for (let j = 0; j < iterations; j++) {
    for (const item of testArray) {
      sum1 += item.value;
    }
  }
  let time1 = performance.now() - start;
  
  // Test 2: indexed for loop (optimized)
  start = performance.now();
  let sum2 = 0;
  for (let j = 0; j < iterations; j++) {
    for (let i = 0; i < testArray.length; i++) {
      sum2 += testArray[i].value;
    }
  }
  let time2 = performance.now() - start;
  
  // Test 3: forEach
  start = performance.now();
  let sum3 = 0;
  for (let j = 0; j < iterations; j++) {
    testArray.forEach(item => {
      sum3 += item.value;
    });
  }
  let time3 = performance.now() - start;
  
  console.log(`\nfor...of loop:         ${time1.toFixed(2)}ms`);
  console.log(`indexed for loop:      ${time2.toFixed(2)}ms (${(time1/time2).toFixed(2)}x faster)`);
  console.log(`forEach:               ${time3.toFixed(2)}ms`);
  console.log(`Best: indexed for loop saves ${(time1 - time2).toFixed(2)}ms vs for...of (${(((time1-time2)/time1)*100).toFixed(1)}%)`);
}

/**
 * Monitor real-time game performance
 */
function monitorGamePerformance(durationMs = 10000) {
  console.log('\n=== Game Performance Monitor ===');
  console.log(`Monitoring for ${durationMs/1000} seconds...`);
  
  const startTime = Date.now();
  const samples = [];
  let alienCounts = [];
  let bulletCounts = [];
  
  const interval = setInterval(() => {
    if (typeof frameRate === 'function') {
      const fps = frameRate();
      samples.push(fps);
      
      // Track entity counts
      if (typeof Alien !== 'undefined' && Alien.aliens) {
        alienCounts.push(Alien.aliens.length);
      }
      if (typeof Bullet !== 'undefined' && Bullet.activeObjects) {
        bulletCounts.push(Bullet.activeObjects.length);
      }
    }
    
    if (Date.now() - startTime >= durationMs) {
      clearInterval(interval);
      
      // Calculate statistics
      const avgFPS = samples.reduce((a, b) => a + b, 0) / samples.length;
      const minFPS = Math.min(...samples);
      const maxFPS = Math.max(...samples);
      const avgAliens = alienCounts.length > 0 ? 
        Math.round(alienCounts.reduce((a, b) => a + b, 0) / alienCounts.length) : 0;
      const avgBullets = bulletCounts.length > 0 ?
        Math.round(bulletCounts.reduce((a, b) => a + b, 0) / bulletCounts.length) : 0;
      
      console.log('\n--- Results ---');
      console.log(`Average FPS:    ${avgFPS.toFixed(2)}`);
      console.log(`Min FPS:        ${minFPS.toFixed(2)}`);
      console.log(`Max FPS:        ${maxFPS.toFixed(2)}`);
      console.log(`FPS Variance:   ${(maxFPS - minFPS).toFixed(2)}`);
      console.log(`Avg Aliens:     ${avgAliens}`);
      console.log(`Avg Bullets:    ${avgBullets}`);
      console.log(`Samples taken:  ${samples.length}`);
    }
  }, 100);
  
  return 'Monitoring... (results will appear when complete)';
}

/**
 * Run all benchmarks
 */
function runAllOptimizationBenchmarks() {
  console.clear();
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Neptune Speed Optimization Benchmarks    ║');
  console.log('╚════════════════════════════════════════════╝');
  
  benchmarkDistanceCalculations();
  benchmarkLoopPatterns();
  
  console.log('\n=== To monitor in-game performance: ===');
  console.log('Run: monitorGamePerformance(10000)');
  console.log('(monitors for 10 seconds)');
}

// Export functions for console use
if (typeof window !== 'undefined') {
  window.speedOptTests = {
    benchmarkDistanceCalculations,
    benchmarkLoopPatterns,
    monitorGamePerformance,
    runAllOptimizationBenchmarks
  };
  
  console.log('Speed optimization test utilities loaded!');
  console.log('Run: speedOptTests.runAllOptimizationBenchmarks()');
  console.log('Or run individual tests:');
  console.log('  - speedOptTests.benchmarkDistanceCalculations()');
  console.log('  - speedOptTests.benchmarkLoopPatterns()');
  console.log('  - speedOptTests.monitorGamePerformance(10000)');
}
