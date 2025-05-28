import { Worker } from '@temporalio/worker';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import all your agent workflows and activities here
import * as analyticsActivities from './agents/AnalyticsAgent/activities';
// import * as feedActivities from './agents/FeedAgent/activities';
// import more agents as you build them

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'), // or your workflows dir
    activities: {
      ...analyticsActivities,
      // ...feedActivities,
      // Add more agent activities as you build them
    },
    taskQueue: 'main', // Can name this "unit-talk-main" or whatever you want
  });

  console.log('👷 Temporal worker started!');
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
