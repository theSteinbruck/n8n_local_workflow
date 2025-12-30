import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export class CreateWordNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Create Word Document',
        name: 'CreateWord',
        group: ['transform'],
        version: 1,
        description: 'Creates a new Word document (.docx)',
        defaults: {
            name: 'Create Word Document',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Content (Text)',
                name: 'content',
                type: 'string',
                default: 'Hello World',
                description: 'Text content to add to the document',
            },
            {
                displayName: 'File Name',
                name: 'fileName',
                type: 'string',
                default: 'document.docx',
            },
            {
                displayName: 'Binary Property',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const content = context.getNodeParameter('content', '') as string;
        const fileName = context.getNodeParameter('fileName', 'document.docx') as string;
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;

        const inputData = context.getInputData();
        const results = [];

        for (const item of inputData) {
            // Allow dynamic content from expression if mapped
            // Note: simple text for now.
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun(content || ' '),
                            ],
                        }),
                    ],
                }],
            });

            const buffer = await Packer.toBuffer(doc);

            const binaryMeta = await context.setBinaryData(binaryPropertyName, buffer, {
                fileName,
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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
