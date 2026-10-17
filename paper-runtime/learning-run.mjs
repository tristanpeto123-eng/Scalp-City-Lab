// Approved-workflow research learner: commits only TRAIN-only observations to
// scalp-learning-memory branch, never the running code branch and never orders.
import {AlpacaPaper} from './alpaca-paper.mjs';
import {runScreener} from './screen-crypto-markets.mjs';
import {loadGitHubMemory,commitGitHubMemory} from './github-learning-store.mjs';
const hide=x=>JSON.stringify(x);
async function main(){
  const token=process.env.GITHUB_TOKEN;
  if(!token||!process.env.ALPACA_PAPER_KEY||!process.env.ALPACA_PAPER_SECRET)
    throw Error('GitHub and paper account credentials required in workflow secrets');
  // Independent model-memory branch must exist. This script cannot create it.
  const {memory:before,blobSha}=await loadGitHubMemory({token});
  const days=Number(process.env.SCALP_RESEARCH_DAYS||90);
  const location=process.env.SCALP_RESEARCH_FEED||'us-1';
  const report=await runScreener({broker:new AlpacaPaper(),days,location,memory:before});
  const {modelMemory,...publicReport}=report;
  const persisted=await commitGitHubMemory({
    token,expectedSha:blobSha,memory:modelMemory,previousMemory:before
  });
  console.log('LEARNING_RUN_REPORT '+hide({
    ...publicReport,
    researchMemoryStatus:persisted.status,priorExperiments:before.experiments.length,
    currentExperiments:modelMemory.experiments.length,
    newIndependentWindows:report.learningEvents.filter(e=>e.acceptedIndependentWindow).length,
    modelDeployed:false,paperOrdersEnabled:false,
    note:'Training-only EMA search memory. Historical repeated data never counted as independent proof; no automatic broker strategy promotion.'
  }));
}
main().catch(e=>{
 console.error('Learning run failed closed:',String(e.message||e).slice(0,180));
 process.exitCode=1;
});
