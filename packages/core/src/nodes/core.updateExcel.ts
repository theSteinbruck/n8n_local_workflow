import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';
import * as ExcelJS from 'exceljs';

export class UpdateExcelNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Update Excel',
        name: 'UpdateExcel',
        group: ['transform'],
        version: 1,
        description: 'Appends rows or updates cells in an existing Excel worksheet',
        defaults: {
            name: 'Update Excel',
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
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                options: [
                    { name: 'Append Rows', value: 'append' },
                    { name: 'Update Cell', value: 'updateCell' },
                ],
                default: 'append',
            },
            {
                displayName: 'Sheet Name or Index',
                name: 'sheetName',
                type: 'string',
                default: '1',
            },
            {
                displayName: 'Cell Address',
                name: 'cellAddress',
                type: 'string',
                default: 'A1',
                displayOptions: {
                    show: {
                        operation: ['updateCell']
                    }
                }
            },
            {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                displayOptions: {
                    show: {
                        operation: ['updateCell']
                    }
                }
            }
        ],
    };

    async execute(context: INodeExecutionContext): Promise<any> {
        const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 'data') as string;
        const operation = context.getNodeParameter('operation', 'append') as string;
        const sheetNameOrIndex = context.getNodeParameter('sheetName', '1') as string;

        const inputData = context.getInputData();
        if (inputData.length === 0) return [{ json: { success: false, message: 'No input data' } }];

        // We use the first item to get the binary file to update
        const firstItem = inputData[0];
        if (!firstItem.binary?.[binaryPropertyName]) {
            throw new Error(`Binary property '${binaryPropertyName}' not found in first input item`);
        }

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

        // Fix: exceljs doesn't persist columns metadata on load, so we must infer them from header row
        // to support addRow with objects.
        const rowCount = worksheet.rowCount;

        // Check if columns have keys, if not (or if missing), rebuild them from row 1
        const hasKeys = worksheet.columns && worksheet.columns.length > 0 && worksheet.columns[0].key;

        if (!hasKeys && rowCount > 0) {
            const firstRow = worksheet.getRow(1);
            const columns: any[] = [];
            firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const header = cell.value?.toString() || `column_${colNumber}`;
                columns.push({ header: header, key: header });
            });
            worksheet.columns = columns;
        }

        if (operation === 'append') {
            inputData.forEach(item => {
                worksheet!.addRow(item.json);
            });
        } else if (operation === 'updateCell') {
            const cellAddress = context.getNodeParameter('cellAddress', 'A1') as string;
            const value = context.getNodeParameter('value', '') as any;
            worksheet.getCell(cellAddress).value = value;
        }

        const outBuffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
        const binaryMeta = await context.setBinaryData(binaryPropertyName, outBuffer, {
            fileName: firstItem.binary[binaryPropertyName].fileName,
            mimeType: firstItem.binary[binaryPropertyName].mimeType
        });

        return {
            json: { success: true, operation, count: inputData.length },
            binary: { [binaryPropertyName]: binaryMeta }
        };
    }
}
