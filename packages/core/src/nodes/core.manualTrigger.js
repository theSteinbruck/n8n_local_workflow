"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualTriggerNode = void 0;
class ManualTriggerNode {
    constructor() {
        this.description = {
            displayName: 'Manual Trigger',
            name: 'ManualTrigger',
            group: ['trigger'],
            version: 1,
            description: 'Manually trigger workflow execution',
            defaults: {
                name: 'Manual Trigger',
            },
            inputs: [],
            outputs: ['main'],
            properties: [],
        };
        this.isTrigger = true;
        this.executable = true;
    }
    async execute(context) {
        const inputData = context.getInputData();
        if (inputData && Object.keys(inputData).length > 0) {
            return inputData;
        }
        const data = context.getNodeParameter('data', {});
        return data;
    }
}
exports.ManualTriggerNode = ManualTriggerNode;
