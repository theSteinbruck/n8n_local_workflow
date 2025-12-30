import { INodeType, INodeTypeDescription, INodeExecutionContext, INodeExecutionData } from '../execution/node-interfaces';

export class MergeNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Merge',
        name: 'Merge',
        group: ['transform'],
        version: 1,
        description: 'Merges data from multiple streams',
        defaults: {
            name: 'Merge',
        },
        inputs: ['main', 'main'], // Supports multiple inputs (at least 2 defined here, but engine handles dynamic)
        outputs: ['main'],
        properties: [
            {
                displayName: 'Mode',
                name: 'mode',
                type: 'options',
                options: [
                    {
                        name: 'Append',
                        value: 'append',
                        description: 'Combines data from all inputs',
                    },
                    {
                        name: 'Merge By Key',
                        value: 'mergeByKey',
                        description: 'Merges items by a common key',
                    },
                    {
                        name: 'Merge By Index',
                        value: 'mergeByIndex',
                        description: 'Merges items by their position',
                    }
                ],
                default: 'append',
            },
            {
                displayName: 'Merge Key',
                name: 'mergeKey',
                type: 'string',
                displayOptions: {
                    show: {
                        mode: ['mergeByKey'],
                    },
                },
                default: '',
                description: 'The property to merge by',
            },
        ],
    };

    async execute(context: INodeExecutionContext): Promise<INodeExecutionData[][]> {
        const mode = context.getNodeParameter('mode', 'append') as string;

        // We need a way to access ALL inputs. 
        // Assuming context.getAllInputs() or similar will be added.
        // For now, let's assume context.getInputData() returns the array of all inputs if it's a merge node?
        // Or we add a new method to the interface.

        // Let's assume we will extend INodeExecutionContext to have getInputs(): INodeExecutionData[][]
        const inputs = (context as any).getInputs ? (context as any).getInputs() : [context.getInputData()];

        if (mode === 'append') {
            const returnData: INodeExecutionData[] = [];
            for (const input of inputs) {
                if (Array.isArray(input)) {
                    returnData.push(...input);
                }
            }
            return [returnData];
        }

        if (mode === 'mergeByIndex') {
            const returnData: INodeExecutionData[] = [];
            const length = Math.max(...inputs.map((i: any[]) => i.length));

            for (let i = 0; i < length; i++) {
                let mergedJson = {};
                let mergedBinary = {};
                for (const input of inputs) {
                    if (input[i]) {
                        mergedJson = { ...mergedJson, ...(input[i].json || {}) };
                        mergedBinary = { ...mergedBinary, ...(input[i].binary || {}) };
                    }
                }
                returnData.push({ json: mergedJson, binary: mergedBinary });
            }
            return [returnData];
        }

        if (mode === 'mergeByKey') {
            const mergeKey = context.getNodeParameter('mergeKey', '') as string;
            if (!mergeKey) {
                throw new Error('Merge Key is required for mergeByKey mode');
            }

            const mergedMap = new Map<string, INodeExecutionData>();
            const returnData: INodeExecutionData[] = [];

            for (const input of inputs) {
                if (Array.isArray(input)) {
                    for (const item of input) {
                        const key = item.json?.[mergeKey];
                        if (key !== undefined) {
                            const keyStr = String(key);
                            const existing = mergedMap.get(keyStr) || { json: {}, binary: {} };
                            mergedMap.set(keyStr, {
                                json: { ...existing.json, ...item.json },
                                binary: { ...existing.binary, ...item.binary }
                            });
                        } else {
                            returnData.push(item);
                        }
                    }
                }
            }

            returnData.push(...Array.from(mergedMap.values()));
            return [returnData];
        }

        return [[]];
    }
}
