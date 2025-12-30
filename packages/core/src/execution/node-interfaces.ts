// Binary data interface for file handling
export interface IBinaryData {
    id: string;
    filePath: string;        // Path to stored file (mandatory for Binary Data Contract)
    fileName: string;        // Original file name
    mimeType: string;        // Content type (e.g., 'application/pdf')
    fileSize: number;        // Size in bytes
    data?: string;           // Base64 encoded (optional, for small data preview/debug)
}

export interface BinaryDataOptions {
    fileName: string;
    mimeType: string;
}

export interface INodeExecutionData {
    json: Record<string, any>;
    binary?: Record<string, IBinaryData>;
}

export interface INodeExecutionContext {
    getInputData(): INodeExecutionData[];
    getInputs(): INodeExecutionData[][];
    getNodeParameter(name: string, defaultValue?: any): any;
    executeWorkflow(workflowId: string, inputData: any): Promise<any>;
    getBinaryData(key: string): Promise<Buffer>;
    setBinaryData(key: string, data: Buffer, options: BinaryDataOptions): Promise<IBinaryData>;
    updateExecutionState(data: { waitingUntil?: Date | null }): Promise<void>;
    signal?: AbortSignal;
}

export interface INodeTypeDescription {
    displayName: string;
    name: string;
    group: string[];
    version: number;
    description: string;
    defaults?: {
        name?: string;
    };
    inputs: string[];
    outputs: string[];
    properties: any[];
}

export interface INodeType {
    description: INodeTypeDescription;
    execute(context: INodeExecutionContext): Promise<any>;
    isTrigger?: boolean;
    executable?: boolean;
}
