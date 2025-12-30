"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeNode = void 0;
class MergeNode {
    constructor() {
        this.description = {
            displayName: 'Merge',
            name: 'Merge',
            group: ['transform'],
            version: 1,
            description: 'Merges data from multiple streams',
            defaults: {
                name: 'Merge',
            },
            inputs: ['main', 'main'], // Supports multiple inputs (at least 2 defined here, but engine handles dynamic)
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Mode',
                    name: 'mode',
                    type: 'options',
                    options: [
                        {
                            name: 'Append',
                            value: 'append',
                            description: 'Combines data from all inputs',
                        },
                        {
                            name: 'Merge By Key',
                            value: 'mergeByKey',
                            description: 'Merges items by a common key',
                        },
                        {
                            name: 'Merge By Index',
                            value: 'mergeByIndex',
                            description: 'Merges items by their position',
                        }
                    ],
                    default: 'append',
                },
                {
                    displayName: 'Merge Key',
                    name: 'mergeKey',
                    type: 'string',
                    displayOptions: {
                        show: {
                            mode: ['mergeByKey'],
                        },
                    },
                    default: '',
                    description: 'The property to merge by',
                },
            ],
        };
    }
    async execute(context) {
        const mode = context.getNodeParameter('mode', 'append');
        // We need a way to access ALL inputs. 
        // Assuming context.getAllInputs() or similar will be added.
        // For now, let's assume context.getInputData() returns the array of all inputs if it's a merge node?
        // Or we add a new method to the interface.
        // Let's assume we will extend INodeExecutionContext to have getInputs(): INodeExecutionData[][]
        const inputs = context.getInputs ? context.getInputs() : [context.getInputData()];
        if (mode === 'append') {
            const returnData = [];
            for (const input of inputs) {
                if (Array.isArray(input)) {
                    returnData.push(...input);
                }
            }
            return [returnData];
        }
        if (mode === 'mergeByIndex') {
            // Simple implementation: merge objects at same index
            const returnData = [];
            const length = Math.max(...inputs.map((i) => i.length));
            for (let i = 0; i < length; i++) {
                let mergedItem = {};
                for (const input of inputs) {
                    if (input[i]) {
                        mergedItem = { ...mergedItem, ...input[i] };
                    }
                }
                returnData.push(mergedItem);
            }
            return [returnData];
        }
        if (mode === 'mergeByKey') {
            const mergeKey = context.getNodeParameter('mergeKey', '');
            if (!mergeKey) {
                throw new Error('Merge Key is required for mergeByKey mode');
            }
            const mergedMap = new Map();
            const returnData = [];
            // Iterate over all inputs
            for (const input of inputs) {
                if (Array.isArray(input)) {
                    for (const item of input) {
                        const key = item[mergeKey];
                        if (key !== undefined) {
                            const keyStr = String(key);
                            const existing = mergedMap.get(keyStr) || {};
                            mergedMap.set(keyStr, { ...existing, ...item });
                        }
                        else {
                            // If key is missing, append as is (no merge)
                            returnData.push(item);
                        }
                    }
                }
            }
            // Add merged items
            returnData.push(...Array.from(mergedMap.values()));
            return [returnData];
        }
        return [[]];
    }
}
exports.MergeNode = MergeNode;
