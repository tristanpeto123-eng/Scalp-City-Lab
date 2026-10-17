// Scalp City 3R learning contract. RESEARCH / READ-ONLY ONLY.
// No paper broker calls, no trade arming. Selection uses TRAIN ONLY; one unseen
// chronological holdout is sealed until AFTER parameters are selected.
const PERIOD_MS=900_000;
const crypto=new Set(['BTC/USD','ETH/USD']);
const allowed=new Set(['BTC/USD','ETH/USD','SPY','QQQ','IWM']);
export const R3=Object.freeze({
  virtualInitialGbp:50,riskFraction:.01,rewardToRisk:3,
  stopFraction:.02,maxAllocationFraction:.50,
  cryptoFeePerSide:.005,equityFeePerSide:.001,
  minimumTrainingTrades:3,minimumHoldoutTrades:3,
  minimumHoldoutNetGbp:0,minimumHoldoutProfitFactor:1.0,
  maximumHoldoutDrawdownPct:10
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function terms(symbol,entry,balance=50,feeMultiplier=1){
  if(!allowed.has(symbol)||![entry,balance,feeMultiplier].every(finite)||
    entry<=0||balance<=0||feeMultiplier<1||feeMultiplier>3)throw Error('Invalid 3R terms');
  const fee=(crypto.has(symbol)?R3.cryptoFeePerSide:R3.equityFeePerSide)*feeMultiplier;
  const riskFrac=R3.stopFraction+fee*(2-R3.stopFraction);
  const targetFrac=(3*riskFrac+2*fee)/(1-fee);
  const notional=Math.min(balance*R3.maxAllocationFraction,balance*R3.riskFraction/riskFrac);
  const stop=entry*(1-R3.stopFraction),target=entry*(1+targetFrac);
  return {entry,stop,target,notional,fee,plannedRisk:notional*riskFrac,
    plannedReward:notional*(targetFrac*(1-fee)-2*fee),plannedRR:3};
}
function shape(bars,params){
  if(!Array.isArray(bars)||bars.length<80||!params||
      !Number.isInteger(params.fast)||!Number.isInteger(params.slow)||
      params.fast<2||params.slow<=params.fast||params.slow>=bars.length)throw Error('Invalid 3R history or parameters');
  for(let i=0;i<bars.length;i++){
    const b=bars[i];
    if(!b||![b.o,b.h,b.l,b.c].every(finite)||Math.min(b.o,b.h,b.l,b.c)<=0||
      b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)||
      !finite(b.t)||(i>0&&b.t<=bars[i-1].t))throw Error('Invalid 3R OHLC or timestamps');
  }
}
function equityMetrics(trades){
  let total=0,gain=0,loss=0,peak=50,equity=50,maxDd=0,wins=0;
  for(const t of trades){total+=t.pnlGbp;equity+=t.pnlGbp;
    if(t.pnlGbp>0){gain+=t.pnlGbp;wins++}else loss-=t.pnlGbp;
    peak=Math.max(peak,equity);maxDd=Math.max(maxDd,100*(peak-equity)/peak);
  }
  return {closedTrades:trades.length,wins,winRatePct:trades.length?100*wins/trades.length:0,
    netGbp:total,netReturnPct:2*total,profitFactor:loss>0?gain/loss:(gain>0?null:0),
    maxDrawdownPct:maxDd,expectancyGbp:trades.length?total/trades.length:0};
}
// Chronological 3R next-open simulation. For every selected bar, only the prior
// FINALIZED candle's EMA can authorize entry. Same-bar stop and TP => STOP.
// Trades open at the segment end are not counted or forcibly closed.
export function simulate3R(bars,params,{symbol,start=1,end=bars.length,feeMultiplier=1}={}){
  shape(bars,params);if(!allowed.has(symbol)||!Number.isInteger(start)||
    !Number.isInteger(end)||start<1||end>bars.length||start>=end)throw Error('Invalid 3R segment');
  let fast=bars[0].c,slow=fast;
  const a=2/(params.fast+1),b=2/(params.slow+1),signals=[];
  for(let i=0;i<bars.length;i++){
    fast+=a*(bars[i].c-fast);slow+=b*(bars[i].c-slow);
    signals[i]=fast>slow;
  }
  const trades=[];let balance=50,position=null;
  for(let i=start;i<end;i++){
    const bar=bars[i];
    if(!position&&signals[i-1]&&balance>0){
      const plan=terms(symbol,bar.o,balance,feeMultiplier);
      if(plan.notional>=1)position={...plan,entryIndex:i};
    }
    if(!position)continue;
    let exit=null,reason=null;
    // gap through either barrier at next opening is settled at the opening
    if(bar.o<=position.stop){exit=bar.o;reason='STOP_GAP'}
    else if(bar.o>=position.target){exit=position.target;reason='TAKE_PROFIT'}
    else if(bar.l<=position.stop){exit=position.stop;reason='STOP'}
    else if(bar.h>=position.target){exit=position.target;reason='TAKE_PROFIT'}
    if(exit===null)continue;
    const pnl=position.notional*((exit/position.entry)-1)-
      position.notional*position.fee*(1+exit/position.entry);
    trades.push({entryIndex:position.entryIndex,exitIndex:i,entryPrice:position.entry,
      exitPrice:exit,exitReason:reason,notionalGbp:position.notional,feeRate:position.fee,
      plannedRiskGbp:position.plannedRisk,plannedRewardGbp:position.plannedReward,
      pnlGbp:pnl});
    balance+=pnl;position=null;
  }
  return {...equityMetrics(trades),trades,segment:[start,end],symbol,
    feeMultiplier,openAtEnd:position!==null,
    scope:'historical research, NOT forward trades or broker fills'};
}
function rank(x){
  const m=x.result;
  if(m.closedTrades<R3.minimumTrainingTrades||m.netGbp<=0||
    m.profitFactor===0||m.maxDrawdownPct>R3.maximumHoldoutDrawdownPct)return -Infinity;
  // Only TRAIN performance is allowed to influence strategy selection.
  // Balanced: observed win rate alone cannot reward small catastrophic wins.
  const pf=m.profitFactor===null?4:Math.min(m.profitFactor,4);
  return 0.25*m.winRatePct+8*Math.min(pf,4)+Math.min(12,m.expectancyGbp*10)-m.maxDrawdownPct;
}
export function optimize3R(bars,candidates,symbol){
  if(!allowed.has(symbol)||!Array.isArray(candidates)||!candidates.length)throw Error('Missing 3R candidates');
  const cut=Math.floor(bars.length*.75);
  if(cut<=50||bars.length-cut<25)throw Error('Insufficient sealed 3R holdout');
  const options=candidates.map(params=>{
    const result=simulate3R(bars,params,{symbol,start:1,end:cut});
    return {params,result,trainingScore:rank({result})};
  });
  options.sort((x,y)=>y.trainingScore-x.trainingScore||x.params.fast-y.params.fast);
  const winner=options.find(x=>Number.isFinite(x.trainingScore));
  return {candidate:winner||options[0],trainingEligible:Boolean(winner),cut,
    trainingOptions:options.map(x=>({params:x.params,trainingClosedTrades:x.result.closedTrades,
      trainingWinRatePct:x.result.winRatePct,trainingNetGbp:x.result.netGbp,
      trainingProfitFactor:x.result.profitFactor,trainingScore:Number.isFinite(x.trainingScore)?x.trainingScore:null})),
    selectionBasis:'TRAIN_3R_ONLY',sealedHoldout:[cut,bars.length]};
}
// Independent trade reconstruction from recorded prices: deliberately does
// NOT reuse the simulator's P&L arithmetic, EMA logic or position state.
export function audit3RTrades(report,bars){
  let balance=50,peak=50,drawdown=0,winGross=0,lossGross=0,total=0,wins=0;
  let previousExit=report.segment[0]-1;
  for(const t of report.trades){
    if(!Number.isInteger(t.entryIndex)||!Number.isInteger(t.exitIndex)||
      t.entryIndex<report.segment[0]||t.exitIndex>=report.segment[1]||
      t.entryIndex<=previousExit||t.exitIndex<t.entryIndex)throw Error('Invalid or overlapping 3R trade chronology');
    if(Math.abs(bars[t.entryIndex].o-t.entryPrice)>1e-9||
      !(t.notionalGbp>0)||!(t.feeRate>=0))throw Error('Unverifiable 3R entry');
    const bar=bars[t.exitIndex],stop=t.entryPrice*.98;
    const loss=bar.o<=stop||bar.l<=stop;
    if(loss&&t.exitReason.startsWith('TAKE_'))throw Error('Stop priority broken');
    const grossProceeds=t.notionalGbp*(t.exitPrice/t.entryPrice);
    const cost=t.feeRate*(grossProceeds+t.notionalGbp);
    const net=grossProceeds-t.notionalGbp-cost;
    if(Math.abs(net-t.pnlGbp)>1e-7)throw Error('Independent 3R P&L mismatch');
    balance+=net;total+=net;
    if(net>0){wins++;winGross+=net}else lossGross-=net;
    peak=Math.max(peak,balance);drawdown=Math.max(drawdown,100*(peak-balance)/peak);
    previousExit=t.exitIndex;
  }
  if(Math.abs(total-report.netGbp)>1e-7||wins!==report.wins||
    Math.abs(drawdown-report.maxDrawdownPct)>1e-7)throw Error('Independent 3R report mismatch');
  return {matched:true,closedTrades:report.trades.length,netGbp:total,winRatePct:report.winRatePct,
    maxDrawdownPct:drawdown,profitFactor:lossGross>0?winGross/lossGross:(winGross>0?null:0)};
}
export function validate3R(bars,selection,symbol){
  if(!selection||!selection.candidate) return {verdict:'BLOCKED',reasons:['No 3R training candidate'],holdout:null,accountingMatch:false};
  const {params}=selection.candidate,cut=selection.cut;
  if(!Number.isInteger(cut)||cut<params.slow||bars.length-cut<25)throw Error('3R sealed holdout not available');
  const holdout=simulate3R(bars,params,{symbol,start:cut,end:bars.length});
  const audited=audit3RTrades(holdout,bars);
  const stress=simulate3R(bars,params,{symbol,start:cut,end:bars.length,feeMultiplier:2});
  audit3RTrades(stress,bars);
  const reasons=[];
  if(!selection.trainingEligible)reasons.push('No eligible 3R training candidate');
  if(holdout.closedTrades<R3.minimumHoldoutTrades)reasons.push('Insufficient independent closed 3R holdout trades');
  if(holdout.netGbp<=R3.minimumHoldoutNetGbp)reasons.push('Nonpositive independent 3R net return');
  if(holdout.profitFactor!==null&&holdout.profitFactor<R3.minimumHoldoutProfitFactor)reasons.push('Nonpositive 3R holdout profit factor');
  if(holdout.maxDrawdownPct>R3.maximumHoldoutDrawdownPct)reasons.push('Excess 3R holdout drawdown');
  if(stress.netGbp<=0)reasons.push('2x-cost 3R holdout stress failed');
  const {trades:_,...holdoutSummary}=holdout;
  const {trades:__,...stressSummary}=stress;
  return {verdict:reasons.length?'BLOCKED':'AUDIT_PASS',reasons,holdout:holdoutSummary,
    stress:stressSummary,accountingMatch:audited.matched,
    scope:'Sealed chronological historical 3R evaluation, not independent future 61-trade performance',
    trainingSelectionOnly:true};
}
