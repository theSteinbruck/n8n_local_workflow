import { BinaryDataService } from './src/services/binary-data.service';
import * as fs from 'fs';
import * as path from 'path';

async function verifyBinaryContract() {
    console.log('--- Verifying Phase 1: Binary Contract ---');
    const service = new BinaryDataService();
    const testData = Buffer.from('Hello ERA Binary Contract!');
    const options = { fileName: 'test.txt', mimeType: 'text/plain' };

    // 1. Write File
    console.log('1. Testing writeBinaryFile...');
    const binaryMeta = await service.writeBinaryFile(options.fileName, options.mimeType, testData);
    console.log('Generated Meta:', JSON.stringify(binaryMeta, null, 2));

    if (!binaryMeta.filePath || !fs.existsSync(binaryMeta.filePath)) {
        throw new Error('FAILED: filePath is missing or file does not exist on disk.');
    }
    console.log('SUCCESS: File exists at', binaryMeta.filePath);

    // 2. Read File
    console.log('2. Testing readBinaryFile...');
    const readData = await service.readBinaryFile(binaryMeta.filePath);
    if (readData.toString() !== testData.toString()) {
        throw new Error('FAILED: Content mismatch.');
    }
    console.log('SUCCESS: Content matches.');

    // 3. Temp File
    console.log('3. Testing createTempFile...');
    const tempMeta = await service.createTempFile('temp.txt', 'text/plain', Buffer.from('Temp data'));
    console.log('Temp Meta:', JSON.stringify(tempMeta, null, 2));
    if (!tempMeta.fileName.includes('temp_')) {
        throw new Error('FAILED: Temp file name pattern not found.');
    }
    console.log('SUCCESS: Temp file created.');

    // 4. Cleanup
    console.log('4. Testing cleanupBinaryFile...');
    await service.cleanupBinaryFile(binaryMeta.filePath);
    if (fs.existsSync(binaryMeta.filePath)) {
        throw new Error('FAILED: File still exists after cleanup.');
    }
    await service.cleanupBinaryFile(tempMeta.filePath);
    console.log('SUCCESS: Cleanup verified.');

    console.log('--- Phase 1 Verification COMPLETE ---');
}

verifyBinaryContract().catch(err => {
    console.error('Verification FAILED:', err);
    process.exit(1);
});
