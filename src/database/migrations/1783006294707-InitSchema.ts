import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1783006294707 implements MigrationInterface {
    name = 'InitSchema1783006294707'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor" text NOT NULL, "action" text NOT NULL, "status" text NOT NULL, "entityType" text NOT NULL, "entityId" text, "details" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inbound_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source" text NOT NULL, "eventType" text NOT NULL, "externalEventId" text NOT NULL, "idempotencyKey" text NOT NULL, "correlationId" text NOT NULL, "status" text NOT NULL DEFAULT 'received', "payload" text NOT NULL, "canonicalEvent" text, "errorMessage" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b76e26fa0121da742b191b7ded0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9e48035b44dc798acf66e00f1f" ON "inbound_events" ("idempotencyKey") `);
        await queryRunner.query(`CREATE TABLE "integration_connections" ("provider" character varying NOT NULL, "status" text NOT NULL DEFAULT 'needs-config', "config" text, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eb918d3e36c937d83172b7fa054" PRIMARY KEY ("provider"))`);
        await queryRunner.query(`CREATE TABLE "jira_ticket_mappings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workflowRunId" text NOT NULL, "sourceEventId" text NOT NULL, "issueKey" text NOT NULL, "issueUrl" text NOT NULL, "summary" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0b55c2d183fa878bea6d4fdb5ce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "provider_credentials" ("provider" character varying NOT NULL, "authType" text NOT NULL DEFAULT 'api-key', "secretData" text, "metadata" text, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_830dd82aa9768f36aa73e8cc702" PRIMARY KEY ("provider"))`);
        await queryRunner.query(`CREATE TABLE "workflow_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sourceEventId" text NOT NULL, "source" text NOT NULL, "provider" text, "model" text, "action" text, "status" text NOT NULL DEFAULT 'queued', "inputSummary" text NOT NULL, "output" text, "errorMessage" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eea9f8d0a660b3f48114c313233" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "workspace_settings" ("key" character varying NOT NULL, "value" text NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_de2612d2bc0feaed29566e529b5" PRIMARY KEY ("key"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "workspace_settings"`);
        await queryRunner.query(`DROP TABLE "workflow_runs"`);
        await queryRunner.query(`DROP TABLE "provider_credentials"`);
        await queryRunner.query(`DROP TABLE "jira_ticket_mappings"`);
        await queryRunner.query(`DROP TABLE "integration_connections"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e48035b44dc798acf66e00f1f"`);
        await queryRunner.query(`DROP TABLE "inbound_events"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }

}
