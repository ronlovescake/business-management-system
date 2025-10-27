/* eslint-disable no-console */
const http = require('http');
const { execSync } = require('child_process');

async function uploadBatch(schedules) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(schedules);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/schedules',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Generate all schedules
  console.log('Generating schedules...');
  const schedulesJson = execSync(
    'node generate-schedules-2025.js 2>/dev/null'
  ).toString();
  const allSchedules = JSON.parse(schedulesJson);

  console.log(`Total schedules to upload: ${allSchedules.length}\n`);

  // Split into batches of 50 (smaller batches for reliability)
  const batchSize = 50;
  let totalSuccess = 0;

  for (let i = 0; i < allSchedules.length; i += batchSize) {
    const batch = allSchedules.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allSchedules.length / batchSize);

    process.stdout.write(
      `Batch ${batchNum}/${totalBatches} (${batch.length} schedules)... `
    );

    try {
      const result = await uploadBatch(batch);
      totalSuccess += result.count || 0;
      console.log(`✅ ${result.count}`);
    } catch (error) {
      console.log(`❌ ${error.message}`);
    }

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log(`\n�� Final Count: ${totalSuccess} schedules uploaded`);
}

main().catch(console.error);
