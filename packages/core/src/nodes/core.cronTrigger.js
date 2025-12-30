"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronTriggerNode = void 0;
class CronTriggerNode {
    constructor() {
        this.description = {
            displayName: 'Cron Trigger',
            name: 'CronTrigger',
            group: ['trigger'],
            version: 1,
            description: 'Trigger workflow on a schedule using cron expressions',
            defaults: {
                name: 'Cron Trigger',
            },
            inputs: [],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Cron Expression',
                    name: 'cronExpression',
                    type: 'string',
                    default: '0 * * * *',
                    description: 'Cron expression (e.g., "0 * * * *" for every hour, "*/5 * * * *" for every 5 minutes)'
                },
                {
                    displayName: 'Timezone',
                    name: 'timezone',
                    type: 'string',
                    default: '',
                    description: 'Timezone for the schedule (e.g., "America/New_York"). Leave empty for system timezone.'
                }
            ],
        };
        this.isTrigger = true;
        this.executable = true;
    }
    async execute(context) {
        // When triggered, return execution metadata
        const cronExpression = context.getNodeParameter('cronExpression', '0 * * * *');
        const timezone = context.getNodeParameter('timezone', '');
        const inputData = context.getInputData();
        return {
            ...inputData,
            triggeredAt: new Date().toISOString(),
            triggerType: 'cron',
            cronExpression,
            timezone: timezone || 'system',
        };
    }
}
exports.CronTriggerNode = CronTriggerNode;
