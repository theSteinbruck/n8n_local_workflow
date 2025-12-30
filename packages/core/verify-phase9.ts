import { WorkflowService } from './src/services/workflow.service';
import { ExecutionService } from './src/services/execution.service';
import { ExecutionEngine } from './src/execution/execution-engine';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { NoOpNode } from './src/nodes/core.noop';
import { SetNode } from './src/nodes/core.set';
import { FailNode } from './src/nodes/core.fail';
import { db, executionSteps, executions, eq } from '@local-n8n/database';

async function verify() {
    try {
        console.log('Phase 9: End-to-End Verification & Hardening');

        // 1. Setup
        const workflowService = new WorkflowService();
        const executionService = new ExecutionService();
        const nodeRegistry = new NodeRegistry();
        const eventBus = new EventBus();

        nodeRegistry.register(new NoOpNode());
        nodeRegistry.register(new SetNode());
        nodeRegistry.register(new FailNode());

        const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

        // Track events
        const eventLog: string[] = [];
        eventBus.on('nodeExecuteBefore', (d) => eventLog.push(`BEFORE:${d.nodeId}`));
        eventBus.on('nodeExecuteAfter', (d) => eventLog.push(`AFTER:${d.nodeId}`));

        // --- TEST CASE 1: Success Flow ---
        console.log('\n--- Test Case 1: Success Flow ---');
        const successWf = await workflowService.createWorkflow({
            name: 'E2E Success',
            nodes: [
                { id: 'set1', type: 'core.set', parameters: { values: { test: 123 } } },
                { id: 'noop1', type: 'core.noop' }
            ],
            connections: {}
        });

        const exec1 = await executionService.createExecution({
            workflowId: successWf.id,
            mode: 'manual',
            workflowSnapshot: successWf
        });

        await engine.run(exec1.id, successWf);

        // Verify DB State
        const dbExec1 = await db.select().from(executions).where(eq(executions.id, exec1.id)).get();
        if (dbExec1?.status !== 'success') throw new Error(`Exec1 status mismatch: ${dbExec1?.status}`);

        const steps1 = await db.select().from(executionSteps).where(eq(executionSteps.executionId, exec1.id)).all();
        if (steps1.length !== 2) throw new Error(`Exec1 step count mismatch: ${steps1.length}`);
        if (steps1.some(s => s.status !== 'success')) throw new Error('Exec1 steps not all success');

        // Verify Data
        const noopStep = steps1.find(s => s.nodeId === 'noop1');
        if ((noopStep?.outputData as any).test !== 123) throw new Error('Exec1 data propagation failed');

        console.log('✅ Success Flow Verified');


        // --- TEST CASE 2: Failure Flow ---
        console.log('\n--- Test Case 2: Failure Flow ---');
        eventLog.length = 0; // Clear log

        const failWf = await workflowService.createWorkflow({
            name: 'E2E Failure',
            nodes: [
                { id: 'set2', type: 'core.set', parameters: { values: { test: 456 } } },
                { id: 'fail1', type: 'core.fail' },
                { id: 'noop2', type: 'core.noop' } // Should not run
            ],
            connections: {}
        });

        const exec2 = await executionService.createExecution({
            workflowId: failWf.id,
            mode: 'manual',
            workflowSnapshot: failWf
        });

        try {
            await engine.run(exec2.id, failWf);
            throw new Error('Engine should have thrown error');
        } catch (e: any) {
            if (e.message !== 'Simulated Failure') throw e;
            console.log('✅ Engine correctly threw error');
        }

        // Verify DB State
        const dbExec2 = await db.select().from(executions).where(eq(executions.id, exec2.id)).get();
        if (dbExec2?.status !== 'error') throw new Error(`Exec2 status mismatch: ${dbExec2?.status}`);

        const steps2 = await db.select().from(executionSteps).where(eq(executionSteps.executionId, exec2.id)).all();

        // Should have 2 steps: set2 (success) and fail1 (error). noop2 should not exist.
        if (steps2.length !== 2) throw new Error(`Exec2 step count mismatch: ${steps2.length}`);

        const setStep2 = steps2.find(s => s.nodeId === 'set2');
        if (setStep2?.status !== 'success') throw new Error('Set2 step should be success');

        const failStep = steps2.find(s => s.nodeId === 'fail1');
        if (failStep?.status !== 'error') throw new Error('Fail1 step should be error');
        if (failStep?.error !== 'Simulated Failure') throw new Error('Fail1 error message mismatch');

        console.log('✅ Failure Isolation Verified');

        // --- TEST CASE 3: Event Ordering ---
        console.log('\n--- Test Case 3: Event Ordering ---');
        // For Exec 2: Before Set -> After Set -> Before Fail -> (Error, no After Fail)
        // Actually, engine implementation:
        // try { emitBefore; execute; emitAfter; } catch { ... }
        // So if execute fails, emitAfter is skipped.

        const expectedEvents = ['BEFORE:set2', 'AFTER:set2', 'BEFORE:fail1'];
        if (eventLog.join(',') !== expectedEvents.join(',')) {
            throw new Error(`Event mismatch. Got: ${eventLog.join(',')}`);
        }
        console.log('✅ Event Ordering Verified');

        console.log('\n✅ Phase 9 Complete: All checks passed.');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
