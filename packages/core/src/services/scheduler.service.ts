import * as cron from 'node-cron';
import { WorkflowService } from './workflow.service';
import { ExecutionService } from './execution.service';
import { EventBus } from '../execution/event-bus';
import { NodeRegistry } from '../execution/node-registry';
import { ExecutionEngine } from '../execution/execution-engine';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('scheduler');

interface ScheduledJob {
    workflowId: string;
    cronExpression: string;
    timezone?: string;
    task: cron.ScheduledTask;
    lastRun?: Date;
    nextRun?: Date;
}

export class SchedulerService {
    private scheduledJobs = new Map<string, ScheduledJob>();
    private workflowService: WorkflowService;
    private executionService: ExecutionService;
    private nodeRegistry: NodeRegistry;
    private eventBus: EventBus;

    constructor(
        workflowService: WorkflowService,
        executionService: ExecutionService,
        nodeRegistry: NodeRegistry,
        eventBus: EventBus
    ) {
        this.workflowService = workflowService;
        this.executionService = executionService;
        this.nodeRegistry = nodeRegistry;
        this.eventBus = eventBus;
    }

    /**
     * Start the scheduler and load active workflows with cron triggers
     */
    async start(): Promise<void> {
        logger.info('schedulerStarting');
        await this.loadActiveSchedules();
        logger.info({ jobCount: this.scheduledJobs.size }, 'schedulerStarted');
    }

    /**
     * Stop all scheduled jobs
     */
    async stop(): Promise<void> {
        logger.info('schedulerStopping');
        for (const [workflowId, job] of this.scheduledJobs.entries()) {
            job.task.stop();
            logger.info({ workflowId }, 'jobStopped');
        }
        this.scheduledJobs.clear();
    }

    /**
     * Load all active workflows with cron triggers from the database
     */
    async loadActiveSchedules(): Promise<void> {
        const workflows = await this.workflowService.listWorkflows();

        for (const workflow of workflows) {
            if (!workflow.active) continue;

            // Find CronTrigger node in workflow
            const nodes = workflow.nodes as any[];
            const cronTrigger = nodes?.find((n: any) => n.type === 'CronTrigger');

            if (cronTrigger?.parameters?.cronExpression) {
                await this.schedule(
                    workflow.id,
                    cronTrigger.parameters.cronExpression,
                    cronTrigger.parameters.timezone
                );
            }
        }
    }

    /**
     * Schedule a workflow for execution
     */
    async schedule(workflowId: string, cronExpression: string, timezone?: string): Promise<boolean> {
        // Validate cron expression
        if (!cron.validate(cronExpression)) {
            logger.error({ workflowId, cronExpression }, 'invalidCronExpression');
            return false;
        }

        // Remove existing schedule if any
        this.unschedule(workflowId);

        const options: { scheduled: boolean; timezone?: string } = {
            scheduled: true,
        };

        if (timezone) {
            options.timezone = timezone;
        }

        const task = cron.schedule(cronExpression, async () => {
            await this.executeWorkflow(workflowId);
        }, options);

        this.scheduledJobs.set(workflowId, {
            workflowId,
            cronExpression,
            timezone,
            task,
        });

        logger.info({ workflowId, cronExpression }, 'workflowScheduled');
        return true;
    }

    /**
     * Unschedule a workflow
     */
    unschedule(workflowId: string): boolean {
        const job = this.scheduledJobs.get(workflowId);
        if (job) {
            job.task.stop();
            this.scheduledJobs.delete(workflowId);
            logger.info({ workflowId }, 'workflowUnscheduled');
            return true;
        }
        return false;
    }

    /**
     * Execute a scheduled workflow
     */
    private async executeWorkflow(workflowId: string): Promise<void> {
        logger.info({ workflowId }, 'triggeringWorkflow');

        try {
            const workflow = await this.workflowService.getWorkflow(workflowId);
            if (!workflow) {
                logger.error({ workflowId }, 'workflowNotFound');
                return;
            }

            if (!workflow.active) {
                logger.info({ workflowId }, 'workflowInactiveSkipping');
                return;
            }

            // Get the latest version for linking
            const versions = await this.workflowService.listWorkflowVersions(workflowId);
            const latestVersion = versions[0];

            // Create execution record
            const execution = await this.executionService.createExecution({
                workflowId,
                workflowVersionId: latestVersion?.id,
                mode: 'trigger',
                workflowSnapshot: workflow,
            });

            if (!execution) {
                logger.error({ workflowId }, 'executionCreationFailed');
                return;
            }

            // Run the workflow
            const engine = new ExecutionEngine(
                this.executionService,
                this.nodeRegistry,
                this.eventBus,
                this.workflowService
            );

            await engine.run(execution.id, workflow, { triggeredAt: new Date().toISOString() });

            // Update last run time
            const job = this.scheduledJobs.get(workflowId);
            if (job) {
                job.lastRun = new Date();
            }

            logger.info({ workflowId, executionId: execution.id }, 'workflowTriggerCompleted');
        } catch (error: any) {
            logger.error({ workflowId, error: error.message }, 'workflowTriggerError');
        }
    }

    /**
     * Get all scheduled jobs
     */
    getScheduledJobs(): Array<{
        workflowId: string;
        cronExpression: string;
        timezone?: string;
        lastRun?: Date;
    }> {
        return Array.from(this.scheduledJobs.values()).map(job => ({
            workflowId: job.workflowId,
            cronExpression: job.cronExpression,
            timezone: job.timezone,
            lastRun: job.lastRun,
        }));
    }

    /**
     * Validate a cron expression
     */
    static validateCron(expression: string): boolean {
        return cron.validate(expression);
    }

    /**
     * Reload schedules from database
     */
    async reload(): Promise<void> {
        await this.stop();
        await this.start();
    }
}
