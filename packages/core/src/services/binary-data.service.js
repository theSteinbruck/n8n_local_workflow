"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryDataService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// 1MB threshold - below this, store as base64 inline
const INLINE_THRESHOLD = 1024 * 1024;
// Storage directory for large binary files
const BINARY_STORAGE_DIR = path.join(process.cwd(), '.binary-data');
class BinaryDataService {
    constructor() {
        // Ensure storage directory exists
        if (!fs.existsSync(BINARY_STORAGE_DIR)) {
            fs.mkdirSync(BINARY_STORAGE_DIR, { recursive: true });
        }
    }
    /**
     * Store binary data - inline as base64 for small files, filesystem for large
     */
    async storeBinaryData(data, options) {
        const id = crypto.randomUUID();
        const fileSize = data.length;
        if (fileSize < INLINE_THRESHOLD) {
            // Small data: store inline as base64
            return {
                id,
                data: data.toString('base64'),
                mimeType: options.mimeType,
                fileName: options.fileName,
                fileSize,
            };
        }
        else {
            // Large data: store on filesystem
            const filePath = path.join(BINARY_STORAGE_DIR, id);
            await fs.promises.writeFile(filePath, data);
            return {
                id,
                mimeType: options.mimeType,
                fileName: options.fileName,
                fileSize,
                filePath,
            };
        }
    }
    /**
     * Retrieve binary data from storage
     */
    async retrieveBinaryData(binaryData) {
        if (binaryData.data) {
            // Inline base64 data
            return Buffer.from(binaryData.data, 'base64');
        }
        else if (binaryData.filePath) {
            // Filesystem stored data
            return await fs.promises.readFile(binaryData.filePath);
        }
        else {
            throw new Error(`Binary data ${binaryData.id} has no data or filePath`);
        }
    }
    /**
     * Delete stored binary data
     */
    async deleteBinaryData(id) {
        const filePath = path.join(BINARY_STORAGE_DIR, id);
        try {
            await fs.promises.unlink(filePath);
        }
        catch (error) {
            // Ignore if file doesn't exist (was inline)
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    /**
     * Clean up all binary data files older than the specified age (in milliseconds)
     */
    async cleanupOldData(maxAgeMs) {
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
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        return deletedCount;
    }
}
exports.BinaryDataService = BinaryDataService;
