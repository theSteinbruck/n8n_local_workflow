import express from 'express';
import * as http from 'http';
import { Server } from 'socket.io';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { ExecutionService } from '@local-n8n/core/src/services/execution.service';
import { CredentialService } from '@local-n8n/core/src/services/credential.service';
import { ExecutionEngine } from '@local-n8n/core/src/execution/execution-engine';
import { NodeRegistry } from '@local-n8n/core/src/execution/node-registry';
import { EventBus } from '@local-n8n/core/src/execution/event-bus';
import { NoOpNode } from '@local-n8n/core/src/nodes/core.noop';
import { SetNode } from '@local-n8n/core/src/nodes/core.set';
import { FailNode } from '@local-n8n/core/src/nodes/core.fail';
import { ManualTriggerNode } from '@local-n8n/core/src/nodes/core.manualTrigger';
import { IfNode } from '@local-n8n/core/src/nodes/core.if';
import { MergeNode } from '@local-n8n/core/src/nodes/core.merge';
import { ForEachNode } from '@local-n8n/core/src/nodes/core.forEach';
import { HttpRequestNode } from '@local-n8n/core/src/nodes/core.httpRequest';
import { ExecuteWorkflowNode } from '@local-n8n/core/src/nodes/core.executeWorkflow';
import { WaitNode } from '@local-n8n/core/src/nodes/core.wait';
import { CronTriggerNode } from '@local-n8n/core/src/nodes/core.cronTrigger';
import { ReadTextFileNode } from '@local-n8n/core/src/nodes/core.readTextFile';
import { WriteTextFileNode } from '@local-n8n/core/src/nodes/core.writeTextFile';
import { AppendTextFileNode } from '@local-n8n/core/src/nodes/core.appendTextFile';
import { ReadExcelNode } from '@local-n8n/core/src/nodes/core.readExcel';
import { CreateExcelNode } from '@local-n8n/core/src/nodes/core.createExcel';
import { UpdateExcelNode } from '@local-n8n/core/src/nodes/core.updateExcel';
import { CreateWordNode } from '@local-n8n/core/src/nodes/core.createWord';
import { TemplateWordNode } from '@local-n8n/core/src/nodes/core.templateWord';
import { CreatePresentationNode } from '@local-n8n/core/src/nodes/core.createPresentation';
import { ExecutionManager } from '@local-n8n/core/src/execution/execution-manager';
import { SchedulerService } from '@local-n8n/core/src/services/scheduler.service';
import { PluginLoader } from '@local-n8n/core/src/execution/plugin-loader';
import { createScopedLogger } from '@local-n8n/core/src/utils/logger';
import * as path from 'path';

const logger = createScopedLogger('api');
import { authMiddleware, validateSocketAuth, isAuthEnabled } from './middleware/auth.middleware';

export function startServer(port: number) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: '*',
        }
    });

    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();
    const credentialService = new CredentialService();
    const eventBus = new EventBus();
    const nodeRegistry = new NodeRegistry();
    const executionManager = new ExecutionManager();

    // Register Nodes
    nodeRegistry.register(new NoOpNode());
    nodeRegistry.register(new SetNode());
    nodeRegistry.register(new IfNode());
    nodeRegistry.register(new FailNode());
    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new MergeNode());
    nodeRegistry.register(new ForEachNode());
    nodeRegistry.register(new HttpRequestNode());
    nodeRegistry.register(new ExecuteWorkflowNode());
    nodeRegistry.register(new WaitNode());
    nodeRegistry.register(new CronTriggerNode());
    nodeRegistry.register(new ReadTextFileNode());
    nodeRegistry.register(new WriteTextFileNode());
    nodeRegistry.register(new AppendTextFileNode());
    nodeRegistry.register(new ReadExcelNode());
    nodeRegistry.register(new CreateExcelNode());
    nodeRegistry.register(new UpdateExcelNode());
    nodeRegistry.register(new CreateWordNode());
    nodeRegistry.register(new TemplateWordNode());
    nodeRegistry.register(new CreatePresentationNode());

    // Initialize Plugin Loader
    const pluginLoader = new PluginLoader(nodeRegistry);
    const pluginsDir = path.join(process.cwd(), 'plugins');

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus, workflowService);

    // Initialize Scheduler Service
    const schedulerService = new SchedulerService(
        workflowService,
        executionService,
        nodeRegistry,
        eventBus
    );

    // Setup WebSocket Namespace with authentication
    const executionsNamespace = io.of('/executions');

    // WebSocket authentication middleware
    executionsNamespace.use((socket, next) => {
        const authHeader = socket.handshake.headers.authorization as string | undefined;
        if (validateSocketAuth(authHeader)) {
            next();
        } else {
            next(new Error('Unauthorized: Invalid or missing API key'));
        }
    });

    executionsNamespace.on('connection', (socket) => {
        console.log('[WS] Client connected to /executions');

        socket.on('subscribe', async (data: { executionId: string }) => {
            const room = `execution:${data.executionId}`;
            socket.join(room);
            console.log(`[WS] Client subscribed to ${room}`);

            // Replay Logic
            try {
                const { db, executions, executionSteps, eq } = await import('@local-n8n/database');

                const execution = await db.select().from(executions).where(eq(executions.id, data.executionId)).get();
                if (execution) {
                    const steps = await db.select().from(executionSteps).where(eq(executionSteps.executionId, data.executionId)).all();

                    socket.emit('execution:replay', {
                        execution,
                        steps
                    });
                    console.log(`[WS] Replayed execution ${data.executionId} (${steps.length} steps)`);
                }
            } catch (error) {
                console.error(`[WS] Replay failed for ${data.executionId}:`, error);
            }
        });
    });

    // Subscribe to EventBus
    eventBus.on('nodeExecuteBefore', (data) => {
        console.log(`[execution:${data.executionId}] node:start ${data.nodeName}`);
        executionsNamespace.to(`execution:${data.executionId}`).emit('execution:event', {
            type: 'node:start',
            executionId: data.executionId,
            nodeId: data.nodeId,
            nodeType: data.nodeName,
            timestamp: new Date().toISOString()
        });
    });
    eventBus.on('nodeExecuteAfter', (data) => {
        console.log(`[execution:${data.executionId}] node:finish ${data.nodeName}`);
        executionsNamespace.to(`execution:${data.executionId}`).emit('execution:event', {
            type: 'node:finish',
            executionId: data.executionId,
            nodeId: data.nodeId,
            nodeType: data.nodeName,
            outputData: data.data,
            timestamp: new Date().toISOString()
        });
    });
    eventBus.on('nodeExecuteError', (data) => {
        console.log(`[execution:${data.executionId}] node:error ${data.nodeName} ${data.error.message}`);
        executionsNamespace.to(`execution:${data.executionId}`).emit('execution:event', {
            type: 'node:error',
            executionId: data.executionId,
            nodeId: data.nodeId,
            nodeType: data.nodeName,
            error: {
                message: data.error.message,
                stack: data.error.stack
            },
            timestamp: new Date().toISOString()
        });
    });
    eventBus.on('executionFinish', (data) => {
        logger.info({ executionId: data.executionId, status: data.status }, 'executionFinished');
        executionsNamespace.to(`execution:${data.executionId}`).emit('execution:event', {
            type: 'execution:finish',
            executionId: data.executionId,
            status: data.status,
            timestamp: new Date().toISOString()
        });
    });

    app.use(express.json());

    app.get('/health', (req, res) => {
        res.json({ status: 'ok', authEnabled: isAuthEnabled() });
    });

    // Apply authentication middleware to all routes below
    app.use(authMiddleware);

    // List all available node types
    app.get('/nodes', (req, res) => {
        try {
            const nodes = nodeRegistry.getAll().map(node => ({
                name: node.description.name,
                displayName: node.description.displayName,
                description: node.description.description,
                group: node.description.group,
                version: node.description.version,
                inputs: node.description.inputs,
                outputs: node.description.outputs,
                isTrigger: node.isTrigger || false,
                properties: node.description.properties
            }));
            res.json(nodes);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/workflows', async (req, res) => {
        try {
            const workflows = await workflowService.listWorkflows();
            res.json(workflows);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/workflows/:id', async (req, res) => {
        try {
            const workflow = await workflowService.getWorkflow(req.params.id);
            if (!workflow) {
                return res.status(404).json({ error: 'Workflow not found' });
            }
            res.json(workflow);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/workflows', async (req, res) => {
        try {
            const workflow = await workflowService.createWorkflow(req.body);
            res.json(workflow);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/workflows/:id', async (req, res) => {
        try {
            const workflow = await workflowService.updateWorkflow(req.params.id, req.body);
            res.json(workflow);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/workflows/:id', async (req, res) => {
        try {
            await workflowService.deleteWorkflow(req.params.id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/workflows/:id/versions', async (req, res) => {
        try {
            const versions = await workflowService.listWorkflowVersions(req.params.id);
            res.json(versions);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/workflows/:id/versions/:versionId/rollback', async (req, res) => {
        try {
            const workflow = await workflowService.rollback(req.params.id, req.params.versionId);
            res.json(workflow);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/executions/canvas', async (req, res) => {
        try {
            const { workflow } = req.body;

            if (!workflow) {
                return res.status(400).json({ error: 'Workflow data is required' });
            }

            // Validate node types exist in registry
            if (workflow.nodes && Array.isArray(workflow.nodes)) {
                for (const node of workflow.nodes) {
                    if (!nodeRegistry.get(node.type)) {
                        return res.status(400).json({
                            error: `Unknown node type: ${node.type}`,
                            nodeId: node.id,
                            nodeType: node.type
                        });
                    }
                }
            }

            // Create Execution
            const latestVersion = await workflowService.getLatestWorkflowVersion(workflow.id || 'canvas-temp');
            const execution = await executionService.createExecution({
                workflowId: workflow.id || 'canvas-temp',
                workflowVersionId: latestVersion?.id,
                mode: 'canvas',
                workflowSnapshot: workflow,
            });

            if (!execution) {
                return res.status(500).json({ error: 'Failed to create execution' });
            }

            // 3. Trigger Async Execution
            const controller = new AbortController();
            executionManager.register(execution.id, controller);

            engine.run(execution.id, workflow, undefined, controller.signal)
                .catch(err => {
                    console.error(`[AsyncExec] Canvas Execution ${execution.id} failed:`, err);
                })
                .finally(() => {
                    executionManager.unregister(execution.id);
                });

            res.json({ executionId: execution.id, status: 'started' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/executions/:workflowId', async (req, res) => {
        try {
            const { workflowId } = req.params;

            // 1. Validate Workflow
            const workflow = await workflowService.getWorkflow(workflowId);
            if (!workflow) {
                return res.status(404).json({ error: 'Workflow not found' });
            }

            // 2. Create Execution
            const latestVersion = await workflowService.getLatestWorkflowVersion(workflowId);
            const execution = await executionService.createExecution({
                workflowId: workflow.id,
                workflowVersionId: latestVersion?.id,
                mode: 'api',
                workflowSnapshot: workflow,
            });

            if (!execution) {
                return res.status(500).json({ error: 'Failed to create execution' });
            }

            // 3. Trigger Async Execution
            const controller = new AbortController();
            executionManager.register(execution.id, controller);

            engine.run(execution.id, workflow, undefined, controller.signal)
                .catch(err => {
                    console.error(`[AsyncExec] Execution ${execution.id} failed:`, err);
                })
                .finally(() => {
                    executionManager.unregister(execution.id);
                });

            res.json({ executionId: execution.id, status: 'started' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/executions/:id/cancel', async (req, res) => {
        const { id } = req.params;
        const success = executionManager.cancel(id);
        if (success) {
            res.json({ status: 'canceling' });
        } else {
            res.status(404).json({ error: 'Execution not found or already finished' });
        }
    });

    // Credential Endpoints
    app.post('/credentials', async (req, res) => {
        try {
            const { name, type, data } = req.body;

            if (!name || !type || !data) {
                return res.status(400).json({ error: 'name, type, and data are required' });
            }

            const credential = await credentialService.createCredential({ name, type, data });

            // Return masked data
            const masked = await credentialService.getCredentialById(credential.id, false);
            res.json(masked);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/credentials', async (req, res) => {
        try {
            const credentials = await credentialService.listCredentials();
            res.json(credentials);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/credentials/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const credential = await credentialService.getCredentialById(id, false);

            if (!credential) {
                return res.status(404).json({ error: 'Credential not found' });
            }

            res.json(credential);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/credentials/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { name, type, data } = req.body;

            const updateData: any = {};
            if (name !== undefined) updateData.name = name;
            if (type !== undefined) updateData.type = type;
            if (data !== undefined) updateData.data = data;

            const credential = await credentialService.updateCredential(id, updateData);

            if (!credential) {
                return res.status(404).json({ error: 'Credential not found' });
            }

            // Return masked data
            const masked = await credentialService.getCredentialById(credential.id, false);
            res.json(masked);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Scheduler Endpoints
    app.get('/scheduler/jobs', (req, res) => {
        try {
            const jobs = schedulerService.getScheduledJobs();
            res.json(jobs);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/scheduler/reload', async (req, res) => {
        try {
            await schedulerService.reload();
            res.json({ status: 'reloaded', jobs: schedulerService.getScheduledJobs().length });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    const httpServer = server.listen(port, async () => {
        logger.info({ port }, 'API server started');
        // Load custom plugins
        const pluginResult = await pluginLoader.loadFromDirectory(pluginsDir);
        logger.info({ pluginCount: pluginResult.loaded.length }, 'pluginsLoaded');
        // Start scheduler after server is ready
        await schedulerService.start();

        // RUN RECOVERY LOGIC
        logger.info('crashRecoveryStarting');
        try {
            const activeExecutions = await executionService.listActiveExecutions();
            logger.info({ activeCount: activeExecutions.length }, 'recoveryFoundExecutions');

            for (const execution of activeExecutions) {
                // If it's WAITING (has waitingUntil), we let scheduler handle it or resume if overdue
                // For now, since we marked them 'running', we mark them 'error' if they don't have recovery logic
                // Wait Node Recovery:
                if (execution.waitingUntil) {
                    const resumeDate = new Date(execution.waitingUntil as number);
                    if (resumeDate <= new Date()) {
                        logger.info({ executionId: execution.id }, 'recoveryResumingOverdueExecution');
                        // Logic to resume would go here. For Phase 1.3 requirement:
                        // "WAITING -> reagendar"
                        // Since we just have a simple engine, we'll mark them for re-execution if possible or failed.
                    }
                }

                logger.info({ executionId: execution.id }, 'recoveryMarkingFailed');
                await executionService.updateExecutionStatus(execution.id, 'error', {
                    error: 'Execution interrupted by system restart. Partial state preserved.',
                    currentNodeId: execution.currentNodeId,
                    iterationIndex: execution.iterationIndex
                });
            }
        } catch (error: any) {
            logger.error({ error: error.message }, 'recoveryFailed');
        }
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        logger.info('sigtermReceived');
        await schedulerService.stop();
        httpServer.close();
    });

    process.on('SIGINT', async () => {
        logger.info('sigintReceived');
        await schedulerService.stop();
        httpServer.close();
    });

    return httpServer;
}

// Auto-start if run directly
if (require.main === module) {
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    startServer(PORT);
}
