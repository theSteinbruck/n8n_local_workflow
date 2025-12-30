import vm from 'vm';

/**
 * Expression Resolver for workflow parameters
 * Supports read-only expressions like {{ $json.field }} and {{ $node["NodeName"].json.field }}
 */

export interface ExpressionContext {
    $json: any; // Input data from previous node
    $node: Record<string, any>; // Access to other node outputs by name
    $execution: {
        id: string;
        mode: string;
    };
    $item?: any;  // Current item in ForEach loop
    $index?: number; // Current index in ForEach loop
}

/**
 * Resolve expressions in a value (string, object, or array)
 */
export function resolveExpressions(value: any, context: ExpressionContext): any {
    if (typeof value === 'string') {
        return resolveStringExpressions(value, context);
    }

    if (Array.isArray(value)) {
        return value.map(item => resolveExpressions(item, context));
    }

    if (value && typeof value === 'object') {
        const resolved: any = {};
        for (const key in value) {
            resolved[key] = resolveExpressions(value[key], context);
        }
        return resolved;
    }

    return value;
}

/**
 * Resolve expressions in a string
 */
function resolveStringExpressions(str: string, context: ExpressionContext): any {
    // Find all {{ }} blocks
    const expressionRegex = /\{\{([^}]+)\}\}/g;
    const matches = Array.from(str.matchAll(expressionRegex));

    // If no expressions, return as-is
    if (matches.length === 0) {
        return str;
    }

    // If the entire string is a single expression, return the resolved value directly
    // This allows expressions to return non-string types
    if (matches.length === 1 && str.trim() === matches[0][0]) {
        const expression = matches[0][1].trim();
        return evaluateExpression(expression, context);
    }

    // Multiple expressions or mixed with text: replace each and return string
    let result = str;
    for (const match of matches) {
        const fullMatch = match[0]; // {{ ... }}
        const expression = match[1].trim();

        try {
            const value = evaluateExpression(expression, context);
            // Convert to string for replacement
            const replacement = value === null || value === undefined ? '' : String(value);
            result = result.replace(fullMatch, replacement);
        } catch (error: any) {
            throw new Error(`Invalid expression: ${fullMatch} - ${error.message}`);
        }
    }

    return result;
}

/**
 * Evaluate a single expression using Node.js vm
 */
function evaluateExpression(expression: string, context: ExpressionContext): any {
    try {
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        const sandbox = {
            // Context data
            $json: context.$json,
            $node: context.$node,
            $execution: context.$execution,
            $item: context.$item,
            $index: context.$index,

            // Built-in functions/variables
            $now: now.toISOString(),
            $today: today.toISOString(),
            $yesterday: yesterday.toISOString(),
            $tomorrow: tomorrow.toISOString(),

            $randomInt: (min: number, max: number) => {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            },

            $base64Encode: (str: string) => {
                return Buffer.from(str).toString('base64');
            },

            $base64Decode: (str: string) => {
                return Buffer.from(str, 'base64').toString('utf8');
            },
        };

        return vm.runInNewContext(expression, sandbox, { timeout: 100 });
    } catch (error: any) {
        throw new Error(`Expression evaluation failed: ${error.message}`);
    }
}
