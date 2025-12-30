"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteWorkflowNode = void 0;
class ExecuteWorkflowNode {
    constructor() {
        this.description = {
            displayName: 'Execute Workflow',
            name: 'core.executeWorkflow',
            group: ['transform'],
            version: 1,
            description: 'Execute another workflow',
            defaults: {
                name: 'Execute Workflow',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Workflow ID',
                    name: 'workflowId',
                    type: 'string',
                    default: '',
                    required: true,
                },
            ],
        };
    }
    async execute(context) {
        const workflowId = context.getNodeParameter('workflowId', '');
        const inputData = context.getInputData();
        // Pass the first item of input data as subworkflow input
        // or the whole array if preferred. n8n usually passes the current item.
        const subInput = Array.isArray(inputData) && inputData.length > 0 ? inputData[0] : {};
        const result = await context.executeWorkflow(workflowId, subInput);
        return result;
    }
}
exports.ExecuteWorkflowNode = ExecuteWorkflowNode;
