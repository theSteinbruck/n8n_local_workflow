import * as fs from 'fs';
import * as path from 'path';
import { INodeType } from './node-interfaces';
import { NodeRegistry } from './node-registry';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('plugin-loader');

export interface PluginLoadResult {
    loaded: string[];
    failed: Array<{ file: string; error: string }>;
}

export class PluginLoader {
    private nodeRegistry: NodeRegistry;

    constructor(nodeRegistry: NodeRegistry) {
        this.nodeRegistry = nodeRegistry;
    }

    /**
     * Load all nodes from a directory
     */
    async loadFromDirectory(dir: string): Promise<PluginLoadResult> {
        const result: PluginLoadResult = {
            loaded: [],
            failed: [],
        };

        if (!fs.existsSync(dir)) {
            logger.warn({ directory: dir }, 'directoryNotFound');
            return result;
        }

        const files = fs.readdirSync(dir);
        const nodeFiles = files.filter(f =>
            (f.endsWith('.js') || f.endsWith('.ts')) &&
            !f.endsWith('.d.ts') &&
            !f.includes('.test.') &&
            !f.includes('.spec.')
        );

        logger.info({ fileCount: nodeFiles.length, directory: dir }, 'potentialNodeFilesFound');

        for (const file of nodeFiles) {
            const filePath = path.join(dir, file);
            try {
                const node = await this.loadNode(filePath);
                if (node) {
                    this.nodeRegistry.register(node);
                    result.loaded.push(node.description.name);
                    logger.info({ node: node.description.name, file }, 'nodeLoaded');
                }
            } catch (error: any) {
                result.failed.push({ file, error: error.message });
                logger.error({ file, error: error.message }, 'nodeLoadFailed');
            }
        }

        return result;
    }

    /**
     * Load a single node from a file
     */
    async loadNode(filePath: string): Promise<INodeType | null> {
        const absolutePath = path.resolve(filePath);

        // Dynamic import (works for both .ts with tsx and compiled .js)
        const module = await import(absolutePath);

        // Look for exported node class or default export
        let nodeClass = module.default;

        // If no default export, look for any exported class that looks like a node
        if (!nodeClass) {
            for (const key of Object.keys(module)) {
                const exported = module[key];
                if (typeof exported === 'function' && this.isNodeClass(exported)) {
                    nodeClass = exported;
                    break;
                }
                // Also check if it's already an instance
                if (typeof exported === 'object' && this.isNodeInstance(exported)) {
                    return exported as INodeType;
                }
            }
        }

        if (!nodeClass) {
            throw new Error('No node class found in module');
        }

        // If it's a class, instantiate it
        if (typeof nodeClass === 'function') {
            const instance = new nodeClass();
            if (this.validateNode(instance)) {
                return instance;
            }
        }

        // If it's already an object (from createNode helper)
        if (typeof nodeClass === 'object' && this.validateNode(nodeClass)) {
            return nodeClass;
        }

        throw new Error('Module does not export a valid node');
    }

    /**
     * Check if a function looks like a node class
     */
    private isNodeClass(fn: any): boolean {
        try {
            // Check if prototype has execute method
            return typeof fn.prototype?.execute === 'function';
        } catch {
            return false;
        }
    }

    /**
     * Check if an object looks like a node instance
     */
    private isNodeInstance(obj: any): boolean {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            typeof obj.description === 'object' &&
            typeof obj.execute === 'function'
        );
    }

    /**
     * Validate that an object implements INodeType
     */
    validateNode(node: any): node is INodeType {
        if (!node || typeof node !== 'object') {
            return false;
        }

        // Check required properties
        if (!node.description || typeof node.description !== 'object') {
            return false;
        }

        const desc = node.description;
        if (
            typeof desc.name !== 'string' ||
            typeof desc.displayName !== 'string' ||
            typeof desc.description !== 'string' ||
            !Array.isArray(desc.inputs) ||
            !Array.isArray(desc.outputs)
        ) {
            return false;
        }

        // Check execute method
        if (typeof node.execute !== 'function') {
            return false;
        }

        return true;
    }
}
