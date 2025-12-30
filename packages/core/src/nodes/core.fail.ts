import { INodeType, INodeTypeDescription, INodeExecutionContext } from '../execution/node-interfaces';

export class FailNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Fail',
        name: 'core.fail',
        group: ['transform'],
        version: 1,
        description: 'Always fails',
        defaults: {
            name: 'Fail',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
    };

    private static executionCount: Record<string, number> = {};

    async execute(context: INodeExecutionContext): Promise<any> {
        const nodeId = (context as any).node?.id || 'default';
        const failCount = context.getNodeParameter('failCount', 1);

        if (!FailNode.executionCount[nodeId]) {
            FailNode.executionCount[nodeId] = 0;
        }

        FailNode.executionCount[nodeId]++;

        if (FailNode.executionCount[nodeId] <= failCount) {
            throw new Error(`Simulated Failure ${FailNode.executionCount[nodeId]}/${failCount}`);
        }

        return { success: true, attempts: FailNode.executionCount[nodeId] };
    }
}
