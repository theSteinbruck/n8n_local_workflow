import { useParams } from 'react-router-dom';
import { WorkflowCanvas } from '../WorkflowCanvas';

export function EditorPage() {
    const { id } = useParams();

    if (!id) return <div>Error: No Workflow ID</div>;

    return (
        <WorkflowCanvas workflowId={id} />
    );
}
