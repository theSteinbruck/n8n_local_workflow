import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';

export class WriteTextFileNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Write Text File',
        name: 'WriteTextFile',
        group: ['transform'],
        version: 1,
        description: 'Writes text content to a binary file',
        defaults: {
            name: 'Write Text File',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Text Content',
                name: 'textContent',
                type: 'string',
                default: '',
                description: 'The text content to write to the file',
            },
            {
                displayName: 'File Name',
                name: 'fileName',
                type: 'string',
                default: 'output.txt',
            },
            {
                displayName: 'Mime Type',
                name: 'mimeType',
                type: 'string',
                default: 'text/plain',
            },
            {
                displayName: 'Binary Property',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
                description: 'The name of the binary property to save the file to',
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const textContent = context.getNodeParameter('textContent', '') as string;
        const fileName = context.getNodeParameter('fileName', 'output.txt') as string;
        const mimeType = context.getNodeParameter('mimeType', 'text/plain') as string;
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;

        const inputData = context.getInputData();
        const results = [];

        for (const item of inputData) {
            // Priority: provided parameter, then item.json.text, then empty
            const content = textContent || item.json.text || '';
            const buffer = Buffer.from(content);

            const binaryMeta = await context.setBinaryData(binaryPropertyName, buffer, {
                fileName,
                mimeType
            });

            results.push({
                json: item.json,
                binary: {
                    ...item.binary,
                    [binaryPropertyName]: binaryMeta
                }
            });
        }

        return results;
    }
}
