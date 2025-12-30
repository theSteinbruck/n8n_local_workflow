"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForEachNode = void 0;
class ForEachNode {
    constructor() {
        this.description = {
            displayName: 'ForEach',
            name: 'core.forEach',
            group: ['transform'],
            version: 1,
            description: 'Iterate over an array sequentially',
            defaults: {
                name: 'ForEach',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: []
        };
        this.isTrigger = false;
    }
    async execute(context) {
        const inputData = context.getInputData();
        if (!Array.isArray(inputData)) {
            throw new Error('ForEach input must be an array');
        }
        // The ForEach node itself will return the full array.
        // The ExecutionEngine will be responsible for iterating over it.
        return [inputData];
    }
}
exports.ForEachNode = ForEachNode;
