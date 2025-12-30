import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';

export class ManualTriggerNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Manual Trigger',
        name: 'ManualTrigger',
        group: ['trigger'],
        version: 1,
        description: 'Manually trigger workflow execution',
        defaults: {
            name: 'Manual Trigger',
        },
        inputs: [],
        outputs: ['main'],
        properties: [],
    };

    isTrigger = true;
    executable = true;

    async execute(context: INodeExecutionContext): Promise<any> {
        const inputData = context.getInputData();
        if (inputData && Object.keys(inputData).length > 0) {
            return inputData;
        }
        const data = context.getNodeParameter('data', {});
        return data;
    }
}
