import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('automated independent qualification listens only for completed successful main research',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/teacher-qualification.yml',import.meta.url),'utf8');
 assert.match(workflow,/workflow_run:\s*\n\s*workflows: \["Scalp City — repeated parent-seeded chart research lessons"\]/);
 assert.match(workflow,/types: \[completed\]/);
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/workflow_run\.conclusion == 'success'/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/TEACHER_PAPER_ENABLED: 'false'/);
 assert.match(workflow,/TEACHER_ENABLE_EXAMINER: 'false'/);
 assert.doesNotMatch(workflow,/TEACHER_ISSUE_ADMISSIONS: 'true'|paperOrder\(|\/v2\/orders/);
});
