import { INodeType, INodeTypeDescription, INodeExecutionContext } from '../execution/node-interfaces';

export class SetNode implements INodeType {
    description: INodeTypeDescription = {
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

    async execute(context: INodeExecutionContext): Promise<any> {
        const inputData = context.getInputData();
        const values = context.getNodeParameter('values', {});

        return inputData.map(item => ({
            ...item,
            json: {
                ...(item.json || {}),
                ...values
            }
        }));
    }
}
