import { MockExecutionContext } from './mock-context';
import { WriteTextFileNode } from './src/nodes/core.writeTextFile';
import { ReadTextFileNode } from './src/nodes/core.readTextFile';
import { AppendTextFileNode } from './src/nodes/core.appendTextFile';
import { CreateExcelNode } from './src/nodes/core.createExcel';
import { ReadExcelNode } from './src/nodes/core.readExcel';
import { UpdateExcelNode } from './src/nodes/core.updateExcel';

async function verifyPhase2() {
    console.log('--- Verifying Phase 2: TXT & Excel Nodes ---');

    // 1. TXT Verification
    console.log('\n[1] Verifying TXT Nodes...');

    // Write
    const writeNode = new WriteTextFileNode();
    const writeContext = new MockExecutionContext([{ json: {} }], {
        textContent: 'Hello World',
        fileName: 'test_phase2.txt',
        mimeType: 'text/plain'
    });
    const writeResult = await writeNode.execute(writeContext);
    const binaryData = writeResult[0].binary.data;
    console.log('Write Result:', binaryData.fileName);

    // Append
    const appendNode = new AppendTextFileNode();
    const appendContext = new MockExecutionContext(writeResult, {
        textContent: 'Appended Line'
    });
    const appendResult = await appendNode.execute(appendContext);

    // Read
    const readNode = new ReadTextFileNode();
    const readContext = new MockExecutionContext(appendResult, {
        encoding: 'utf8'
    });
    const readResult = await readNode.execute(readContext);
    const content = readResult[0].json.text;

    if (!content.includes('Hello World') || !content.includes('Appended Line')) {
        throw new Error(`TXT Verification Failed: Content mismatch. Got: ${content}`);
    }
    console.log('TXT Success: Content verified.');

    // 2. Excel Verification
    console.log('\n[2] Verifying Excel Nodes...');

    // Create
    const createNode = new CreateExcelNode();
    const inputStart = [{ json: { name: 'Alice', role: 'Dev' } }, { json: { name: 'Bob', role: 'Manager' } }];
    const createContext = new MockExecutionContext(inputStart, {
        fileName: 'test_phase2.xlsx',
        sheetName: 'Staff'
    });
    const createResult = await createNode.execute(createContext);
    console.log('Excel Created:', createResult.json);

    // Update (Append)
    const updateNode = new UpdateExcelNode();
    const updateInput = [{
        json: { name: 'Charlie', role: 'Designer' },
        binary: createResult.binary
    }];
    const updateContext = new MockExecutionContext(updateInput, {
        operation: 'append',
        sheetName: 'Staff'
    });
    const updateResult = await updateNode.execute(updateContext);

    // Read
    const readExcelNode = new ReadExcelNode();
    const readExcelContext = new MockExecutionContext([{ json: {}, binary: updateResult.binary }], {
        sheetName: 'Staff'
    });
    const readExcelResult = await readExcelNode.execute(readExcelContext);

    console.log('Read Excel Rows:', readExcelResult.length);
    const names = readExcelResult.map(r => r.json.name);

    if (!names.includes('Alice') || !names.includes('Charlie')) {
        throw new Error(`Excel Verification Failed: Missing names. Got: ${names.join(', ')}`);
    }

    console.log('Excel Success: All rows found.');

    console.log('\n--- Phase 2 Verification COMPLETE ---');
}

verifyPhase2().catch(err => {
    console.error('Verification FAILED:', err);
    process.exit(1);
});
