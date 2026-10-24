import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('./universal-student.html',import.meta.url),'utf8');
const academy=await readFile(new URL('./robot-academy.html',import.meta.url),'utf8');
const workflow=await readFile(new URL('./.github/workflows/universal-student.yml',import.meta.url),'utf8');
const runner=await readFile(new URL('./universal_student/run_github.py',import.meta.url),'utf8');

test('iPhone student UI has real market selection, source model and progress fields',()=>{
 assert.match(html,/id="market"/);assert.match(html,/id="source"/);
 assert.match(html,/BTC\/USD/);assert.match(html,/id="progressChart"/);
 assert.match(html,/id="generations"/);assert.match(html,/id="net"/);
 assert.match(html,/Reload progress/);
 assert.match(html,/UNIVERSAL-01/);
 assert.doesNotThrow(()=>new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]));
});

test('Academy exposes functional Universal Student route without changing existing grades',()=>{
 assert.match(academy,/href="\.\/universal-student\.html"/);
 assert.match(academy,/UNIVERSAL-01/);
 assert.match(academy,/const confirmed=p=>!demo&&p\.source==='VERIFIED_PAPER_FORWARD'/);
});

test('no simulated learning is presented as broker-confirmed or real P&L',()=>{
 assert.match(html,/Historical performance only/);
 assert.match(html,/not a forward-paper grade/);
 assert.match(html,/The browser page cannot securely start an authenticated GitHub Actions run/);
 assert.doesNotMatch(html,/github_pat_|personal access token.*type="password"/i);
 assert.match(runner,/brokerOrders.*0/);
 assert.match(runner,/officialGrade.*None/);
});

test('Actions workflow runs only manual research, guarded by an isolated memory branch',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/ref: rl-learning-memory/);
 assert.match(workflow,/ref: rl-5m-data/);
 assert.match(workflow,/ref: universal-student-memory/);
 assert.match(workflow,/sparse-checkout: snapshots/);
 assert.match(workflow,/python -m universal_student.run_github/);
 assert.match(workflow,/contents: write/);
 assert.doesNotMatch(workflow,/\/v2\/orders|ALPACA_PAPER_SECRET|ALPACA_PAPER_KEY|live-orders/);
});
