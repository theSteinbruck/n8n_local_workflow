import { Request, Response, NextFunction } from 'express';

/**
 * API Key Authentication Middleware
 * 
 * Validates the Authorization header against API_KEY environment variable.
 */

const API_KEY = process.env.API_KEY;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!API_KEY) {
        console.warn('WARNING: API_KEY environment variable is not set. API is UNPROTECTED.');
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
    }

    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Authorization format. Use: Bearer <API_KEY>' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (token !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }

    next();
}

/**
 * Validate API key for WebSocket connections
 * Returns true if authenticated, false otherwise
 */
export function validateSocketAuth(authHeader: string | undefined): boolean {
    if (!API_KEY) {
        return true;
    }

    if (!authHeader) {
        return false;
    }

    if (!authHeader.startsWith('Bearer ')) {
        return false;
    }

    const token = authHeader.substring(7);
    return token === API_KEY;
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
    return !!API_KEY;
}
