"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionEngine = void 0;
const node_execution_context_1 = require("./node-execution-context");
const expression_resolver_1 = require("./expression-resolver");
const retry_policy_1 = require("./retry-policy");
class ExecutionEngine {
    constructor(executionService, nodeRegistry, eventBus, workflowService) {
        this.executionService = executionService;
        this.nodeRegistry = nodeRegistry;
        this.eventBus = eventBus;
        this.workflowService = workflowService;
    }
    async run(executionId, workflow, initialData, signal) {
        const nodeOutputs = new Map(); // nodeId -> iterationIndex -> data
        const nodeInputs = new Map(); // nodeId -> iterationIndex -> inputIndex -> data
        const nodeVisitCounts = new Map(); // nodeId -> count for loop protection
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
        let timeoutTimer;
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
        const finalNodes = new Set(workflow.nodes.map((n) => n.id));
        if (workflow.connections) {
            for (const sourceNodeId in workflow.connections) {
                finalNodes.delete(sourceNodeId);
            }
        }
        // Pre-calculate expected inputs for all nodes
        const expectedInputs = new Map();
        if (workflow.connections) {
            for (const sourceNodeId in workflow.connections) {
                const outputs = workflow.connections[sourceNodeId];
                if (outputs.main) {
                    outputs.main.forEach((connections) => {
                        connections.forEach((conn) => {
                            if (!expectedInputs.has(conn.node)) {
                                expectedInputs.set(conn.node, new Set());
                            }
                            expectedInputs.get(conn.node).add(conn.index);
                        });
                    });
                }
            }
        }
        // Queue for graph traversal
        // Items: { nodeId, inputData, inputIndex, iterationIndex }
        const executionQueue = [];
        // Detect trigger nodes
        const triggerNodes = workflow.nodes.filter((n) => {
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
            if (!triggerStep)
                throw new Error(`Failed to create execution step for trigger ${trigger.id}`);
            try {
                this.eventBus.emitNodeExecuteBefore(trigger.type, executionId, trigger.id);
                const triggerType = this.nodeRegistry.get(trigger.type);
                if (!triggerType)
                    throw new Error(`Trigger type ${trigger.type} not found`);
                const context = new node_execution_context_1.NodeExecutionContext(initialData || {}, trigger, undefined, undefined, async (state) => {
                    await this.executionService.updateExecutionState(executionId, state);
                }, internalController.signal);
                let outputData = {};
                metrics.nodeCount++;
                if (triggerType.executable !== false) {
                    outputData = await triggerType.execute(context);
                }
                metrics.successCount++;
                // Normalize output
                let outputs = [];
                if (Array.isArray(outputData)) {
                    if (outputData.length > 0 && Array.isArray(outputData[0])) {
                        outputs = outputData;
                    }
                    else {
                        outputs = [outputData];
                    }
                }
                else {
                    outputs = [[outputData]];
                }
                // Store output
                if (!nodeOutputs.has(trigger.id)) {
                    nodeOutputs.set(trigger.id, new Map());
                }
                nodeOutputs.get(trigger.id).set(0, outputs[0]);
                this.eventBus.emitNodeExecuteAfter(trigger.type, executionId, trigger.id, outputData);
                await this.executionService.updateExecutionStep(triggerStep.id, {
                    status: 'success',
                    outputData,
                });
                // Find connected nodes and add to queue
                if (workflow.connections && workflow.connections[trigger.id]) {
                    const connections = workflow.connections[trigger.id];
                    // Trigger usually has 'main' output at index 0
                    if (connections.main && connections.main[0]) {
                        const outputBranch = outputs[0] || [];
                        connections.main[0].forEach((conn) => {
                            executionQueue.push({
                                nodeId: conn.node,
                                inputData: outputBranch,
                                inputIndex: conn.index,
                                iterationIndex: undefined
                            });
                        });
                    }
                }
            }
            catch (error) {
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
                    error.isCancellation = true;
                    throw error;
                }
                const { nodeId, inputData, inputIndex, iterationIndex } = executionQueue.shift();
                // Persist state for crash recovery
                await this.executionService.updateExecutionState(executionId, {
                    currentNodeId: nodeId,
                    iterationIndex: iterationIndex ?? 0,
                });
                const node = workflow.nodes.find((n) => n.id === nodeId);
                if (!node)
                    continue;
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
                if (!nodeInputs.get(nodeId).has(iterKey)) {
                    nodeInputs.get(nodeId).set(iterKey, new Map());
                }
                nodeInputs.get(nodeId).get(iterKey).set(inputIndex, inputData);
                // Check if ready (all expected inputs present for THIS iteration)
                const expected = expectedInputs.get(nodeId) || new Set([0]);
                const received = nodeInputs.get(nodeId).get(iterKey);
                let ready = true;
                for (const index of expected) {
                    if (!received.has(index)) {
                        ready = false;
                        break;
                    }
                }
                if (!ready)
                    continue;
                // Prepare inputs for execution
                const allInputs = [];
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
                if (!step)
                    throw new Error(`Failed to create execution step for node ${node.id}`);
                let currentStepId = step.id;
                try {
                    // Emit Before Event
                    this.eventBus.emitNodeExecuteBefore(node.type, executionId, node.id);
                    // Build expression context
                    const expressionContext = {
                        $json: Array.isArray(allInputs[0]) && allInputs[0].length === 1 ? allInputs[0][0] : allInputs[0], // Primary input for expressions
                        $execution: {
                            id: executionId,
                            mode: workflow.mode || 'manual'
                        },
                        $node: Object.fromEntries(Array.from(nodeOutputs.entries()).map(([nId, iterations]) => [
                            nId,
                            { json: iterations.get(iterationIndex ?? -1) || iterations.get(-1) || [] },
                        ])),
                        $item: iterationIndex !== undefined ? allInputs[0][0] : undefined,
                        $index: iterationIndex,
                    };
                    // Resolve node parameters
                    const rawParameters = node.parameters ?? {};
                    const parameters = (0, expression_resolver_1.resolveExpressions)(rawParameters, expressionContext);
                    // Create node with resolved parameters
                    const nodeWithResolvedParams = {
                        ...node,
                        parameters
                    };
                    // 2. Execute Node
                    // Check for dead path (empty input) - Skip execution unless it's a Merge node
                    const isMerge = expected.size > 1 || node.type === 'core.merge' || node.type === 'Merge';
                    const isInputEmpty = Array.isArray(allInputs[0]) && allInputs[0].length === 0;
                    let rawOutput;
                    let success = false;
                    let lastError;
                    let attempts = 0;
                    const retryConfig = parameters.retryConfig || {};
                    const maxRetries = retryConfig.maxRetries || 0;
                    const backoffMs = retryConfig.backoffMs || 0;
                    const onError = retryConfig.onError || 'stop';
                    if (isInputEmpty && !isMerge) {
                        // Dead path propagation
                        rawOutput = [];
                        success = true;
                    }
                    else {
                        while (attempts <= maxRetries) {
                            try {
                                metrics.nodeCount++;
                                const executeWorkflowCallback = async (subWorkflowId, subInput) => {
                                    const subWorkflow = await this.workflowService.getWorkflow(subWorkflowId);
                                    if (!subWorkflow)
                                        throw new Error(`Subworkflow ${subWorkflowId} not found`);
                                    const subExecution = await this.executionService.createExecution({
                                        workflowId: subWorkflowId,
                                        mode: 'manual',
                                        workflowSnapshot: subWorkflow
                                    });
                                    if (!subExecution)
                                        throw new Error(`Failed to create execution for subworkflow ${subWorkflowId}`);
                                    const subEngine = new ExecutionEngine(this.executionService, this.nodeRegistry, this.eventBus, this.workflowService);
                                    return subEngine.run(subExecution.id, subWorkflow, subInput, internalController.signal);
                                };
                                const context = new node_execution_context_1.NodeExecutionContext(allInputs[0], nodeWithResolvedParams, allInputs, executeWorkflowCallback, async (state) => {
                                    await this.executionService.updateExecutionState(executionId, state);
                                }, internalController.signal);
                                rawOutput = await nodeType.execute(context);
                                success = true;
                                metrics.successCount++;
                                break;
                            }
                            catch (error) {
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
                                        await (0, retry_policy_1.wait)(backoffMs);
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
                        }
                        else {
                            throw lastError;
                        }
                    }
                    // Normalize output to INodeExecutionData[][]
                    let outputs = [];
                    if (Array.isArray(rawOutput)) {
                        if (rawOutput.length > 0 && Array.isArray(rawOutput[0])) {
                            outputs = rawOutput;
                        }
                        else {
                            outputs = [rawOutput];
                        }
                    }
                    else {
                        outputs = [[rawOutput]];
                    }
                    // Store output (using first output for $node reference)
                    if (!nodeOutputs.has(node.id)) {
                        nodeOutputs.set(node.id, new Map());
                    }
                    nodeOutputs.get(node.id).set(iterationIndex ?? -1, outputs[0]);
                    // Emit After Event
                    this.eventBus.emitNodeExecuteAfter(node.type, executionId, node.id, rawOutput);
                    // 3. Update Step (Success) - only if we didn't already update it for 'continue'
                    if (success && onError !== 'continue' || (success && attempts === 0)) {
                        await this.executionService.updateExecutionStep(currentStepId, {
                            status: 'success',
                            outputData: rawOutput,
                        });
                    }
                    // Handle Branching / Next Nodes
                    if (workflow.connections && workflow.connections[node.id]) {
                        const nodeConnections = workflow.connections[node.id];
                        // Iterate over outputs (main)
                        if (nodeConnections.main) {
                            nodeConnections.main.forEach((connections, outputIndex) => {
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
                                }
                                else {
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
                }
                catch (error) {
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
                    const status = isCancellation ? 'canceled' : 'error';
                    await this.executionService.updateExecutionStatus(executionId, status, metrics);
                    this.eventBus.emitExecutionFinish(executionId, status);
                    throw error;
                }
            }
            // Success execution
            metrics.executionTimeMs = Date.now() - startTime;
            await this.executionService.updateExecutionStatus(executionId, 'success', metrics);
            this.eventBus.emitExecutionFinish(executionId, 'success');
            // Collect final outputs
            const finalOutputs = [];
            for (const nodeId of finalNodes) {
                const outputs = nodeOutputs.get(nodeId);
                if (outputs) {
                    // Merge all iteration outputs for this node
                    for (const iterationOutput of outputs.values()) {
                        if (Array.isArray(iterationOutput)) {
                            finalOutputs.push(...iterationOutput);
                        }
                        else {
                            finalOutputs.push(iterationOutput);
                        }
                    }
                }
            }
            return finalOutputs;
        }
        finally {
            if (timeoutTimer)
                clearTimeout(timeoutTimer);
        }
    }
}
exports.ExecutionEngine = ExecutionEngine;
