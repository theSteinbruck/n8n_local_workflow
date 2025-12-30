export interface RetryConfig {
    maxRetries: number;
    backoffMs: number;
    onError?: 'stop' | 'continue';
}

export async function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
