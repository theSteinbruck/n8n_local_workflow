import React, { useState, useMemo } from 'react';
import { useNodeTypes, type NodeType } from '../hooks/useNodeTypes';

export const LeftSidebar = () => {
    const { nodeTypes, loading } = useNodeTypes();
    const [search, setSearch] = useState('');

    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const nodeList = useMemo(() => Object.values(nodeTypes), [nodeTypes]);

    const filteredNodes = useMemo(() => {
        const lowerSearch = search.toLowerCase();
        return nodeList.filter((n: NodeType) =>
            n.displayName.toLowerCase().includes(lowerSearch) ||
            n.name.toLowerCase().includes(lowerSearch) ||
            n.description.toLowerCase().includes(lowerSearch)
        );
    }, [nodeList, search]);

    const triggers = filteredNodes.filter((n: NodeType) => n.isTrigger);

    const docKeywords = ['Word', 'Excel', 'Text', 'PowerPoint', 'PPT', 'Presentation', 'Document'];
    const isDocNode = (n: NodeType) => docKeywords.some(k => n.displayName.includes(k));

    const documentNodes = filteredNodes.filter((n: NodeType) => !n.isTrigger && isDocNode(n));
    const actions = filteredNodes.filter((n: NodeType) => !n.isTrigger && !isDocNode(n));

    const renderNodeList = (nodes: NodeType[], title: string) => (
        <div style={{ marginBottom: '20px' }}>
            <div style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#999',
                marginBottom: '10px',
                letterSpacing: '0.5px'
            }}>
                {title} ({nodes.length})
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
                {nodes.map((node) => (
                    <div
                        key={node.name}
                        onDragStart={(event) => onDragStart(event, node.name)}
                        draggable={true}
                        style={{
                            padding: '10px',
                            background: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}
                    >
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>{node.displayName}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{node.description}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div style={{
            width: '300px',
            height: '100%',
            background: '#f8f9fa',
            borderRight: '1px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
        }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                <input
                    type="text"
                    placeholder="Search nodes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                    }}
                />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '40px', fontSize: '14px' }}>
                        Loading nodes...
                    </div>
                ) : (
                    <>
                        {triggers.length > 0 && renderNodeList(triggers, 'Triggers')}
                        {documentNodes.length > 0 && renderNodeList(documentNodes, 'Documents')}
                        {actions.length > 0 && renderNodeList(actions, 'Actions')}
                        {filteredNodes.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#999', marginTop: '40px', fontSize: '14px' }}>
                                No nodes found
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
