import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';

export class ReadTextFileNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Read Text File',
        name: 'ReadTextFile',
        group: ['transform'],
        version: 1,
        description: 'Reads text content from a binary file',
        defaults: {
            name: 'Read Text File',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Binary Property',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
                description: 'The name of the binary property to read the file from',
            },
            {
                displayName: 'Encoding',
                name: 'encoding',
                type: 'options',
                options: [
                    { name: 'UTF-8', value: 'utf8' },
                    { name: 'ASCII', value: 'ascii' },
                    { name: 'Base64', value: 'base64' },
                ],
                default: 'utf8',
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;
        const encoding = context.getNodeParameter('encoding', 'utf8') as BufferEncoding;

        const inputData = context.getInputData();
        const results = [];

        for (const item of inputData) {
            if (!item.binary?.[binaryPropertyName]) {
                continue;
            }

            const buffer = await context.getBinaryData(binaryPropertyName);
            const textContent = buffer.toString(encoding);

            results.push({
                json: {
                    ...item.json,
                    text: textContent
                },
                binary: item.binary
            });
        }

        return results;
    }
}
