"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpRequestNode = void 0;
const credential_service_1 = require("../services/credential.service");
class HttpRequestNode {
    constructor() {
        this.description = {
            displayName: 'HTTP Request',
            name: 'HttpRequest',
            group: ['transform'],
            version: 1,
            description: 'Makes an HTTP request',
            defaults: {
                name: 'HTTP Request',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Method',
                    name: 'method',
                    type: 'options',
                    options: [
                        { name: 'GET', value: 'GET' },
                        { name: 'POST', value: 'POST' }
                    ],
                    default: 'GET',
                },
                {
                    displayName: 'URL',
                    name: 'url',
                    type: 'string',
                    default: '',
                },
                {
                    displayName: 'Headers',
                    name: 'headers',
                    type: 'json',
                    default: {},
                },
                {
                    displayName: 'Body',
                    name: 'body',
                    type: 'json',
                    default: {},
                    displayOptions: {
                        show: {
                            method: ['POST']
                        }
                    }
                },
                {
                    displayName: 'Credential',
                    name: 'credentialId',
                    type: 'string',
                    default: '',
                    description: 'Optional credential ID for authentication'
                },
                {
                    displayName: 'Response Format',
                    name: 'responseFormat',
                    type: 'options',
                    options: [
                        { name: 'Auto Detect', value: 'auto' },
                        { name: 'JSON', value: 'json' },
                        { name: 'Text', value: 'text' },
                        { name: 'Binary', value: 'binary' }
                    ],
                    default: 'auto',
                    description: 'How to interpret the response data'
                }
            ],
        };
    }
    async execute(context) {
        const method = context.getNodeParameter('method', 'GET');
        const url = context.getNodeParameter('url', '');
        const headers = context.getNodeParameter('headers', {});
        const body = context.getNodeParameter('body', {});
        const credentialId = context.getNodeParameter('credentialId', '');
        const responseFormat = context.getNodeParameter('responseFormat', 'auto');
        if (!url) {
            throw new Error('URL is required');
        }
        // Load credential if provided
        let credentialData = null;
        if (credentialId) {
            const credentialService = new credential_service_1.CredentialService();
            credentialData = await credentialService.decryptCredentialData(credentialId);
            if (!credentialData) {
                throw new Error(`Credential ${credentialId} not found`);
            }
        }
        try {
            const requestHeaders = {
                'Content-Type': 'application/json',
                ...headers
            };
            // Inject credential headers if present
            if (credentialData) {
                if (credentialData.Authorization) {
                    requestHeaders['Authorization'] = credentialData.Authorization;
                }
                // Merge any other headers from credential
                Object.assign(requestHeaders, credentialData);
            }
            const options = {
                method,
                headers: requestHeaders,
                signal: context.signal
            };
            if (method === 'POST' && body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);
            // Convert headers to plain object
            const responseHeaders = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            // Determine response handling based on format
            const contentType = response.headers.get('content-type') || '';
            let effectiveFormat = responseFormat;
            if (responseFormat === 'auto') {
                if (contentType.includes('application/json')) {
                    effectiveFormat = 'json';
                }
                else if (contentType.startsWith('text/')) {
                    effectiveFormat = 'text';
                }
                else if (contentType.includes('image/') ||
                    contentType.includes('audio/') ||
                    contentType.includes('video/') ||
                    contentType.includes('application/octet-stream') ||
                    contentType.includes('application/pdf')) {
                    effectiveFormat = 'binary';
                }
                else {
                    effectiveFormat = 'text';
                }
            }
            if (effectiveFormat === 'binary') {
                // Handle binary response
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                // Extract filename from Content-Disposition header or URL
                let fileName = 'download';
                const contentDisposition = response.headers.get('content-disposition');
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    if (match && match[1]) {
                        fileName = match[1].replace(/['"]/g, '');
                    }
                }
                else {
                    // Extract from URL
                    const urlPath = new URL(url).pathname;
                    const urlFileName = urlPath.split('/').pop();
                    if (urlFileName) {
                        fileName = urlFileName;
                    }
                }
                // Store binary data
                const binaryData = await context.setBinaryData('data', buffer, {
                    fileName,
                    mimeType: contentType || 'application/octet-stream'
                });
                return {
                    status: response.status,
                    headers: responseHeaders,
                    binary: { data: binaryData }
                };
            }
            else {
                // Handle text/json response
                const responseBody = await response.text();
                let parsedBody;
                if (effectiveFormat === 'json') {
                    try {
                        parsedBody = JSON.parse(responseBody);
                    }
                    catch {
                        parsedBody = responseBody;
                    }
                }
                else {
                    parsedBody = responseBody;
                }
                return {
                    status: response.status,
                    headers: responseHeaders,
                    body: parsedBody
                };
            }
        }
        catch (error) {
            throw new Error(`HTTP Request failed: ${error.message}`);
        }
    }
}
exports.HttpRequestNode = HttpRequestNode;
