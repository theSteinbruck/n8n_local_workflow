"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createScopedLogger)('plugin-loader');
class PluginLoader {
    constructor(nodeRegistry) {
        this.nodeRegistry = nodeRegistry;
    }
    /**
     * Load all nodes from a directory
     */
    async loadFromDirectory(dir) {
        const result = {
            loaded: [],
            failed: [],
        };
        if (!fs.existsSync(dir)) {
            logger.warn({ directory: dir }, 'directoryNotFound');
            return result;
        }
        const files = fs.readdirSync(dir);
        const nodeFiles = files.filter(f => (f.endsWith('.js') || f.endsWith('.ts')) &&
            !f.endsWith('.d.ts') &&
            !f.includes('.test.') &&
            !f.includes('.spec.'));
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
            }
            catch (error) {
                result.failed.push({ file, error: error.message });
                logger.error({ file, error: error.message }, 'nodeLoadFailed');
            }
        }
        return result;
    }
    /**
     * Load a single node from a file
     */
    async loadNode(filePath) {
        const absolutePath = path.resolve(filePath);
        // Dynamic import (works for both .ts with tsx and compiled .js)
        const module = await Promise.resolve(`${absolutePath}`).then(s => __importStar(require(s)));
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
                    return exported;
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
    isNodeClass(fn) {
        try {
            // Check if prototype has execute method
            return typeof fn.prototype?.execute === 'function';
        }
        catch {
            return false;
        }
    }
    /**
     * Check if an object looks like a node instance
     */
    isNodeInstance(obj) {
        return (typeof obj === 'object' &&
            obj !== null &&
            typeof obj.description === 'object' &&
            typeof obj.execute === 'function');
    }
    /**
     * Validate that an object implements INodeType
     */
    validateNode(node) {
        if (!node || typeof node !== 'object') {
            return false;
        }
        // Check required properties
        if (!node.description || typeof node.description !== 'object') {
            return false;
        }
        const desc = node.description;
        if (typeof desc.name !== 'string' ||
            typeof desc.displayName !== 'string' ||
            typeof desc.description !== 'string' ||
            !Array.isArray(desc.inputs) ||
            !Array.isArray(desc.outputs)) {
            return false;
        }
        // Check execute method
        if (typeof node.execute !== 'function') {
            return false;
        }
        return true;
    }
}
exports.PluginLoader = PluginLoader;
