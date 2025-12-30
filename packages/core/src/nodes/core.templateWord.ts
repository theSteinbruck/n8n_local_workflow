import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export class TemplateWordNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Word Template',
        name: 'TemplateWord',
        group: ['transform'],
        version: 1,
        description: 'Fills a Word template with data',
        defaults: {
            name: 'Word Template',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Binary Property (Template)',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
                description: 'The binary property containing the .docx template',
            },
            {
                displayName: 'Output File Name',
                name: 'fileName',
                type: 'string',
                default: 'output.docx',
            },
            {
                displayName: 'Output Binary Property',
                name: 'outputBinaryPropertyName',
                type: 'string',
                default: 'data',
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;
        const outputBinaryPropertyName = context.getNodeParameter('outputBinaryPropertyName', 'data') as string;
        const fileName = context.getNodeParameter('fileName', 'output.docx') as string;

        const inputData = context.getInputData();
        const results = [];

        for (const item of inputData) {
            if (!item.binary?.[binaryPropertyName]) {
                throw new Error(`Binary property '${binaryPropertyName}' not found`);
            }

            const buffer = await context.getBinaryData(binaryPropertyName);

            const zip = new PizZip(buffer);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });

            // Feed the current item JSON as context for the template
            doc.render(item.json);

            const outBuffer = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });

            const binaryMeta = await context.setBinaryData(outputBinaryPropertyName, outBuffer, {
                fileName,
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            results.push({
                json: item.json, // Pass through original data
                binary: {
                    ...item.binary,
                    [outputBinaryPropertyName]: binaryMeta
                }
            });
        }

        return results;
    }
}
