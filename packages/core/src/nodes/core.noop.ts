import { INodeType, INodeTypeDescription, INodeExecutionContext } from '../execution/node-interfaces';

export class NoOpNode implements INodeType {
    description: INodeTypeDescription = {
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

    async execute(context: INodeExecutionContext): Promise<any> {
        const inputData = context.getInputData();
        return inputData; // Pass through
    }
}
