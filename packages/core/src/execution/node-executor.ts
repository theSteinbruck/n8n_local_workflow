export interface INodeExecutor {
    execute(node: any, inputData: any): Promise<any>;
}

export class NoOpNodeExecutor implements INodeExecutor {
    async execute(node: any, inputData: any): Promise<any> {
        // Simulate processing
        return { ...inputData, processedBy: node.id };
    }
}
