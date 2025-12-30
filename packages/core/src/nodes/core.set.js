"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetNode = void 0;
class SetNode {
    constructor() {
        this.description = {
            displayName: 'Set',
            name: 'core.set',
            group: ['transform'],
            version: 1,
            description: 'Sets values',
            defaults: {
                name: 'Set',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Values',
                    name: 'values',
                    type: 'json',
                    default: {},
                }
            ],
        };
    }
    async execute(context) {
        const inputData = context.getInputData();
        const values = context.getNodeParameter('values', {});
        if (Array.isArray(inputData)) {
            return inputData.map(item => ({ ...item, ...values }));
        }
        return { ...inputData, ...values };
    }
}
exports.SetNode = SetNode;
