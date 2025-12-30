"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeExecutionContext = void 0;
const binary_data_service_1 = require("../services/binary-data.service");
class NodeExecutionContext {
    constructor(inputData, node, allInputs = [inputData], executeWorkflowCallback, updateExecutionStateCallback, signal) {
        this.inputData = inputData;
        this.node = node;
        this.allInputs = allInputs;
        this.executeWorkflowCallback = executeWorkflowCallback;
        this.updateExecutionStateCallback = updateExecutionStateCallback;
        this.signal = signal;
        this.binaryDataService = new binary_data_service_1.BinaryDataService();
    }
    getInputData() {
        return this.inputData;
    }
    getInputs() {
        return this.allInputs;
    }
    getNodeParameter(name, defaultValue) {
        if (this.node.parameters && this.node.parameters[name] !== undefined) {
            return this.node.parameters[name];
        }
        return defaultValue;
    }
    async executeWorkflow(workflowId, inputData) {
        if (!this.executeWorkflowCallback) {
            throw new Error('executeWorkflow is not supported in this context');
        }
        return this.executeWorkflowCallback(workflowId, inputData);
    }
    async updateExecutionState(data) {
        if (this.updateExecutionStateCallback) {
            await this.updateExecutionStateCallback(data);
        }
    }
    async getBinaryData(key) {
        const inputData = this.getInputData();
        if (!inputData?.binary?.[key]) {
            throw new Error(`Binary data with key '${key}' not found in input`);
        }
        return this.binaryDataService.retrieveBinaryData(inputData.binary[key]);
    }
    async setBinaryData(key, data, options) {
        const binaryData = await this.binaryDataService.storeBinaryData(data, options);
        // Attach to input data for downstream nodes
        const inputData = this.getInputData() || {};
        if (!inputData.binary) {
            inputData.binary = {};
        }
        inputData.binary[key] = binaryData;
        return binaryData;
    }
}
exports.NodeExecutionContext = NodeExecutionContext;
