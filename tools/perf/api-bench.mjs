import autocannon from 'autocannon';

const target = process.env.PERF_URL || 'http://localhost:3001/api/health';
const duration = Number(process.env.PERF_DURATION || 15);
const connections = Number(process.env.PERF_CONN || 20);
const p95Max = Number(process.env.PERF_P95_MAX || 300);   // мс
const rpsMin = Number(process.env.PERF_RPS_MIN || 200);   // req/sec

console.log(`🚀 Starting API performance test...`);
console.log(`📍 Target: ${target}`);
console.log(`⏱️ Duration: ${duration}s, Connections: ${connections}`);
console.log(`🎯 Budgets: P95 < ${p95Max}ms, RPS > ${rpsMin}`);

try {
  const result = await autocannon({
    url: target, 
    duration, 
    connections, 
    method: 'GET',
    headers: {
      'Authorization': process.env.PERF_AUTH_TOKEN ? `Bearer ${process.env.PERF_AUTH_TOKEN}` : undefined
    }
  });

  const p95 = result.latency.p95;
  const rps = result.requests.average;
  const errors = result.errors;
  const timeouts = result.timeouts;

  console.log(`\n📊 Performance Results:`);
  console.log(`   RPS: ${rps.toFixed(1)} req/sec`);
  console.log(`   P95 Latency: ${p95}ms`);
  console.log(`   P99 Latency: ${result.latency.p99}ms`);
  console.log(`   Mean Latency: ${result.latency.average.toFixed(1)}ms`);
  console.log(`   Total Requests: ${result.requests.total}`);
  console.log(`   Errors: ${errors}, Timeouts: ${timeouts}`);

  let hasFailures = false;

  // Проверяем бюджеты
  if (p95 > p95Max) {
    console.error(`❌ FAIL: P95 ${p95}ms > budget ${p95Max}ms`);
    hasFailures = true;
  } else {
    console.log(`✅ P95 latency budget: ${p95}ms <= ${p95Max}ms`);
  }

  if (rps < rpsMin) {
    console.error(`❌ FAIL: RPS ${rps.toFixed(1)} < budget ${rpsMin}`);
    hasFailures = true;
  } else {
    console.log(`✅ RPS budget: ${rps.toFixed(1)} >= ${rpsMin}`);
  }

  if (errors > 0) {
    console.error(`❌ FAIL: ${errors} errors detected`);
    hasFailures = true;
  } else {
    console.log(`✅ No errors detected`);
  }

  if (timeouts > 0) {
    console.error(`❌ FAIL: ${timeouts} timeouts detected`);
    hasFailures = true;
  } else {
    console.log(`✅ No timeouts detected`);
  }

  if (hasFailures) {
    console.log(`\n❌ Performance budgets FAILED`);
    process.exit(1);
  } else {
    console.log(`\n✅ All performance budgets satisfied`);
    process.exit(0);
  }

} catch (error) {
  console.error('❌ Performance test failed:', error.message);
  process.exit(1);
}