// Historical training ONLY: split the PRE-HOLDOUT research interval into
// nonoverlapping chronological windows. Never read the final 60% unseen holdout.
// One experiment per source period; overlapping scheduled refreshes are not
// independent replications or permission for broker orders.
import {simulateValidation} from '../strategy-validation-core.mjs';
export const FOLD_TARGET=3;
const MIN_FOLD_BARS=480, MIN_BARS=480;
export function chronologicalTrainingFolds(snapshot,{trainingFraction=.4,target=FOLD_TARGET}={}){
 if(!snapshot||!Array.isArray(snapshot.bars)||!Number.isInteger(target)||target<1||target>5||
   trainingFraction<=0||trainingFraction>=1)throw Error('HISTORICAL_FOLDS: invalid input');
 const source=snapshot.bars,trainingEnd=Math.floor(source.length*trainingFraction);
 if(trainingEnd<MIN_BARS)throw Error('HISTORICAL_FOLDS: insufficient pre-holdout bars');
 const count=Math.min(target,Math.floor(trainingEnd/MIN_FOLD_BARS));
 const width=Math.floor(trainingEnd/count);
 return Array.from({length:count},(_,i)=>{
   const from=i*width,to=i===count-1?trainingEnd:(i+1)*width;
   const bars=source.slice(from,to);
   if(bars.length<MIN_FOLD_BARS)throw Error('HISTORICAL_FOLDS: insufficient fold');
   return {index:i+1,from,to,source:{...snapshot,bars},
     start:bars[0].t,end:new Date(Date.parse(bars.at(-1).t)+900000).toISOString()};
 });
}
export function evaluateTrainingAcrossFolds({snapshot,symbol,config,now=Date.now(),
 simulate=simulateValidation,normalFee=.0025,stressFee=.005}={}){
 if(!config||typeof config!=='object')throw Error('HISTORICAL_FOLDS: configuration required');
 const folds=chronologicalTrainingFolds(snapshot);
 const result=folds.map(f=>{
   const standard=simulate({snapshot:f.source,symbol,startingBalanceGbp:50,
     mode:'duration',limit:365,feePerSideFraction:normalFee,now,...config});
   const stressed=simulate({snapshot:f.source,symbol,startingBalanceGbp:50,
     mode:'duration',limit:365,feePerSideFraction:stressFee,now,...config});
   for(const item of [standard,stressed]){
     if(!Number.isFinite(item.realizedNetProfitGbp)||
       !Number.isInteger(item.closedTrades)||item.closedTrades<0||
       !Number.isFinite(item.maxDrawdownPct)||item.maxDrawdownPct<0||
       !Number.isInteger(item.wins)||item.wins<0||item.wins>item.closedTrades)
       throw Error('HISTORICAL_FOLDS: malformed simulation');
   }
   return {index:f.index,start:f.start,end:f.end,candles:f.to-f.from,
     closedTrades:standard.closedTrades,wins:standard.wins,
     netGbp:standard.realizedNetProfitGbp,
     stressNetGbp:stressed.realizedNetProfitGbp,
     maxDrawdownPct:standard.maxDrawdownPct};
 });
 const sum=k=>result.reduce((n,x)=>n+x[k],0);
 const closedTrades=sum('closedTrades'),wins=sum('wins');
 const netGbp=Number(sum('netGbp').toFixed(8));
 const stressNetGbp=Number(sum('stressNetGbp').toFixed(8));
 const worstDrawdownPct=Math.max(...result.map(x=>x.maxDrawdownPct));
 const positive=result.filter(x=>x.netGbp>0).length;
 const stressPositive=result.filter(x=>x.stressNetGbp>0).length;
 // This is an internal development score, not independent historical proof.
 const pass=closedTrades>=30&&netGbp>0&&stressNetGbp>0&&
   worstDrawdownPct<=10&&positive>=Math.min(2,result.length)&&
   stressPositive>=Math.min(2,result.length);
 return {closedTrades,wins,netGbp,stressNetGbp,
   winRatePct:closedTrades?Number((wins/closedTrades*100).toFixed(2)):0,
   trainingScore:pass?Number((netGbp-worstDrawdownPct*.05).toFixed(8)):null,
   robustness:{windowCount:result.length,positiveWindows:positive,
    stressPositiveWindows:stressPositive,worstDrawdownPct,
    mode:'NONOVERLAPPING_CHRONOLOGICAL_PRE_HOLDOUT_ONLY',
    folds:result,independentForwardEvidence:false}};
}
