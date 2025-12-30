import { INodeExecutionContext, INodeExecutionData, BinaryDataOptions, IBinaryData } from './src/execution/node-interfaces';
import { BinaryDataService } from './src/services/binary-data.service';

export class MockExecutionContext implements INodeExecutionContext {
    private binaryDataService: BinaryDataService;

    constructor(
        private inputData: INodeExecutionData[],
        private parameters: Record<string, any>
    ) {
        this.binaryDataService = new BinaryDataService();
    }

    getInputData(): INodeExecutionData[] {
        return this.inputData;
    }

    getInputs(): INodeExecutionData[][] {
        return [this.inputData];
    }

    getNodeParameter(name: string, defaultValue?: any): any {
        return this.parameters[name] !== undefined ? this.parameters[name] : defaultValue;
    }

    executeWorkflow(workflowId: string, inputData: any): Promise<any> {
        throw new Error('Method not implemented.');
    }

    async getBinaryData(key: string): Promise<Buffer> {
        const input = this.getInputData()[0];
        if (!input.binary?.[key]) {
            throw new Error(`Binary data ${key} not found`);
        }
        return this.binaryDataService.retrieveBinaryData(input.binary[key]);
    }

    async setBinaryData(key: string, data: Buffer, options: BinaryDataOptions): Promise<IBinaryData> {
        return this.binaryDataService.storeBinaryData(data, options);
    }

    updateExecutionState(data: { waitingUntil?: Date | null; }): Promise<void> {
        return Promise.resolve();
    }
}
