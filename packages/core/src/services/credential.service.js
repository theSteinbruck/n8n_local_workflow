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
exports.CredentialService = void 0;
const database_1 = require("@local-n8n/database");
const crypto_1 = require("crypto");
const crypto = __importStar(require("crypto"));
class CredentialService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.encryptionKey = process.env.N8N_ENCRYPTION_KEY || '';
        if (!this.encryptionKey) {
            throw new Error('FATAL: N8N_ENCRYPTION_KEY environment variable is required');
        }
        // Ensure key is 32 bytes for AES-256
        if (Buffer.from(this.encryptionKey).length !== 32) {
            throw new Error('FATAL: N8N_ENCRYPTION_KEY must be exactly 32 bytes');
        }
    }
    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey), iv);
        const jsonData = JSON.stringify(data);
        let encrypted = cipher.update(jsonData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        // Format: iv:authTag:encryptedData
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }
    decrypt(encryptedData) {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }
    maskData(data) {
        if (typeof data !== 'object' || data === null) {
            return '***';
        }
        const masked = {};
        for (const key in data) {
            masked[key] = '***';
        }
        return masked;
    }
    async createCredential(data) {
        const id = (0, crypto_1.randomUUID)();
        const now = new Date();
        const encryptedData = this.encrypt(data.data);
        const result = await database_1.db.insert(database_1.credentials).values({
            id,
            name: data.name,
            type: data.type,
            data: encryptedData,
            createdAt: now,
            updatedAt: now,
        }).returning();
        return result[0];
    }
    async updateCredential(id, data) {
        const now = new Date();
        const updateData = {
            updatedAt: now,
        };
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.type !== undefined)
            updateData.type = data.type;
        if (data.data !== undefined) {
            updateData.data = this.encrypt(data.data);
        }
        const result = await database_1.db.update(database_1.credentials)
            .set(updateData)
            .where((0, database_1.eq)(database_1.credentials.id, id))
            .returning();
        return result[0];
    }
    async getCredentialById(id, decrypt = false) {
        const result = await database_1.db.select().from(database_1.credentials).where((0, database_1.eq)(database_1.credentials.id, id)).limit(1);
        if (result.length === 0) {
            return null;
        }
        const credential = result[0];
        if (decrypt) {
            return {
                ...credential,
                data: this.decrypt(credential.data)
            };
        }
        else {
            return {
                ...credential,
                data: this.maskData(this.decrypt(credential.data))
            };
        }
    }
    async listCredentials() {
        const result = await database_1.db.select().from(database_1.credentials).all();
        return result.map(cred => ({
            ...cred,
            data: this.maskData(this.decrypt(cred.data))
        }));
    }
    async decryptCredentialData(id) {
        const credential = await this.getCredentialById(id, true);
        return credential?.data || null;
    }
}
exports.CredentialService = CredentialService;
