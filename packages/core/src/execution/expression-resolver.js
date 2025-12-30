"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveExpressions = resolveExpressions;
const vm_1 = __importDefault(require("vm"));
/**
 * Resolve expressions in a value (string, object, or array)
 */
function resolveExpressions(value, context) {
    if (typeof value === 'string') {
        return resolveStringExpressions(value, context);
    }
    if (Array.isArray(value)) {
        return value.map(item => resolveExpressions(item, context));
    }
    if (value && typeof value === 'object') {
        const resolved = {};
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
function resolveStringExpressions(str, context) {
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
        }
        catch (error) {
            throw new Error(`Invalid expression: ${fullMatch} - ${error.message}`);
        }
    }
    return result;
}
/**
 * Evaluate a single expression using Node.js vm
 */
function evaluateExpression(expression, context) {
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
            $randomInt: (min, max) => {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            },
            $base64Encode: (str) => {
                return Buffer.from(str).toString('base64');
            },
            $base64Decode: (str) => {
                return Buffer.from(str, 'base64').toString('utf8');
            },
        };
        return vm_1.default.runInNewContext(expression, sandbox, { timeout: 100 });
    }
    catch (error) {
        throw new Error(`Expression evaluation failed: ${error.message}`);
    }
}
