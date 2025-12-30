"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitNode = void 0;
class WaitNode {
    constructor() {
        this.description = {
            displayName: 'Wait',
            name: 'Wait',
            group: ['transform'],
            version: 1,
            description: 'Pauses the workflow execution',
            defaults: {
                name: 'Wait',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Amount',
                    name: 'amount',
                    type: 'number',
                    default: 1,
                },
                {
                    displayName: 'Unit',
                    name: 'unit',
                    type: 'options',
                    options: [
                        { name: 'Seconds', value: 'seconds' },
                        { name: 'Minutes', value: 'minutes' },
                        { name: 'Hours', value: 'hours' }
                    ],
                    default: 'seconds',
                }
            ],
        };
    }
    async execute(context) {
        const amount = context.getNodeParameter('amount', 1);
        const unit = context.getNodeParameter('unit', 'seconds');
        let delayMs = amount * 1000;
        if (unit === 'minutes')
            delayMs *= 60;
        if (unit === 'hours')
            delayMs *= 3600;
        const waitingUntil = new Date(Date.now() + delayMs);
        if (context.updateExecutionState) {
            await context.updateExecutionState({ waitingUntil });
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(context.getInputData());
            }, delayMs);
            if (context.signal) {
                if (context.signal.aborted) {
                    clearTimeout(timeout);
                    reject(new Error('Wait aborted'));
                    return;
                }
                context.signal.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new Error('Wait aborted'));
                }, { once: true });
            }
        });
    }
}
exports.WaitNode = WaitNode;
