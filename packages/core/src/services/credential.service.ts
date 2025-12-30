import { db, credentials, eq } from '@local-n8n/database';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

export class CredentialService {
    private encryptionKey: string;
    private algorithm = 'aes-256-gcm';

    constructor() {
        this.encryptionKey = process.env.N8N_ENCRYPTION_KEY || '';

        if (!this.encryptionKey) {
            console.warn('⚠️ WARNING: N8N_ENCRYPTION_KEY is not set. Using a default key for development. THIS IS INSECURE FOR PRODUCTION.');
            // Using a stable 32-byte default for development
            this.encryptionKey = 'local-dev-stable-key-32-bytes-!!';
        }

        // Ensure key is 32 bytes for AES-256
        if (Buffer.from(this.encryptionKey).length !== 32) {
            throw new Error(`FATAL: N8N_ENCRYPTION_KEY must be exactly 32 bytes (got ${Buffer.from(this.encryptionKey).length})`);
        }
    }

    private encrypt(data: any): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey), iv);

        const jsonData = JSON.stringify(data);
        let encrypted = cipher.update(jsonData, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = (cipher as any).getAuthTag();

        // Format: iv:authTag:encryptedData
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    private decrypt(encryptedData: string): any {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey), iv);
        (decipher as any).setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    private maskData(data: any): any {
        if (typeof data !== 'object' || data === null) {
            return '***';
        }

        const masked: any = {};
        for (const key in data) {
            masked[key] = '***';
        }
        return masked;
    }

    async createCredential(data: { name: string; type: string; data: any }) {
        const id = randomUUID();
        const now = new Date();

        const encryptedData = this.encrypt(data.data);

        const result = await db.insert(credentials).values({
            id,
            name: data.name,
            type: data.type,
            data: encryptedData,
            createdAt: now,
            updatedAt: now,
        }).returning();

        return result[0];
    }

    async updateCredential(id: string, data: { name?: string; type?: string; data?: any }) {
        const now = new Date();

        const updateData: any = {
            updatedAt: now,
        };

        if (data.name !== undefined) updateData.name = data.name;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.data !== undefined) {
            updateData.data = this.encrypt(data.data);
        }

        const result = await db.update(credentials)
            .set(updateData)
            .where(eq(credentials.id, id))
            .returning();

        return result[0];
    }

    async getCredentialById(id: string, decrypt: boolean = false) {
        const result = await db.select().from(credentials).where(eq(credentials.id, id)).limit(1);

        if (result.length === 0) {
            return null;
        }

        const credential = result[0];

        if (decrypt) {
            return {
                ...credential,
                data: this.decrypt(credential.data as string)
            };
        } else {
            return {
                ...credential,
                data: this.maskData(this.decrypt(credential.data as string))
            };
        }
    }

    async listCredentials() {
        const result = await db.select().from(credentials).all();

        return result.map(cred => ({
            ...cred,
            data: this.maskData(this.decrypt(cred.data as string))
        }));
    }

    async decryptCredentialData(id: string): Promise<any> {
        const credential = await this.getCredentialById(id, true);
        return credential?.data || null;
    }
}
