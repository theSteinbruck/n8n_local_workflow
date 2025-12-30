import { INodeType, INodeExecutionContext, INodeTypeDescription } from '../execution/node-interfaces';

export class CronTriggerNode implements INodeType {
    description: INodeTypeDescription = {
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

    isTrigger = true;
    executable = true;

    async execute(context: INodeExecutionContext): Promise<any> {
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
