import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  name?: string;
  'runs-on'?: string;
  permissions?: Record<string, string>;
  steps?: WorkflowStep[];
}

interface WorkflowConcurrency {
  group?: string;
  'cancel-in-progress'?: boolean;
}

interface ParsedWorkflow {
  name?: string;
  on?: unknown;
  true?: unknown;
  permissions?: Record<string, string>;
  concurrency?: WorkflowConcurrency;
  jobs?: Record<string, WorkflowJob>;
}

const require = createRequire(import.meta.url);
const matter: typeof import('gray-matter') = require('gray-matter');

const workflowsDir = path.resolve(process.cwd(), '.github', 'workflows');

const ALLOWED_ACTION_REFS: Record<string, string> = {
  'actions/checkout': 'v7',
  'actions/setup-node': 'v7',
  'actions/upload-artifact': 'v7',
  'anthropics/claude-code-action': 'v1',
};

/**
 * Lists all YAML workflow filenames in `.github/workflows`.
 */
function listWorkflowFiles(): string[] {
  return readdirSync(workflowsDir)
    .filter((entry) => entry.endsWith('.yml') || entry.endsWith('.yaml'))
    .sort();
}

/**
 * Parses a GitHub Actions workflow YAML file via gray-matter's YAML engine.
 */
function parseWorkflow(fileName: string): ParsedWorkflow {
  const fullPath = path.join(workflowsDir, fileName);
  const rawYaml = readFileSync(fullPath, 'utf8');
  const wrapped = `---\n${rawYaml}\n---\n`;
  return matter(wrapped).data as ParsedWorkflow;
}

/**
 * Collects every step across every job in a parsed workflow.
 */
function collectSteps(workflow: ParsedWorkflow): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  if (!workflow.jobs) {
    return steps;
  }
  for (const job of Object.values(workflow.jobs)) {
    if (Array.isArray(job.steps)) {
      steps.push(...job.steps);
    }
  }
  return steps;
}

describe('GitHub Actions workflows', () => {
  const workflowFiles = listWorkflowFiles();

  test('every workflow parses as valid YAML with name, trigger, and jobs', () => {
    assert.ok(workflowFiles.length > 0, 'Expected at least one workflow file');

    for (const fileName of workflowFiles) {
      const workflow = parseWorkflow(fileName);
      assert.equal(typeof workflow.name, 'string', `${fileName} must declare a name`);
      // YAML 1.1 parsers coerce unquoted `on:` keys to boolean `true`.
      const hasTrigger = workflow.on !== undefined || workflow.true !== undefined;
      assert.equal(hasTrigger, true, `${fileName} must declare an on trigger`);
      assert.ok(
        workflow.jobs && Object.keys(workflow.jobs).length > 0,
        `${fileName} must declare at least one job`,
      );
    }
  });

  test('all workflows use Node 24-compatible action versions and never reference deprecated cancel action', () => {
    for (const fileName of workflowFiles) {
      const workflow = parseWorkflow(fileName);
      const steps = collectSteps(workflow);

      for (const step of steps) {
        if (!step.uses) {
          continue;
        }
        assert.equal(
          step.uses.startsWith('styfle/cancel-workflow-action'),
          false,
          `${fileName} should use native concurrency instead of ${step.uses}`,
        );

        const [actionName, actionRef] = step.uses.split('@');
        const expectedRef = ALLOWED_ACTION_REFS[actionName];
        assert.ok(
          expectedRef !== undefined,
          `${fileName} references unexpected action ${step.uses}`,
        );
        assert.equal(
          actionRef,
          expectedRef,
          `${fileName} should pin ${actionName} to @${expectedRef} (found @${actionRef})`,
        );
      }
    }
  });

  test('every Node setup step uses .nvmrc with npm cache and installs via npm ci', () => {
    for (const fileName of workflowFiles) {
      const workflow = parseWorkflow(fileName);
      const steps = collectSteps(workflow);

      for (const step of steps) {
        if (step.uses && step.uses.startsWith('actions/setup-node@')) {
          assert.equal(
            step.with?.['node-version-file'],
            '.nvmrc',
            `${fileName} must read the Node version from .nvmrc`,
          );
          assert.equal(
            step.with?.cache,
            'npm',
            `${fileName} should enable npm caching in actions/setup-node`,
          );
        }

        if (typeof step.run === 'string') {
          assert.equal(
            /\bnpm install\b/.test(step.run),
            false,
            `${fileName} should use npm ci instead of npm install`,
          );
        }
      }
    }
  });

  test('build-validation.yml enforces typecheck, lint, build with AVIF verification, and test', () => {
    const workflow = parseWorkflow('build-validation.yml');
    const { jobs } = workflow;
    assert.ok(jobs, 'build-validation.yml must define jobs');

    assert.deepEqual(
      Object.keys(jobs).sort(),
      ['build', 'lint', 'test', 'typecheck'],
      'build-validation.yml must run typecheck, lint, build, and test jobs',
    );

    const typecheckRuns = (jobs.typecheck.steps || []).map((step) => step.run || '').join('\n');
    const lintRuns = (jobs.lint.steps || []).map((step) => step.run || '').join('\n');
    const buildRuns = (jobs.build.steps || []).map((step) => step.run || '').join('\n');
    const testRuns = (jobs.test.steps || []).map((step) => step.run || '').join('\n');

    assert.match(typecheckRuns, /npm run typecheck/);
    assert.match(lintRuns, /npm run lint/);
    assert.match(buildRuns, /npm run build/);
    assert.match(buildRuns, /git status --porcelain -- src\/images/);
    assert.match(testRuns, /npm test/);
  });

  test('deploy and sync workflows declare safe non-cancelling concurrency and required write permissions', () => {
    const deployProd = parseWorkflow('deploy-production.yml');
    const deployStaging = parseWorkflow('deploy-staging.yml');
    const syncStaging = parseWorkflow('sync-staging.yml');

    assert.equal(deployProd.concurrency?.['cancel-in-progress'], false);
    assert.equal(deployProd.permissions?.contents, 'write');

    assert.equal(deployStaging.concurrency?.['cancel-in-progress'], false);
    assert.equal(deployStaging.permissions?.contents, 'read');

    assert.equal(syncStaging.concurrency?.['cancel-in-progress'], false);
    assert.equal(syncStaging.permissions?.contents, 'write');
  });

  test('claude.yml permits every AGENTS.md verification command including typecheck', () => {
    const claudeWorkflow = parseWorkflow('claude.yml');
    const steps = collectSteps(claudeWorkflow);
    const claudeStep = steps.find(
      (step) => typeof step.uses === 'string' && step.uses.startsWith('anthropics/claude-code-action@'),
    );
    assert.ok(claudeStep, 'claude.yml must invoke anthropics/claude-code-action');

    const claudeArgs = String(claudeStep.with?.claude_args || '');
    const requiredTools = [
      'Bash(npm run typecheck)',
      'Bash(npm run build)',
      'Bash(npm run build:golden)',
      'Bash(npm test)',
      'Bash(npm run lint)',
      'Bash(npm run screenshot:*)'
    ];

    for (const toolSpec of requiredTools) {
      assert.ok(
        claudeArgs.includes(toolSpec),
        `claude.yml claude_args must allow ${toolSpec}`,
      );
    }
  });
});
