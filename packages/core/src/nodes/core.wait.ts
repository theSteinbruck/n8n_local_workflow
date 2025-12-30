import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';

export class WaitNode implements INodeType {
    description: INodeTypeDescription = {
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

    async execute(context: INodeExecutionContext): Promise<any> {
        const amount = context.getNodeParameter('amount', 1) as number;
        const unit = context.getNodeParameter('unit', 'seconds') as string;

        let delayMs = amount * 1000;
        if (unit === 'minutes') delayMs *= 60;
        if (unit === 'hours') delayMs *= 3600;

        const waitingUntil = new Date(Date.now() + delayMs);
        if ((context as any).updateExecutionState) {
            await (context as any).updateExecutionState({ waitingUntil });
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
