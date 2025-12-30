export interface EvaluationContext {
    $json: any;
    $node: Record<string, any>;
    $execution?: {
        id: string;
        mode: string;
    };
    $index?: number;
    $item?: any;
}

/**
 * Evaluates expressions in a string for live preview.
 * This is a frontend-safe version of the ExpressionResolver.
 */
export function evaluateExpressionPreview(str: string, context: EvaluationContext): { value: any; error?: string } {
    if (!str || typeof str !== 'string') return { value: str };

    const expressionRegex = /\{\{([^}]+)\}\}/g;
    const matches = Array.from(str.matchAll(expressionRegex));

    if (matches.length === 0) return { value: str };

    // If entire string is one expression, return the resolved value directly
    if (matches.length === 1 && str.trim() === matches[0][0]) {
        try {
            const result = runExpression(matches[0][1].trim(), context);
            return { value: result };
        } catch (e: any) {
            return { value: undefined, error: e.message };
        }
    }

    let resultString = str;
    let hasError = false;
    let errorMessage = '';

    for (const match of matches) {
        try {
            const val = runExpression(match[1].trim(), context);
            resultString = resultString.replace(match[0], val === null || val === undefined ? '' : String(val));
        } catch (e: any) {
            hasError = true;
            errorMessage = e.message;
            break;
        }
    }

    if (hasError) return { value: undefined, error: errorMessage };
    return { value: resultString };
}

function runExpression(code: string, context: EvaluationContext): any {
    try {
        // Create a sandbox-like function
        // Note: Using new Function is generally risky, but here it's for design-time preview
        // and we control the context.
        const fn = new Function(
            '$json', '$node', '$execution', '$index', '$item',
            `try { return ${code}; } catch (e) { throw e; }`
        );

        return fn(
            context.$json || {},
            context.$node || {},
            context.$execution || { id: 'preview', mode: 'manual' },
            context.$index || 0,
            context.$item || {}
        );
    } catch (e: any) {
        throw new Error(`Evaluation failed: ${e.message}`);
    }
}
