import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';
import pptxgen from 'pptxgenjs';

export class CreatePresentationNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Create Presentation',
        name: 'CreatePresentation',
        group: ['transform'],
        version: 1,
        description: 'Creates a PowerPoint presentation (.pptx) from input items',
        defaults: {
            name: 'Create Presentation',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'File Name',
                name: 'fileName',
                type: 'string',
                default: 'presentation.pptx',
            },
            {
                displayName: 'Binary Property',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
            },
            {
                displayName: 'Slide Title',
                name: 'title',
                type: 'string',
                default: '',
                description: 'Title for the slide (mapped from input)',
            },
            {
                displayName: 'Slide Body',
                name: 'body',
                type: 'string',
                default: '',
                description: 'Body text for the slide (mapped from input)',
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const fileName = context.getNodeParameter('fileName', 'presentation.pptx') as string;
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;

        const inputData = context.getInputData();
        if (inputData.length === 0) return [{ json: { success: false, message: 'No input data' } }];

        // Create one presentation from ALL input items
        const pres = new pptxgen();

        // Iterate all items and add slides
        for (let i = 0; i < inputData.length; i++) {
            // Get parameter value for specific item index to allow expression mapping
            const title = context.getNodeParameter('title', i) as string;
            const body = context.getNodeParameter('body', i) as string;

            const slide = pres.addSlide();
            if (title) {
                slide.addText(title, { x: 1, y: 1, w: '80%', h: 1, fontSize: 24, bold: true, color: '363636' });
            }
            if (body) {
                slide.addText(body, { x: 1, y: 2.5, w: '80%', h: 4, fontSize: 18, color: '666666' });
            }
        }

        const buffer = await pres.write({ outputType: 'nodebuffer' }) as unknown as Buffer;

        // We attach the binary to the FIRST item, or create a new item?
        // Usually, aggregation nodes return one item with the result.
        // Or we attach to the first item and keep others?
        // Let's return ONE item with the generated binary.

        const firstItem = inputData[0];
        const binaryMeta = await context.setBinaryData(binaryPropertyName, buffer, {
            fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        });

        return [{
            json: { success: true, slideCount: inputData.length, fileName },
            binary: {
                ...firstItem.binary,
                [binaryPropertyName]: binaryMeta
            }
        }];
    }
}
