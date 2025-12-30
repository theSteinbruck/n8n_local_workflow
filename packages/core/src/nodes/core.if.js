"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IfNode = void 0;
class IfNode {
    constructor() {
        this.description = {
            displayName: 'If',
            name: 'If',
            group: ['transform'],
            version: 1,
            description: 'Split execution based on condition',
            defaults: {
                name: 'If',
            },
            inputs: ['main'],
            outputs: ['main', 'main'], // [true, false]
            properties: [
                {
                    displayName: 'Condition',
                    name: 'condition',
                    type: 'boolean',
                    default: false,
                    description: 'Expression that evaluates to true or false',
                },
            ],
        };
    }
    async execute(context) {
        const condition = context.getNodeParameter('condition', false);
        const items = context.getInputData();
        if (condition) {
            // True branch (index 0) gets data, False branch (index 1) gets empty
            return [items, []];
        }
        else {
            // True branch (index 0) gets empty, False branch (index 1) gets data
            return [[], items];
        }
    }
}
exports.IfNode = IfNode;
