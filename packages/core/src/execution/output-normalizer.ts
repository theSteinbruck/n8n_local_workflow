import { INodeExecutionData } from './node-interfaces';

/**
 * Normalizes node output to a strict INodeExecutionData[] format.
 * Ensures every item has a 'json' property.
 */
export function normalizeNodeOutput(rawOutput: any): INodeExecutionData[] {
    if (rawOutput === null || rawOutput === undefined) {
        return [{ json: {} }];
    }

    // If it's already an array, normalize each item
    if (Array.isArray(rawOutput)) {
        if (rawOutput.length === 0) {
            // n8n mental model: empty output means execution stops here, 
            // but if we must return NodeOutput[], [] is acceptable for "stop".
            return [];
        }

        return rawOutput.map(item => normalizeItem(item));
    }

    // Single item
    return [normalizeItem(rawOutput)];
}

function normalizeItem(item: any): INodeExecutionData {
    if (item === null || item === undefined) {
        return { json: {} };
    }

    // Check if it already conforms to { json, binary? }
    if (item.json !== undefined && typeof item.json === 'object' && item.json !== null) {
        return {
            json: item.json,
            binary: item.binary || {}
        };
    }

    // If it's just a raw object/value, wrap it in json
    if (typeof item === 'object' && !Array.isArray(item)) {
        return { json: item, binary: {} };
    }

    // Primitive values
    return { json: { data: item }, binary: {} };
}
