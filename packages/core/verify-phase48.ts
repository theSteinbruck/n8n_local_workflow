import { BinaryDataService } from './src/services/binary-data.service';
import { NodeExecutionContext } from './src/execution/node-execution-context';

async function verifyPhase48() {
    console.log('🧪 Phase 48 Verification: Binary Data Support\n');

    const binaryDataService = new BinaryDataService();

    // Test 1: Store and retrieve small binary data (inline base64)
    console.log('Test 1: Store and retrieve small binary data (< 1MB as base64)');
    const smallData = Buffer.from('Hello, Binary World!');
    const smallBinary = await binaryDataService.storeBinaryData(smallData, {
        fileName: 'hello.txt',
        mimeType: 'text/plain'
    });

    if (smallBinary.data && !smallBinary.filePath) {
        console.log('✅ Small data stored as inline base64');
    } else {
        console.error('❌ Small data should be stored inline');
        process.exit(1);
    }

    const retrievedSmall = await binaryDataService.retrieveBinaryData(smallBinary);
    if (retrievedSmall.toString() === 'Hello, Binary World!') {
        console.log('✅ Small data retrieved correctly');
    } else {
        console.error('❌ Failed to retrieve small data');
        process.exit(1);
    }

    // Test 2: Store and retrieve large binary data (filesystem)
    console.log('\nTest 2: Store and retrieve large binary data (> 1MB via filesystem)');
    const largeData = Buffer.alloc(1024 * 1024 + 100, 'X'); // 1MB + 100 bytes
    const largeBinary = await binaryDataService.storeBinaryData(largeData, {
        fileName: 'large-file.bin',
        mimeType: 'application/octet-stream'
    });

    if (largeBinary.filePath && !largeBinary.data) {
        console.log('✅ Large data stored to filesystem');
    } else {
        console.error('❌ Large data should be stored to filesystem');
        process.exit(1);
    }

    const retrievedLarge = await binaryDataService.retrieveBinaryData(largeBinary);
    if (retrievedLarge.length === largeData.length && retrievedLarge[0] === 88) { // 88 = 'X'
        console.log('✅ Large data retrieved correctly');
    } else {
        console.error('❌ Failed to retrieve large data');
        process.exit(1);
    }

    // Cleanup large file
    await binaryDataService.deleteBinaryData(largeBinary.id);
    console.log('✅ Large binary data cleaned up');

    // Test 3: NodeExecutionContext binary helpers
    console.log('\nTest 3: NodeExecutionContext binary helpers');
    const mockNode = { parameters: {} };
    const inputData = { value: 'test' };
    const context = new NodeExecutionContext(inputData, mockNode);

    const testBuffer = Buffer.from('Test binary content');
    const storedBinary = await context.setBinaryData('myFile', testBuffer, {
        fileName: 'test.txt',
        mimeType: 'text/plain'
    });

    if (storedBinary.fileName === 'test.txt' && storedBinary.mimeType === 'text/plain') {
        console.log('✅ setBinaryData works correctly');
    } else {
        console.error('❌ setBinaryData failed');
        process.exit(1);
    }

    // Verify binary data is attached to input
    const updatedInput = context.getInputData();
    if (updatedInput.binary?.myFile) {
        console.log('✅ Binary data attached to execution context');
    } else {
        console.error('❌ Binary data not attached to context');
        process.exit(1);
    }

    // Test retrieval through context
    const retrieved = await context.getBinaryData('myFile');
    if (retrieved.toString() === 'Test binary content') {
        console.log('✅ getBinaryData works correctly');
    } else {
        console.error('❌ getBinaryData failed');
        process.exit(1);
    }

    // Test 4: Verify IBinaryData structure
    console.log('\nTest 4: Verify IBinaryData structure');
    if (
        storedBinary.id &&
        storedBinary.fileName === 'test.txt' &&
        storedBinary.mimeType === 'text/plain' &&
        storedBinary.fileSize === testBuffer.length
    ) {
        console.log('✅ IBinaryData structure is correct');
    } else {
        console.error('❌ IBinaryData structure invalid');
        process.exit(1);
    }

    console.log('\n🎉 Phase 48 Verified! Binary Data Support is working.');
    process.exit(0);
}

verifyPhase48().catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
});
