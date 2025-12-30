import { MockExecutionContext } from './mock-context';
import { CreateWordNode } from './src/nodes/core.createWord';
import { TemplateWordNode } from './src/nodes/core.templateWord';
import PizZip from 'pizzip';

async function verifyPhase3() {
    console.log('--- Verifying Phase 3: Word Nodes ---');

    console.log('\n[1] Creating Template Doc...');
    const createNode = new CreateWordNode();
    // docxtemplater defaults to {tag}
    const createInput = [{ json: {} }];
    const createContext = new MockExecutionContext(createInput, {
        content: 'Hello {name}',
        fileName: 'template.docx',
        binaryPropertyName: 'data' // default
    });

    const createResult = await createNode.execute(createContext);
    const templateBinaryArg = createResult[0].binary.data;
    console.log('Template Created:', templateBinaryArg.fileName);

    console.log('\n[2] Applying Template...');
    const templateNode = new TemplateWordNode();
    const templateInput = [{
        json: { name: 'ERA' },
        binary: { template: templateBinaryArg }
    }];

    const templateContext = new MockExecutionContext(templateInput, {
        binaryPropertyName: 'template',
        outputBinaryPropertyName: 'output',
        fileName: 'filled.docx'
    });

    const templateResult = await templateNode.execute(templateContext);
    const outputBinaryArg = templateResult[0].binary.output;
    console.log('Filled Doc Created:', outputBinaryArg.fileName);

    // Verify Content
    console.log('\n[3] Verifying Content...');
    const outputBuffer = await new MockExecutionContext(templateResult, {}).getBinaryData('output');

    // Unzip and read document.xml
    const zip = new PizZip(outputBuffer);
    const xml = zip.file('word/document.xml')?.asText();

    if (!xml) {
        throw new Error('Could not read word/document.xml from output file');
    }

    console.log('XML snippet:', xml.substring(0, 200));

    if (xml.includes('Hello ERA')) {
        console.log('SUCCESS: Found "Hello ERA" in document.');
    } else {
        throw new Error('Verification FAILED: Did not find "Hello ERA" in document.');
    }
}

verifyPhase3().catch(err => {
    console.error('Verification FAILED:', err);
    process.exit(1);
});
