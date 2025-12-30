"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRegistry = void 0;
class NodeRegistry {
    constructor() {
        this.nodeTypes = new Map();
    }
    register(nodeType) {
        this.nodeTypes.set(nodeType.description.name, nodeType);
    }
    get(nodeName) {
        return this.nodeTypes.get(nodeName);
    }
    getAll() {
        return Array.from(this.nodeTypes.values());
    }
}
exports.NodeRegistry = NodeRegistry;
