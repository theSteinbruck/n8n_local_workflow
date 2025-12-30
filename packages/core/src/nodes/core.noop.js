"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoOpNode = void 0;
class NoOpNode {
    constructor() {
        this.description = {
            displayName: 'No Operation',
            name: 'core.noop',
            group: ['transform'],
            version: 1,
            description: 'Does nothing',
            defaults: {
                name: 'NoOp',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [],
        };
    }
    async execute(context) {
        const inputData = context.getInputData();
        return inputData; // Pass through
    }
}
exports.NoOpNode = NoOpNode;
