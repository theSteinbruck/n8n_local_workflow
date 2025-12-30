import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Workflow {
    id: string;
    name: string;
    active: boolean;
    nodes: any[];
    connections: any;
    createdAt: string;
    updatedAt: string;
}

export function DashboardPage() {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = () => {
        setLoading(true);
        fetch('/api/workflows')
            .then(res => res.json())
            .then(data => {
                setWorkflows(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch workflows', err);
                setLoading(false);
            });
    };

    const handleCreate = () => {
        fetch('/api/workflows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Untitled Workflow', nodes: [], connections: {} })
        })
            .then(res => res.json())
            .then(wf => {
                navigate(`/workflow/${wf.id}`);
            })
            .catch(err => {
                console.error('Failed to create workflow', err);
            });
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this workflow?')) return;

        fetch(`/api/workflows/${id}`, { method: 'DELETE' })
            .then(() => {
                fetchWorkflows();
            })
            .catch(err => console.error('Failed to delete workflow', err));
    };

    return (
        <div style={{ padding: '40px', fontFamily: 'Inter, sans-serif', maxWidth: '1000px', margin: '0 auto', color: '#333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Workflows</h1>
                <button
                    onClick={handleCreate}
                    style={{
                        background: '#ff6d5a', // n8n orange-ish
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        fontWeight: 500
                    }}
                >
                    Create workflow
                </button>
            </div>

            {loading ? (
                <div>Loading workflows...</div>
            ) : workflows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', background: '#f9f9fa', borderRadius: '8px' }}>
                    <p style={{ color: '#666', marginBottom: '20px' }}>No workflows found.</p>
                    <button onClick={handleCreate} style={{ background: 'transparent', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                        Create one from scratch
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {workflows.map(wf => (
                        <div
                            key={wf.id}
                            onClick={() => navigate(`/workflow/${wf.id}`)}
                            style={{
                                background: 'white',
                                border: '1px solid #eee',
                                borderRadius: '8px',
                                padding: '20px',
                                cursor: 'pointer',
                                transition: 'box-shadow 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'}
                        >
                            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px', color: '#333' }}>
                                {wf.name || 'Untitled Workflow'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
                                ID: {wf.id.substring(0, 8)}...
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                    fontSize: '12px',
                                    padding: '4px 8px',
                                    borderRadius: '12px',
                                    background: wf.active ? '#e3fcef' : '#f4f5f7',
                                    color: wf.active ? '#006644' : '#42526e'
                                }}>
                                    {wf.active ? 'Active' : 'Inactive'}
                                </span>
                                <button
                                    onClick={(e) => handleDelete(e, wf.id)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#de350b',
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
