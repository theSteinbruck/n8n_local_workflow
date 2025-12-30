import { INodeExecutionData, INodeType, INodeExecutionContext } from '../execution/node-interfaces';

export class IfNode implements INodeType {
    description = {
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

    async execute(context: INodeExecutionContext): Promise<INodeExecutionData[][]> {
        const condition = context.getNodeParameter('condition', false) as boolean;
        const items = context.getInputData();

        if (condition) {
            // True branch (index 0) gets data, False branch (index 1) gets empty
            return [items, []];
        } else {
            // True branch (index 0) gets empty, False branch (index 1) gets data
            return [[], items];
        }
    }
}
