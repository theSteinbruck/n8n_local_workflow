CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `execution_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`execution_id` text NOT NULL,
	`node_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`input_data` text,
	`output_data` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `executions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`workflow_version_id` text,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`workflow_snapshot` text NOT NULL,
	`metrics` text
);
--> statement-breakpoint
CREATE TABLE `workflow_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`name` text NOT NULL,
	`nodes` text NOT NULL,
	`connections` text NOT NULL,
	`settings` text,
	`version_number` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT false,
	`nodes` text NOT NULL,
	`connections` text NOT NULL,
	`settings` text,
	`version` integer DEFAULT 1,
	`schema_version` integer DEFAULT 1,
	`cron_expression` text,
	`timezone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
