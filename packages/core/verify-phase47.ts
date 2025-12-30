import { WorkflowService } from './src/services/workflow.service';
import { ExecutionService } from './src/services/execution.service';
import { db, executions, workflowVersions, eq } from '@local-n8n/database';

async function verifyPhase47() {
    console.log('🧪 Phase 47 Verification: Workflow Versioning & History');

    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();

    // Test 1: Create workflow and verify version 1
    console.log('\nTest 1: Create workflow and verify version 1');
    const wf = await workflowService.createWorkflow({
        name: 'Version Test',
        nodes: [{ id: '1', type: 'core.noop', parameters: {} }],
        connections: {}
    });

    const versions1 = await workflowService.listWorkflowVersions(wf!.id);
    console.log(`Versions count: ${versions1.length}`);
    if (versions1.length === 1 && versions1[0].versionNumber === 1) {
        console.log('✅ Version 1 created successfully');
    } else {
        console.error('❌ Version 1 creation failed');
        process.exit(1);
    }

    // Test 2: Update workflow and verify version 2
    console.log('\nTest 2: Update workflow and verify version 2');
    await workflowService.updateWorkflow(wf!.id, { name: 'Version Test Updated' });
    const versions2 = await workflowService.listWorkflowVersions(wf!.id);
    console.log(`Versions count: ${versions2.length}`);
    if (versions2.length === 2 && versions2[0].versionNumber === 2) {
        console.log('✅ Version 2 created successfully');
    } else {
        console.error('❌ Version 2 creation failed');
        process.exit(1);
    }

    // Test 3: Rollback to version 1
    console.log('\nTest 3: Rollback to version 1');
    const v1 = versions2.find(v => v.versionNumber === 1);
    await workflowService.rollback(wf!.id, v1!.id);
    const versions3 = await workflowService.listWorkflowVersions(wf!.id);
    console.log(`Versions count: ${versions3.length}`);
    const latest = versions3[0];
    if (versions3.length === 3 && latest.versionNumber === 3 && latest.name === 'Version Test') {
        console.log('✅ Rollback successful (Version 3 created with Version 1 content)');
    } else {
        console.error('❌ Rollback failed');
        process.exit(1);
    }

    // Test 4: Execute and verify version linkage
    console.log('\nTest 4: Execute and verify version linkage');
    const exec = await executionService.createExecution({
        workflowId: wf!.id,
        workflowVersionId: latest.id,
        mode: 'manual',
        workflowSnapshot: wf
    });

    const dbExec = await db.select().from(executions).where(eq(executions.id, exec!.id)).get();
    if (dbExec?.workflowVersionId === latest.id) {
        console.log('✅ Execution linked to correct workflow version');
    } else {
        console.error(`❌ Execution linkage failed. Expected ${latest.id}, got ${dbExec?.workflowVersionId}`);
        process.exit(1);
    }

    console.log('\n🎉 Phase 47 Verified!');
    process.exit(0);
}

verifyPhase47().catch(console.error);
