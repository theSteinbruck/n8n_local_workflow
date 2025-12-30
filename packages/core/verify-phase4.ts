import { MockExecutionContext } from './mock-context';
import { CreatePresentationNode } from './src/nodes/core.createPresentation';

async function verifyPhase4() {
    console.log('--- Verifying Phase 4: PowerPoint Nodes ---');

    console.log('\n[1] Creating Presentation...');
    const createNode = new CreatePresentationNode();

    // Simulate 2 items = 2 slides
    const createInput = [
        { json: { title: 'Slide 1', body: 'Content 1' } },
        { json: { title: 'Slide 2', body: 'Content 2' } }
    ];

    // We map 'title' and 'body' parameters to the json keys
    // In MockContext, getNodeParameter with index is not fully supported for expression resolution
    // UNLESS we mocked it.
    // My CreatePresentationNode calls `context.getNodeParameter('title', i)`.
    // My MockExecutionContext `getNodeParameter` ignores index/defaultValue usually?
    // Let's check MockExecutionContext.

    // My MockExecutionContext:
    // getNodeParameter(name, defaultValue) { return this.parameters[name] ... }
    // It ignores the second argument (which is index in loop).
    // So it returns the static parameter value.
    // If I want to verify "Different Titles", I need to mock getNodeParameter better OR
    // just pass static value and verify slide count.

    // For Verification Purpose, verifying IT RUNS > verifying expression logic (which is engine responsibility).
    // I will set 'title' to static string 'My Slide'.

    const createContext = new MockExecutionContext(createInput, {
        fileName: 'presentation.pptx',
        title: 'My Slide', // Static for all slides
        body: 'Some content'
    });

    const createResult = await createNode.execute(createContext);

    if (createResult.length !== 1) {
        throw new Error(`Expected 1 output item, got ${createResult.length}`);
    }

    const outputJson = createResult[0].json;
    console.log('Output JSON:', outputJson);

    if (outputJson.slideCount !== 2) {
        throw new Error(`Expected slideCount 2, got ${outputJson.slideCount}`);
    }

    const binaryMeta = createResult[0].binary.data;
    if (binaryMeta.fileName !== 'presentation.pptx') {
        throw new Error(`Expected fileName presentation.pptx, got ${binaryMeta.fileName}`);
    }

    console.log('PPTX Created Successfully:', binaryMeta.fileName);
    console.log('--- Phase 4 Verification COMPLETE ---');
}

verifyPhase4().catch(err => {
    console.error('Verification FAILED:', err);
    process.exit(1);
});
