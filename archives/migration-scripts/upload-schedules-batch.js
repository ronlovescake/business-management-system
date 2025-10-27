/* eslint-disable no-console */
const http = require('http');

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
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
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
  const { execSync } = require('child_process');
  const schedulesJson = execSync(
    'node generate-schedules-2025.js 2>/dev/null'
  ).toString();
  const allSchedules = JSON.parse(schedulesJson);

  console.log(`Total schedules to upload: ${allSchedules.length}`);

  // Split into batches of 100
  const batchSize = 100;
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < allSchedules.length; i += batchSize) {
    const batch = allSchedules.slice(i, i + batchSize);
    console.log(
      `Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allSchedules.length / batchSize)} (${batch.length} schedules)...`
    );

    try {
      const result = await uploadBatch(batch);
      if (result.count) {
        totalSuccess += result.count;
        console.log(`✅ Batch uploaded: ${result.count} schedules`);
      } else {
        console.log(`⚠️ Batch result:`, result);
      }
    } catch (error) {
      console.error(`❌ Batch failed:`, error.message);
      totalFailed += batch.length;
    }

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n📊 Upload Summary:`);
  console.log(`✅ Success: ${totalSuccess}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`📈 Total: ${allSchedules.length}`);
}

main().catch(console.error);
