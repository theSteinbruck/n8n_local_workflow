"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailNode = void 0;
class FailNode {
    constructor() {
        this.description = {
            displayName: 'Fail',
            name: 'core.fail',
            group: ['transform'],
            version: 1,
            description: 'Always fails',
            defaults: {
                name: 'Fail',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [],
        };
    }
    async execute(context) {
        const nodeId = context.node?.id || 'default';
        const failCount = context.getNodeParameter('failCount', 1);
        if (!FailNode.executionCount[nodeId]) {
            FailNode.executionCount[nodeId] = 0;
        }
        FailNode.executionCount[nodeId]++;
        if (FailNode.executionCount[nodeId] <= failCount) {
            throw new Error(`Simulated Failure ${FailNode.executionCount[nodeId]}/${failCount}`);
        }
        return { success: true, attempts: FailNode.executionCount[nodeId] };
    }
}
exports.FailNode = FailNode;
FailNode.executionCount = {};
