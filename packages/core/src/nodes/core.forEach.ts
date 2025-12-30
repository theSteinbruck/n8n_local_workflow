import { INodeType, INodeTypeDescription, INodeExecutionContext, INodeExecutionData } from '../execution/node-interfaces';

export class ForEachNode implements INodeType {
    description: INodeTypeDescription = {
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

    isTrigger = false;

    async execute(context: INodeExecutionContext): Promise<INodeExecutionData[][]> {
        const inputData = context.getInputData();

        if (!Array.isArray(inputData)) {
            throw new Error('ForEach input must be an array');
        }

        // The ForEach node itself will return the full array.
        // The ExecutionEngine will be responsible for iterating over it.
        return [inputData];
    }
}
