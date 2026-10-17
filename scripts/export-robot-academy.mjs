// Convert trusted GitHub research-memory branch to a BROWSER-SAFE, TRAINING-ONLY
// Robot Academy summary. No accounts, order placement or real trading endpoints.
// A positive TRAIN return is NOT a verified forward-paper champion.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const PAIRS=Object.freeze([
 'BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD',
 'AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD'
]);
const PAIR_SET=new Set(PAIRS);
const SHA=/^[0-9a-f]{64}$/;
const MONTHS=/^\d{4}-\d{2}-\d{2}T/;
const round=(v,n=4)=>Number(v.toFixed(n));
const validTime=s=>typeof s==='string'&&MONTHS.test(s)&&Number.isFinite(Date.parse(s));
const isNumber=Number.isFinite;
const paramsLabel=p=>{
 switch(p.family){
 case 'ema_trend':return 'EMA '+p.fast+'/'+p.slow+' trend';
 case 'rsi_reversion':return 'RSI '+p.period+' / '+p.buyBelow+'/'+p.sellAbove;
 case 'channel_breakout':return 'Channel '+p.lookback+'/'+p.exitLookback;
 default:throw Error('Unsupported research strategy family');
 }
};
function validateOption(o){
 if(!o||!o.params||typeof o.params!=='object'||
  !Number.isInteger(o.closedTrades)||o.closedTrades<0||o.closedTrades>1000000||
  !isNumber(o.netProfitGbp)||Math.abs(o.netProfitGbp)>1e9||
  !isNumber(o.winRatePct)||o.winRatePct<0||o.winRatePct>100||
  (o.closedTrades===0&&o.winRatePct!==0))throw Error('Invalid research training option');
 const p=o.params;
 if(p.family==='ema_trend'){
  if(!Number.isInteger(p.fast)||!Number.isInteger(p.slow)||p.fast<2||
    p.slow<=p.fast||p.slow>120)throw Error('Invalid EMA model');
 }else if(p.family==='rsi_reversion'){
  if(!Number.isInteger(p.period)||p.period<3||p.period>40||
   !Number.isInteger(p.buyBelow)||p.buyBelow<10||p.buyBelow>45||
   !Number.isInteger(p.sellAbove)||p.sellAbove<=p.buyBelow||p.sellAbove>90)
   throw Error('Invalid RSI model');
 }else if(p.family==='channel_breakout'){
  if(!Number.isInteger(p.lookback)||p.lookback<5||p.lookback>80||
   !Number.isInteger(p.exitLookback)||p.exitLookback<3||
   p.exitLookback>p.lookback)throw Error('Invalid breakout model');
 }else throw Error('Unsupported research strategy family');
 // Never infer exact wins from rounded historical winRatePct values.
 return {family:p.family,parameters:{...p},name:paramsLabel(p),
   trainingClosedTrades:o.closedTrades,
   trainingWinRatePct:round(o.winRatePct,2),
   trainingNetGbp:round(o.netProfitGbp,4),
   meetsMinimumSample:o.closedTrades>=20};
}
const idOf=x=>JSON.stringify(x.parameters);
function better(a,b){
 if(!a)return b;
 if(b.trainingNetGbp>a.trainingNetGbp+1e-6)return b;
 if(a.trainingNetGbp>b.trainingNetGbp+1e-6)return a;
 if(b.trainingClosedTrades>a.trainingClosedTrades)return b;
 return a;
}
function registerCandidate(current,options){
 let best=current;
 for(const c of options)if(c.meetsMinimumSample)best=better(best,c);
 return best;
}
export function buildAcademySnapshot(memory){
 if(!memory||memory.schema!=='SCALP_RESEARCH_MEMORY_V1'||
  memory.policy!=='GBP50-PROFIT2000-v2'||!Array.isArray(memory.experiments)||
  memory.experiments.length>2000)throw Error('Unrecognized research memory version');
 const ids=new Set(),records=[];
 for(const e of memory.experiments){
  if(!PAIR_SET.has(e?.symbol)||e.feed!=='us-1'||!SHA.test(e.id||'')||
   !SHA.test(e.trainFingerprint||'')||ids.has(e.id)||
   !validTime(e.trainingStart)||!validTime(e.trainingEnd)||
   Date.parse(e.trainingEnd)<=Date.parse(e.trainingStart)||
   typeof e.acceptedForLearning!=='boolean'||
   !Array.isArray(e.trainingOptions)||e.trainingOptions.length<1||
   e.trainingOptions.length>16)throw Error('Malformed or duplicate research experiment');
  ids.add(e.id);
  const candidates=e.trainingOptions.map(validateOption);
  // No historical replay holdout metrics ever enter this exporter.
  records.push({id:e.id,symbol:e.symbol,
   trainingStart:e.trainingStart,trainingEnd:e.trainingEnd,
   independent:e.acceptedForLearning,sourceFingerprint:e.trainFingerprint,
   candidates});
 }
 const pupils=PAIRS.map(symbol=>{
  const history=records.filter(e=>e.symbol===symbol).sort((a,b)=>
   Date.parse(a.trainingEnd)-Date.parse(b.trainingEnd)||
   memory.experiments.findIndex(e=>e.id===a.id)-memory.experiments.findIndex(e=>e.id===b.id));
  let leader=null;
  const seen=new Set(),generations=[];
  for(const [i,e] of history.entries()){
   for(const c of e.candidates)seen.add(idOf(c));
   leader=registerCandidate(leader,e.candidates.map(candidate=>({...candidate,
    sourceExperimentId:e.id,trainedThrough:e.trainingEnd})));
   generations.push({run:i+1,trainingEnd:e.trainingEnd,
    experimentId:e.id,independentWindow:e.independent,
    testedConfigurations:e.candidates.length,
    // Re-used historical candles add experiments but NOT independent outcomes.
    grade:leader?Math.min(10,Math.floor((leader.trainingWinRatePct+1e-8)/10)):null,
    leaderTrainingNetGbp:leader?.trainingNetGbp??null,
    leaderStrategy:leader?.name??null});
  }
  const last=history.at(-1);
  return {symbol,source:'HISTORICAL_TRAINING_RESEARCH',
   evidenceStatus:leader?'PROVISIONAL_TRAINING_ONLY':'NO_ELIGIBLE_TRAINING_SAMPLE',
   confirmedForward:false,verifiedForwardTrades:0,
   experiments:history.length,independentTrainingWindows:history.filter(e=>e.independent).length,
   distinctStrategiesTried:seen.size,
   latestTrainingEnd:last?.trainingEnd??null,
   trainingBehavior:memory.experiments.find(e=>e.id===last?.id)?.behavior?.descriptiveRegime??null,
   championModel:null,
   researchLeader:leader?{...leader,status:leader.trainingNetGbp>0?
      'TRAINING_POSITIVE_UNVALIDATED':'TRAINING_LOSS_MAKING',
     outOfSampleVerified:false}:null,
   generations};
 });
 const end=records.reduce((latest,e)=>!latest||Date.parse(e.trainingEnd)>Date.parse(latest)?e.trainingEnd:latest,null);
 return {schema:'ROBOT_ACADEMY_RESEARCH_V1',
  source:'GITHUB_PERSISTED_HISTORICAL_TRAINING',
  sourcePolicy:memory.policy,
  sourceDigest:createHash('sha256').update(JSON.stringify(memory)).digest('hex'),
  latestTrainingEnd:end,
  caveat:'Training-only historical crypto research. Not a paper-forward win rate, net account P&L, validated predictive model, independent repeated evidence or live trading result.',
  verifiedForwardGrades:0,actualBrokerOrders:0,pupils};
}
export async function exportAcademyFile({input,output}={}){
 if(!input||!output)throw Error('Input and output research file paths required');
 const raw=JSON.parse(await readFile(input,'utf8'));
 const publication=buildAcademySnapshot(raw);
 await mkdir(path.dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(publication,null,2)+'\n','utf8');
 return {output,sourceDigest:publication.sourceDigest,linkedPupils:publication.pupils.filter(p=>p.researchLeader).length,
  verifiedForwardGrades:0};
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 exportAcademyFile({input:process.argv[2],output:process.argv[3]})
  .then(r=>console.log('ACADEMY_RESEARCH_EXPORT '+JSON.stringify(r)))
  .catch(e=>{console.error('Academy research export blocked:',String(e.message));process.exitCode=1;});
}
