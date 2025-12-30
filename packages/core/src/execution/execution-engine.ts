import { ExecutionService } from '../services/execution.service';
import { WorkflowService } from '../services/workflow.service';
import { NodeRegistry } from './node-registry';
import { EventBus } from './event-bus';
import { NodeExecutionContext } from './node-execution-context';
import { resolveExpressions, type ExpressionContext } from './expression-resolver';
import { wait } from './retry-policy';
import { normalizeNodeOutput } from './output-normalizer';
import { INodeExecutionData } from './node-interfaces';

export class ExecutionEngine {
    private executionService: ExecutionService;
    private workflowService: WorkflowService;
    private nodeRegistry: NodeRegistry;
    private eventBus: EventBus;

    constructor(executionService: ExecutionService, nodeRegistry: NodeRegistry, eventBus: EventBus, workflowService: WorkflowService) {
        this.executionService = executionService;
        this.nodeRegistry = nodeRegistry;
        this.eventBus = eventBus;
        this.workflowService = workflowService;
    }

    async run(executionId: string, workflow: any, initialData?: any, signal?: AbortSignal): Promise<any> {
        const nodeOutputs: Map<string, Map<number, any>> = new Map(); // nodeId -> iterationIndex -> data
        const nodeInputs: Map<string, Map<number, Map<number, any>>> = new Map(); // nodeId -> iterationIndex -> inputIndex -> data
        const nodeVisitCounts: Map<string, number> = new Map(); // nodeId -> count for loop protection
        const maxNodes = workflow.settings?.maxNodesPerExecution || 1000;

        const startTime = Date.now();
        const metrics = {
            executionTimeMs: 0,
            nodeCount: 0,
            successCount: 0,
            errorCount: 0,
            retryCount: 0,
        };

        const internalController = new AbortController();
        const timeout = workflow.settings?.executionTimeout || 0;
        let timeoutTimer: NodeJS.Timeout | undefined;

        if (timeout > 0) {
            timeoutTimer = setTimeout(() => {
                internalController.abort();
            }, timeout);
        }

        if (signal) {
            signal.addEventListener('abort', () => {
                internalController.abort();
            });
        }

        // Pre-calculate final nodes (nodes with no outgoing connections)
        const finalNodes = new Set<string>(workflow.nodes.map((n: any) => n.id));
        if (workflow.connections) {
            for (const sourceNodeId in workflow.connections) {
                finalNodes.delete(sourceNodeId);
            }
        }

        // Pre-calculate expected inputs for all nodes
        const expectedInputs: Map<string, Set<number>> = new Map();
        if (workflow.connections) {
            for (const sourceNodeId in workflow.connections) {
                const outputs = workflow.connections[sourceNodeId];
                if (outputs.main) {
                    outputs.main.forEach((connections: any[]) => {
                        connections.forEach((conn: any) => {
                            if (!expectedInputs.has(conn.node)) {
                                expectedInputs.set(conn.node, new Set());
                            }
                            expectedInputs.get(conn.node)!.add(conn.index);
                        });
                    });
                }
            }
        }

        // Queue for graph traversal
        // Items: { nodeId, inputData, inputIndex, iterationIndex }
        const executionQueue: { nodeId: string; inputData: any; inputIndex: number; iterationIndex?: number }[] = [];

        // Detect trigger nodes
        const triggerNodes = workflow.nodes.filter((n: any) => {
            const nodeType = this.nodeRegistry.get(n.type);
            return nodeType?.isTrigger === true;
        });

        // Validate: max one trigger
        if (triggerNodes.length > 1) {
            const error = new Error('Workflow cannot have multiple trigger nodes');
            await this.executionService.updateExecutionStatus(executionId, 'error');
            this.eventBus.emitExecutionFinish(executionId, 'error');
            throw error;
        }

        if (triggerNodes.length === 1) {
            const trigger = triggerNodes[0];

            // 1. Create Step for Trigger
            const triggerStep = await this.executionService.createExecutionStep({
                executionId,
                nodeId: trigger.id,
                inputData: {},
            });

            if (!triggerStep) throw new Error(`Failed to create execution step for trigger ${trigger.id}`);

            try {
                this.eventBus.emitNodeExecuteBefore(trigger.type, executionId, trigger.id);

                const triggerType = this.nodeRegistry.get(trigger.type);
                if (!triggerType) throw new Error(`Trigger type ${trigger.type} not found`);

                const context = new NodeExecutionContext(
                    initialData || {},
                    trigger,
                    undefined,
                    undefined,
                    async (state) => {
                        await this.executionService.updateExecutionState(executionId, state);
                    },
                    internalController.signal
                );

                let outputData: any = {};
                metrics.nodeCount++;
                if (triggerType.executable !== false) {
                    outputData = await triggerType.execute(context);
                }
                metrics.successCount++;

                // Normalize output
                const normalizedOutput = normalizeNodeOutput(outputData);
                const outputs: INodeExecutionData[][] = [normalizedOutput];
                const normalizedResult = outputs.length === 1 ? outputs[0] : outputs;

                // Store output
                if (!nodeOutputs.has(trigger.id)) {
                    nodeOutputs.set(trigger.id, new Map());
                }
                nodeOutputs.get(trigger.id)!.set(0, outputs[0]);

                this.eventBus.emitNodeExecuteAfter(trigger.type, executionId, trigger.id, normalizedResult);

                await this.executionService.updateExecutionStep(triggerStep.id, {
                    status: 'success',
                    outputData: normalizedResult,
                });

                // Find connected nodes and add to queue
                if (workflow.connections && workflow.connections[trigger.id]) {
                    const connections = workflow.connections[trigger.id];
                    // Trigger usually has 'main' output at index 0
                    if (connections.main && connections.main[0]) {
                        const outputBranch = outputs[0] || [];
                        connections.main[0].forEach((conn: any) => {
                            executionQueue.push({
                                nodeId: conn.node,
                                inputData: outputBranch,
                                inputIndex: conn.index,
                                iterationIndex: undefined
                            });
                        });
                    }
                }

            } catch (error: any) {
                this.eventBus.emitNodeExecuteError(trigger.type, executionId, trigger.id, error);
                await this.executionService.updateExecutionStep(triggerStep.id, { status: 'error', error: error.message });
                metrics.errorCount++;
                metrics.executionTimeMs = Date.now() - startTime;
                await this.executionService.updateExecutionStatus(executionId, 'error', metrics);
                this.eventBus.emitExecutionFinish(executionId, 'error');
                throw error;
            }
        }


        // Process Queue
        try {
            while (executionQueue.length > 0) {
                if (signal?.aborted || internalController.signal.aborted) {
                    const error = new Error(internalController.signal.aborted ? 'Execution timed out' : 'Execution canceled');
                    (error as any).isCancellation = true;
                    throw error;
                }

                const { nodeId, inputData, inputIndex, iterationIndex } = executionQueue.shift()!;

                // Persist state for crash recovery
                await this.executionService.updateExecutionState(executionId, {
                    currentNodeId: nodeId,
                    iterationIndex: iterationIndex ?? 0,
                });

                const node = workflow.nodes.find((n: any) => n.id === nodeId);
                if (!node) continue;

                // Loop protection: Check if node has been visited too many times
                const visitCount = (nodeVisitCounts.get(nodeId) || 0) + 1;
                nodeVisitCounts.set(nodeId, visitCount);
                if (visitCount > 100) { // Max visits per node
                    throw new Error(`Loop protection triggered: Node ${node.id} executed ${visitCount} times.`);
                }

                // Overall limit
                if (metrics.nodeCount >= maxNodes) {
                    throw new Error(`Execution limit reached: Max nodes (${maxNodes}) exceeded.`);
                }

                // Store input
                if (!nodeInputs.has(nodeId)) {
                    nodeInputs.set(nodeId, new Map());
                }
                const iterKey = iterationIndex ?? -1;
                if (!nodeInputs.get(nodeId)!.has(iterKey)) {
                    nodeInputs.get(nodeId)!.set(iterKey, new Map());
                }
                nodeInputs.get(nodeId)!.get(iterKey)!.set(inputIndex, inputData);

                // Check if ready (all expected inputs present for THIS iteration)
                const expected = expectedInputs.get(nodeId) || new Set([0]);
                const received = nodeInputs.get(nodeId)!.get(iterKey)!;

                let ready = true;
                for (const index of expected) {
                    if (!received.has(index)) {
                        ready = false;
                        break;
                    }
                }

                if (!ready) continue;

                // Prepare inputs for execution
                const allInputs: any[][] = [];
                const maxIndex = Math.max(...Array.from(expected), 0);
                for (let i = 0; i <= maxIndex; i++) {
                    allInputs[i] = received.get(i) || [];
                }

                // Resolve Node Type
                const nodeType = this.nodeRegistry.get(node.type);
                if (!nodeType) {
                    const error = new Error(`Node type ${node.type} not found`);
                    this.eventBus.emitNodeExecuteError(node.type, executionId, node.id, error);
                    await this.executionService.updateExecutionStatus(executionId, 'error');
                    this.eventBus.emitExecutionFinish(executionId, 'error');
                    return;
                }

                // 1. Create Step
                const step = await this.executionService.createExecutionStep({
                    executionId,
                    nodeId: node.id,
                    inputData: allInputs[0], // Log primary input
                });

                if (!step) throw new Error(`Failed to create execution step for node ${node.id}`);

                let currentStepId = step.id;
                try {
                    // Emit Before Event
                    this.eventBus.emitNodeExecuteBefore(node.type, executionId, node.id);

                    // Build expression context
                    const $node: Record<string, any> = {};
                    for (const [id, iterations] of nodeOutputs.entries()) {
                        const targetNode = workflow.nodes.find((n: any) => n.id === id);
                        const label = targetNode?.label || targetNode?.name || id;
                        const all = iterations.get(iterationIndex ?? -1) || iterations.get(-1) || [];
                        const first = all[0] || { json: {}, binary: {} };

                        $node[label] = {
                            json: first.json,
                            binary: first.binary || {},
                            all: all
                        };
                    }

                    const expressionContext: ExpressionContext = {
                        $json: (Array.isArray(allInputs[0]) && allInputs[0].length > 0) ? (allInputs[0][0].json || allInputs[0][0]) : {},
                        $execution: {
                            id: executionId,
                            mode: workflow.mode || 'manual'
                        },
                        $node,
                        $item: iterationIndex !== undefined ? allInputs[0][0] : undefined,
                        $index: iterationIndex,
                    };

                    // Resolve node parameters
                    const rawParameters = node.parameters ?? {};
                    const parameters = resolveExpressions(rawParameters, expressionContext);

                    // Create node with resolved parameters
                    const nodeWithResolvedParams = {
                        ...node,
                        parameters
                    };

                    // 2. Execute Node
                    // Check for dead path (empty input) - Skip execution unless it's a Merge node
                    const isMerge = expected.size > 1 || node.type === 'core.merge' || node.type === 'Merge';
                    const isInputEmpty = Array.isArray(allInputs[0]) && allInputs[0].length === 0;

                    let rawOutput: any;
                    let success = false;
                    let lastError: any;
                    let attempts = 0;

                    const retryConfig = parameters.retryConfig || {};
                    const maxRetries = retryConfig.maxRetries || 0;
                    const backoffMs = retryConfig.backoffMs || 0;
                    const onError = retryConfig.onError || 'stop';

                    if (isInputEmpty && !isMerge) {
                        // Dead path propagation
                        rawOutput = [];
                        success = true;
                    } else if (node.isPinned || node.data?.isPinned) {
                        // Use pinned data
                        rawOutput = node.pinnedData || node.data?.pinnedData || [];
                        success = true;
                        metrics.successCount++;
                    } else {
                        while (attempts <= maxRetries) {
                            try {
                                metrics.nodeCount++;
                                const executeWorkflowCallback = async (subWorkflowId: string, subInput: any) => {
                                    const subWorkflow = await this.workflowService.getWorkflow(subWorkflowId);
                                    if (!subWorkflow) throw new Error(`Subworkflow ${subWorkflowId} not found`);

                                    const subExecution = await this.executionService.createExecution({
                                        workflowId: subWorkflowId,
                                        mode: 'manual',
                                        workflowSnapshot: subWorkflow
                                    });
                                    if (!subExecution) throw new Error(`Failed to create execution for subworkflow ${subWorkflowId}`);
                                    const subEngine = new ExecutionEngine(this.executionService, this.nodeRegistry, this.eventBus, this.workflowService);
                                    return subEngine.run(subExecution.id, subWorkflow, subInput, internalController.signal);
                                };

                                const context = new NodeExecutionContext(
                                    allInputs[0],
                                    nodeWithResolvedParams,
                                    allInputs,
                                    executeWorkflowCallback,
                                    async (state) => {
                                        await this.executionService.updateExecutionState(executionId, state);
                                    },
                                    internalController.signal
                                );
                                rawOutput = await nodeType.execute(context);
                                success = true;
                                metrics.successCount++;
                                break;
                            } catch (error: any) {
                                lastError = error;
                                attempts++;
                                metrics.retryCount++;

                                if (attempts <= maxRetries) {
                                    // Update current step as error and record attempt
                                    await this.executionService.updateExecutionStep(currentStepId, {
                                        status: 'error',
                                        error: `Attempt ${attempts} failed: ${error.message}`,
                                    });

                                    // Wait for backoff
                                    if (backoffMs > 0) {
                                        await wait(backoffMs);
                                    }

                                    // Create new step for next attempt
                                    const nextStep = await this.executionService.createExecutionStep({
                                        executionId,
                                        nodeId: node.id,
                                        inputData: allInputs[0],
                                    });
                                    if (nextStep) {
                                        currentStepId = nextStep.id;
                                    }
                                }
                            }
                        }
                    }

                    if (!success) {
                        if (onError === 'continue') {
                            rawOutput = [];
                            success = true;
                            // Mark the last attempt as success (with empty output) to continue
                            await this.executionService.updateExecutionStep(currentStepId, {
                                status: 'success',
                                outputData: rawOutput,
                            });
                        } else {
                            throw lastError;
                        }
                    }

                    // Normalize output
                    let outputs: INodeExecutionData[][] = [];
                    if (Array.isArray(rawOutput) && rawOutput.length > 0 && Array.isArray(rawOutput[0])) {
                        outputs = rawOutput.map(out => normalizeNodeOutput(out));
                    } else {
                        outputs = [normalizeNodeOutput(rawOutput)];
                    }

                    // Store output (using first output for $node reference)
                    if (!nodeOutputs.has(node.id)) {
                        nodeOutputs.set(node.id, new Map());
                    }
                    nodeOutputs.get(node.id)!.set(iterationIndex ?? -1, outputs[0]);

                    // Emit After Event
                    const normalizedResult = outputs.length === 1 ? outputs[0] : outputs;
                    this.eventBus.emitNodeExecuteAfter(node.type, executionId, node.id, normalizedResult);

                    // 3. Update Step (Success) - only if we didn't already update it for 'continue'
                    if (success && onError !== 'continue' || (success && attempts === 0)) {
                        await this.executionService.updateExecutionStep(currentStepId, {
                            status: 'success',
                            outputData: normalizedResult,
                        });
                    }

                    // Handle Branching / Next Nodes
                    if (workflow.connections && workflow.connections[node.id]) {
                        const nodeConnections = workflow.connections[node.id];

                        // Iterate over outputs (main)
                        if (nodeConnections.main) {
                            nodeConnections.main.forEach((connections: any[], outputIndex: number) => {
                                const outputBranch = outputs[outputIndex] || [];

                                if (node.type === 'core.forEach' && outputIndex === 0) {
                                    // ForEach node: spawn multiple iterations for the first output
                                    outputBranch.forEach((item, index) => {
                                        connections.forEach(conn => {
                                            executionQueue.push({
                                                nodeId: conn.node,
                                                inputData: [item],
                                                inputIndex: conn.index,
                                                iterationIndex: index
                                            });
                                        });
                                    });
                                } else {
                                    // Normal node or non-loop output: propagate current iterationIndex
                                    connections.forEach(conn => {
                                        executionQueue.push({
                                            nodeId: conn.node,
                                            inputData: outputBranch,
                                            inputIndex: conn.index,
                                            iterationIndex: iterationIndex
                                        });
                                    });
                                }
                            });
                        }
                    }

                } catch (error: any) {
                    // Emit Error Event
                    this.eventBus.emitNodeExecuteError(node.type, executionId, node.id, error);

                    // 4. Update Step (Error)
                    await this.executionService.updateExecutionStep(currentStepId, {
                        status: 'error',
                        error: error.message,
                    });

                    // Fail execution
                    metrics.errorCount++;
                    metrics.executionTimeMs = Date.now() - startTime;
                    const isCancellation = error.isCancellation || internalController.signal.aborted;
                    if (isCancellation) {
                        error.isCancellation = true;
                    }
                    const status: 'error' | 'canceled' = isCancellation ? 'canceled' : 'error';
                    await this.executionService.updateExecutionStatus(executionId, status as any, metrics);
                    this.eventBus.emitExecutionFinish(executionId, status);
                    throw error;
                }
            }

            // Success execution
            metrics.executionTimeMs = Date.now() - startTime;
            await this.executionService.updateExecutionStatus(executionId, 'success', metrics);
            this.eventBus.emitExecutionFinish(executionId, 'success');

            // Collect final outputs
            const finalOutputs: any[] = [];
            for (const nodeId of finalNodes) {
                const outputs = nodeOutputs.get(nodeId);
                if (outputs) {
                    // Merge all iteration outputs for this node
                    for (const iterationOutput of outputs.values()) {
                        if (Array.isArray(iterationOutput)) {
                            finalOutputs.push(...iterationOutput);
                        } else {
                            finalOutputs.push(iterationOutput);
                        }
                    }
                }
            }
            return finalOutputs;
        } finally {
            if (timeoutTimer) clearTimeout(timeoutTimer);
        }
    }
}
