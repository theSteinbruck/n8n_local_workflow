import * as cron from 'node-cron';
import { CronTriggerNode } from './src/nodes/core.cronTrigger';
import { NodeExecutionContext } from './src/execution/node-execution-context';
import { SchedulerService } from './src/services/scheduler.service';
import { WorkflowService } from './src/services/workflow.service';
import { ExecutionService } from './src/services/execution.service';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';

async function verifyPhase49() {
    console.log('🧪 Phase 49 Verification: Cron / Schedule Trigger\n');

    // Test 1: CronTriggerNode exists and has correct properties
    console.log('Test 1: CronTriggerNode definition');
    const cronNode = new CronTriggerNode();

    if (
        cronNode.description.name === 'CronTrigger' &&
        cronNode.isTrigger === true &&
        cronNode.description.properties.length === 2
    ) {
        console.log('✅ CronTriggerNode has correct definition');
    } else {
        console.error('❌ CronTriggerNode definition incorrect');
        process.exit(1);
    }

    // Test 2: CronTriggerNode execute returns trigger metadata
    console.log('\nTest 2: CronTriggerNode execute');
    const mockNode = {
        parameters: {
            cronExpression: '*/5 * * * *',
            timezone: 'America/New_York'
        }
    };
    const context = new NodeExecutionContext({}, mockNode);
    const result = await cronNode.execute(context);

    if (
        result.triggerType === 'cron' &&
        result.cronExpression === '*/5 * * * *' &&
        result.timezone === 'America/New_York' &&
        result.triggeredAt
    ) {
        console.log('✅ CronTriggerNode execute returns correct metadata');
    } else {
        console.error('❌ CronTriggerNode execute failed');
        process.exit(1);
    }

    // Test 3: Cron expression validation
    console.log('\nTest 3: Cron expression validation');
    const validCron = cron.validate('*/5 * * * *');
    const invalidCron = cron.validate('invalid cron');

    if (validCron === true && invalidCron === false) {
        console.log('✅ Cron expression validation works');
    } else {
        console.error('❌ Cron expression validation failed');
        process.exit(1);
    }

    // Test 4: SchedulerService exists with correct methods
    console.log('\nTest 4: SchedulerService structure');
    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    const scheduler = new SchedulerService(
        workflowService,
        executionService,
        nodeRegistry,
        eventBus
    );

    if (
        typeof scheduler.start === 'function' &&
        typeof scheduler.stop === 'function' &&
        typeof scheduler.schedule === 'function' &&
        typeof scheduler.unschedule === 'function' &&
        typeof scheduler.getScheduledJobs === 'function'
    ) {
        console.log('✅ SchedulerService has all required methods');
    } else {
        console.error('❌ SchedulerService missing methods');
        process.exit(1);
    }

    // Test 5: Schedule and unschedule functionality
    console.log('\nTest 5: Schedule and unschedule workflow');

    // Create a test workflow
    const workflow = await workflowService.createWorkflow({
        name: 'Cron Test Workflow',
        nodes: [
            { id: 'cron1', type: 'CronTrigger', parameters: { cronExpression: '*/5 * * * *' } },
            { id: 'noop1', type: 'NoOp', parameters: {} }
        ],
        connections: { cron1: { main: [['noop1']] } }
    });

    // Schedule the workflow
    const scheduled = await scheduler.schedule(workflow!.id, '*/5 * * * *');

    if (scheduled) {
        console.log('✅ Workflow scheduled successfully');
    } else {
        console.error('❌ Failed to schedule workflow');
        process.exit(1);
    }

    // Check scheduled jobs
    const jobs = scheduler.getScheduledJobs();
    if (jobs.length === 1 && jobs[0].workflowId === workflow!.id) {
        console.log('✅ Scheduled job appears in list');
    } else {
        console.error('❌ Scheduled job not in list');
        process.exit(1);
    }

    // Unschedule the workflow
    const unscheduled = scheduler.unschedule(workflow!.id);
    if (unscheduled && scheduler.getScheduledJobs().length === 0) {
        console.log('✅ Workflow unscheduled successfully');
    } else {
        console.error('❌ Failed to unschedule workflow');
        process.exit(1);
    }

    // Clean up
    await scheduler.stop();

    console.log('\n🎉 Phase 49 Verified! Cron/Schedule Trigger is working.');
    process.exit(0);
}

verifyPhase49().catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
});
