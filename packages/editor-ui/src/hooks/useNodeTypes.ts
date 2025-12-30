import { useState, useEffect } from 'react';

export interface NodeProperty {
    displayName: string;
    name: string;
    type: 'string' | 'number' | 'boolean' | 'options' | 'json';
    default: any;
    description?: string;
    required?: boolean;
    options?: Array<{ name: string; value: any }>;
}

export interface NodeType {
    name: string;
    displayName: string;
    description: string;
    group: string[];
    properties: NodeProperty[];
    isTrigger: boolean;
}

export const useNodeTypes = () => {
    const [nodeTypes, setNodeTypes] = useState<Record<string, NodeType>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/nodes')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch node types');
                return res.json();
            })
            .then(data => {
                const map: Record<string, NodeType> = {};
                data.forEach((node: NodeType) => {
                    map[node.name] = node;
                });
                setNodeTypes(map);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching node types:', err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    return { nodeTypes, loading, error };
};
