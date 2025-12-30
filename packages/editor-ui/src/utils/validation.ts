import type { NodeType } from '../hooks/useNodeTypes';

export interface ValidationError {
    property: string;
    message: string;
}

export function validateNodeParameters(parameters: any, schema: NodeType): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!schema || !schema.properties) return errors;

    for (const prop of schema.properties) {
        const value = parameters[prop.name] ?? prop.default;

        // Check required
        if (prop.required) {
            if (value === undefined || value === null || value === '') {
                errors.push({
                    property: prop.name,
                    message: `${prop.displayName} is required`
                });
                continue; // Skip further checks for this prop if missing
            }
        }

        // Check type specific
        if (value !== undefined && value !== null && value !== '') {
            if (prop.type === 'json' && typeof value === 'string') {
                try {
                    JSON.parse(value);
                } catch (e) {
                    errors.push({
                        property: prop.name,
                        message: 'Invalid JSON format'
                    });
                }
            }

            if (prop.type === 'number' && isNaN(Number(value))) {
                errors.push({
                    property: prop.name,
                    message: 'Must be a number'
                });
            }
        }
    }

    return errors;
}
