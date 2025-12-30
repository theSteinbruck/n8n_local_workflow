import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';
import * as ExcelJS from 'exceljs';

export class ReadExcelNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Read Excel Sheet',
        name: 'ReadExcel',
        group: ['transform'],
        version: 1,
        description: 'Reads data from an Excel worksheet',
        defaults: {
            name: 'Read Excel Sheet',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Binary Property',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
            },
            {
                displayName: 'Sheet Name or Index',
                name: 'sheetName',
                type: 'string',
                default: '1',
                description: 'Name or 1-based index of the sheet to read',
            },
            {
                displayName: 'Header Row',
                name: 'headerRow',
                type: 'number',
                default: 1,
            },
            {
                displayName: 'Data Start Row',
                name: 'startRow',
                type: 'number',
                default: 2,
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;
        const sheetNameOrIndex = context.getNodeParameter('sheetName', '1') as string;
        const headerRowIndex = context.getNodeParameter('headerRow', 1) as number;
        const dataStartRowIndex = context.getNodeParameter('startRow', 2) as number;

        const inputData = context.getInputData();
        const results: any[] = [];

        for (const item of inputData) {
            if (!item.binary?.[binaryPropertyName]) continue;

            const buffer = await context.getBinaryData(binaryPropertyName);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer as any);

            let worksheet: ExcelJS.Worksheet | undefined;
            if (!isNaN(parseInt(sheetNameOrIndex))) {
                worksheet = workbook.getWorksheet(parseInt(sheetNameOrIndex));
            } else {
                worksheet = workbook.getWorksheet(sheetNameOrIndex);
            }

            if (!worksheet) {
                throw new Error(`Sheet '${sheetNameOrIndex}' not found`);
            }


            const headers: string[] = [];
            const headerRow = worksheet.getRow(headerRowIndex);
            headerRow.eachCell((cell, colNumber) => {
                headers[colNumber] = cell.text || `column_${colNumber}`;
            });

            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber < dataStartRowIndex) return;

                const rowData: Record<string, any> = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber] || `column_${colNumber}`;
                    rowData[header] = cell.value;
                });

                results.push({
                    json: rowData,
                    binary: {} // We usually don't pass the Excel binary to every row object unless asked
                });
            });
        }

        return results;
    }
}
