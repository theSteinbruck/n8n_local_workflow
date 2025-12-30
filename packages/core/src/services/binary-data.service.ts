import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { IBinaryData, BinaryDataOptions } from '../execution/node-interfaces';

const BINARY_STORAGE_DIR = path.join(process.cwd(), '.binary-data');

export class BinaryDataService {
    constructor() {
        // Ensure storage directory exists
        if (!fs.existsSync(BINARY_STORAGE_DIR)) {
            fs.mkdirSync(BINARY_STORAGE_DIR, { recursive: true });
        }
    }

    /**
     * Store binary data - always writes to filesystem to satisfy filePath requirement
     */
    async storeBinaryData(data: Buffer, options: BinaryDataOptions): Promise<IBinaryData> {
        const id = crypto.randomUUID();
        const fileSize = data.length;
        const filePath = path.join(BINARY_STORAGE_DIR, id);

        await fs.promises.writeFile(filePath, data);

        return {
            id,
            filePath,
            fileName: options.fileName,
            mimeType: options.mimeType,
            fileSize,
            // Include a small snippet of base64 if it's very small, for UI convenience
            data: fileSize < 1024 ? data.toString('base64') : undefined
        };
    }

    /**
     * Retrieve binary data from a file path
     */
    async readBinaryFile(filePath: string): Promise<Buffer> {
        return await fs.promises.readFile(filePath);
    }

    async writeBinaryFile(fileName: string, mimeType: string, data: Buffer): Promise<IBinaryData> {
        return this.storeBinaryData(data, { fileName, mimeType });
    }

    /**
     * Create a temporary binary file (alias for write for now, but logical distinction)
     */
    async createTempFile(fileName: string, mimeType: string, data: Buffer): Promise<IBinaryData> {
        return this.writeBinaryFile(`temp_${Date.now()}_${fileName}`, mimeType, data);
    }

    /**
     * Delete stored binary data by path
     */
    async cleanupBinaryFile(filePath: string): Promise<void> {
        try {
            await fs.promises.unlink(filePath);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * Retrieve binary data from storage object
     */
    async retrieveBinaryData(binaryData: IBinaryData): Promise<Buffer> {
        if (binaryData.filePath) {
            return await this.readBinaryFile(binaryData.filePath);
        } else if (binaryData.data) {
            return Buffer.from(binaryData.data, 'base64');
        } else {
            throw new Error(`Binary data ${binaryData.id} has no filePath or data`);
        }
    }

    /**
     * Clean up all binary data files older than the specified age (in milliseconds)
     */
    async cleanupOldData(maxAgeMs: number): Promise<number> {
        const now = Date.now();
        let deletedCount = 0;

        try {
            const files = await fs.promises.readdir(BINARY_STORAGE_DIR);
            for (const file of files) {
                const filePath = path.join(BINARY_STORAGE_DIR, file);
                const stats = await fs.promises.stat(filePath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    await fs.promises.unlink(filePath);
                    deletedCount++;
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        return deletedCount;
    }
}
