import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';
import * as ExcelJS from 'exceljs';

export class CreateExcelNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Create Excel Workbook',
        name: 'CreateExcel',
        group: ['transform'],
        version: 1,
        description: 'Creates a new Excel workbook from JSON data',
        defaults: {
            name: 'Create Excel Workbook',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Sheet Name',
                name: 'sheetName',
                type: 'string',
                default: 'Sheet1',
            },
            {
                displayName: 'Binary Property',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
            },
            {
                displayName: 'File Name',
                name: 'fileName',
                type: 'string',
                default: 'workbook.xlsx',
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const sheetName = context.getNodeParameter('sheetName', 'Sheet1') as string;
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;
        const fileName = context.getNodeParameter('fileName', 'workbook.xlsx') as string;

        const inputData = context.getInputData();
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        if (inputData.length > 0) {
            // Use keys from first item as headers
            const headers = Object.keys(inputData[0].json);
            worksheet.columns = headers.map(h => ({ header: h, key: h }));

            inputData.forEach(item => {
                worksheet.addRow(item.json);
            });
        }

        const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
        const binaryMeta = await context.setBinaryData(binaryPropertyName, buffer, {
            fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        return {
            json: { success: true, rowCount: inputData.length },
            binary: { [binaryPropertyName]: binaryMeta }
        };
    }
}
