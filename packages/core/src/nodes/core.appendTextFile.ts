import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';

export class AppendTextFileNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Append Text',
        name: 'AppendTextFile',
        group: ['transform'],
        version: 1,
        description: 'Appends text content to an existing binary file',
        defaults: {
            name: 'Append Text',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Text to Append',
                name: 'textContent',
                type: 'string',
                default: '',
                description: 'The text content to append to the file',
            },
            {
                displayName: 'Binary Property',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
                description: 'The name of the binary property to append to',
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const textToAppend = context.getNodeParameter('textContent', '') as string;
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;

        const inputData = context.getInputData();
        const results = [];

        for (const item of inputData) {
            if (!item.binary?.[binaryPropertyName]) {
                throw new Error(`Binary property '${binaryPropertyName}' not found in input`);
            }

            const existingBuffer = await context.getBinaryData(binaryPropertyName);
            const newContent = Buffer.concat([existingBuffer, Buffer.from('\n' + textToAppend)]);

            const binaryMeta = await context.setBinaryData(binaryPropertyName, newContent, {
                fileName: item.binary[binaryPropertyName].fileName,
                mimeType: item.binary[binaryPropertyName].mimeType
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
