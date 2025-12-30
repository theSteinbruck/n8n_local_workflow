/**
 * Local-n8n Node SDK
 * 
 * This module exports all types and utilities needed for creating custom nodes.
 * 
 * @example
 * ```typescript
 * import { INodeType, INodeExecutionContext, INodeTypeDescription } from '@local-n8n/core/src/sdk';
 * 
 * export class MyCustomNode implements INodeType {
 *     description: INodeTypeDescription = {
 *         displayName: 'My Custom Node',
 *         name: 'MyCustomNode',
 *         group: ['transform'],
 *         version: 1,
 *         description: 'Does something custom',
 *         inputs: ['main'],
 *         outputs: ['main'],
 *         properties: []
 *     };
 * 
 *     async execute(context: INodeExecutionContext): Promise<any> {
 *         const input = context.getInputData();
 *         return { processed: true, data: input };
 *     }
 * }
 * ```
 */

// Core Node Types
export {
    INodeType,
    INodeTypeDescription,
    INodeExecutionContext,
    INodeExecutionData,
    IBinaryData,
    BinaryDataOptions,
} from '../execution/node-interfaces';

// Helper function for creating nodes with defaults
export interface CreateNodeOptions {
    name: string;
    displayName: string;
    description: string;
    group?: string[];
    version?: number;
    inputs?: string[];
    outputs?: string[];
    properties?: any[];
    isTrigger?: boolean;
    execute: (context: any) => Promise<any>;
}

/**
 * Helper function to create a node with sensible defaults
 */
export function createNode(options: CreateNodeOptions): any {
    return {
        description: {
            displayName: options.displayName,
            name: options.name,
            group: options.group || ['transform'],
            version: options.version || 1,
            description: options.description,
            defaults: { name: options.displayName },
            inputs: options.inputs || ['main'],
            outputs: options.outputs || ['main'],
            properties: options.properties || [],
        },
        isTrigger: options.isTrigger || false,
        executable: true,
        execute: options.execute,
    };
}

/**
 * SDK Version
 */
export const SDK_VERSION = '1.0.0';
