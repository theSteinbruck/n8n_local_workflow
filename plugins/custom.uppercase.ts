/**
 * Example Custom Node: Uppercase
 * 
 * This node demonstrates how to create a custom node using the SDK.
 * It converts input text to uppercase.
 */

import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../packages/core/src/sdk';

export class UppercaseNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Uppercase',
        name: 'Uppercase',
        group: ['transform'],
        version: 1,
        description: 'Converts input text to uppercase',
        defaults: {
            name: 'Uppercase',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Field',
                name: 'field',
                type: 'string',
                default: 'text',
                description: 'The field to convert to uppercase'
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const input = context.getInputData() as Record<string, any> || {};
        const field = context.getNodeParameter('field', 'text') as string;

        const result: Record<string, any> = { ...input };

        // Convert the specified field to uppercase
        if (typeof input[field] === 'string') {
            result[field] = input[field].toUpperCase();
        }

        return result;
    }
}

// Default export for easy loading
export default UppercaseNode;
