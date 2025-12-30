import { INodeExecutionContext, IBinaryData, BinaryDataOptions } from './node-interfaces';
import { BinaryDataService } from '../services/binary-data.service';

export class NodeExecutionContext implements INodeExecutionContext {
    private binaryDataService: BinaryDataService;

    constructor(
        private inputData: any,
        private node: any,
        private allInputs: any[][] = [inputData],
        private executeWorkflowCallback?: (workflowId: string, inputData: any) => Promise<any>,
        private updateExecutionStateCallback?: (data: { waitingUntil?: Date | null }) => Promise<void>,
        public signal?: AbortSignal
    ) {
        this.binaryDataService = new BinaryDataService();
    }

    getInputData(): any {
        return this.inputData;
    }

    getInputs(): any[][] {
        return this.allInputs;
    }

    getNodeParameter(name: string, defaultValue?: any): any {
        if (this.node.parameters && this.node.parameters[name] !== undefined) {
            return this.node.parameters[name];
        }
        return defaultValue;
    }

    async executeWorkflow(workflowId: string, inputData: any): Promise<any> {
        if (!this.executeWorkflowCallback) {
            throw new Error('executeWorkflow is not supported in this context');
        }
        return this.executeWorkflowCallback(workflowId, inputData);
    }

    async updateExecutionState(data: { waitingUntil?: Date | null }): Promise<void> {
        if (this.updateExecutionStateCallback) {
            await this.updateExecutionStateCallback(data);
        }
    }

    async getBinaryData(key: string): Promise<Buffer> {
        const inputData = this.getInputData();
        if (!inputData?.binary?.[key]) {
            throw new Error(`Binary data with key '${key}' not found in input`);
        }
        return this.binaryDataService.retrieveBinaryData(inputData.binary[key]);
    }

    async setBinaryData(key: string, data: Buffer, options: BinaryDataOptions): Promise<IBinaryData> {
        const binaryData = await this.binaryDataService.storeBinaryData(data, options);

        // Attach to input data for downstream nodes
        const inputData = this.getInputData() || {};
        if (!inputData.binary) {
            inputData.binary = {};
        }
        inputData.binary[key] = binaryData;

        return binaryData;
    }
}
