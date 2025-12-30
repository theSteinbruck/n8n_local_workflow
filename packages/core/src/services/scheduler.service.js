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
exports.SchedulerService = void 0;
const cron = __importStar(require("node-cron"));
const execution_engine_1 = require("../execution/execution-engine");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createScopedLogger)('scheduler');
class SchedulerService {
    constructor(workflowService, executionService, nodeRegistry, eventBus) {
        this.scheduledJobs = new Map();
        this.workflowService = workflowService;
        this.executionService = executionService;
        this.nodeRegistry = nodeRegistry;
        this.eventBus = eventBus;
    }
    /**
     * Start the scheduler and load active workflows with cron triggers
     */
    async start() {
        logger.info('schedulerStarting');
        await this.loadActiveSchedules();
        logger.info({ jobCount: this.scheduledJobs.size }, 'schedulerStarted');
    }
    /**
     * Stop all scheduled jobs
     */
    async stop() {
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
    async loadActiveSchedules() {
        const workflows = await this.workflowService.listWorkflows();
        for (const workflow of workflows) {
            if (!workflow.active)
                continue;
            // Find CronTrigger node in workflow
            const nodes = workflow.nodes;
            const cronTrigger = nodes?.find((n) => n.type === 'CronTrigger');
            if (cronTrigger?.parameters?.cronExpression) {
                await this.schedule(workflow.id, cronTrigger.parameters.cronExpression, cronTrigger.parameters.timezone);
            }
        }
    }
    /**
     * Schedule a workflow for execution
     */
    async schedule(workflowId, cronExpression, timezone) {
        // Validate cron expression
        if (!cron.validate(cronExpression)) {
            logger.error({ workflowId, cronExpression }, 'invalidCronExpression');
            return false;
        }
        // Remove existing schedule if any
        this.unschedule(workflowId);
        const options = {
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
    unschedule(workflowId) {
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
    async executeWorkflow(workflowId) {
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
            const engine = new execution_engine_1.ExecutionEngine(this.executionService, this.nodeRegistry, this.eventBus, this.workflowService);
            await engine.run(execution.id, workflow, { triggeredAt: new Date().toISOString() });
            // Update last run time
            const job = this.scheduledJobs.get(workflowId);
            if (job) {
                job.lastRun = new Date();
            }
            logger.info({ workflowId, executionId: execution.id }, 'workflowTriggerCompleted');
        }
        catch (error) {
            logger.error({ workflowId, error: error.message }, 'workflowTriggerError');
        }
    }
    /**
     * Get all scheduled jobs
     */
    getScheduledJobs() {
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
    static validateCron(expression) {
        return cron.validate(expression);
    }
    /**
     * Reload schedules from database
     */
    async reload() {
        await this.stop();
        await this.start();
    }
}
exports.SchedulerService = SchedulerService;
