import { INodeType } from './node-interfaces';

export class NodeRegistry {
    private nodeTypes: Map<string, INodeType> = new Map();

    register(nodeType: INodeType) {
        this.nodeTypes.set(nodeType.description.name, nodeType);
    }

    get(nodeName: string): INodeType | undefined {
        return this.nodeTypes.get(nodeName);
    }

    getAll(): INodeType[] {
        return Array.from(this.nodeTypes.values());
    }
}
