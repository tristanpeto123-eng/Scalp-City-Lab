// Read-only historical bootstrapping on Alpaca crypto data.
// Never constructs orders; uses existing PAPER credentials for GET requests only.
import {AlpacaPaper} from './alpaca-paper.mjs';
import {loadHistoricalCrypto,replayHistorical} from './replay-profit.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const symbols=['BTC/USD','ETH/USD'];
async function main(){
 if(!process.env.ALPACA_PAPER_KEY||!process.env.ALPACA_PAPER_SECRET)
  throw Error('Paper-only read keys required as private environment secrets');
 const broker=new AlpacaPaper(),days=Number(process.env.SCALP_REPLAY_DAYS||180);
 const summary={mode:'HISTORICAL_AS_LIVE_NOT_FORWARD',tradingEnabled:false,
   initialCapital:'GBP 50 VIRTUAL',netProfitTargetGbp:2000,targetBalanceGbp:2050,
   fixedRewardRisk:null,secondaryMinimumTrades:0,tradeLimit:null,secondaryTargetWinRatePct:80,
   checkedAt:new Date().toISOString(),results:[]};
 for(const symbol of symbols){
  const source=await loadHistoricalCrypto({broker,symbol,days});
  const replay=replayHistorical({symbol,raw:source.raw,closedBefore:Date.now()-30_000});
  // No account metadata, key, secret, or raw trade orders in report.
  const {closedTradeEvidence,...publicSummary}=replay;
  summary.results.push({...publicSummary,source:{
    endpoint:'https://data.alpaca.markets/v1beta3/crypto/us/bars',
    type:source.source,fetchedPages:source.fetchedPages},replayedClosedTradeSample:
    closedTradeEvidence.slice(0,3),additionalClosedTradesOmitted:Math.max(0,closedTradeEvidence.length-3)});
 }
 console.log(JSON.stringify(summary,null,2));
 // Optional analysis artifact, NEVER log credentials or full raw OHLC history.
 if(process.env.SCALP_REPLAY_OUTPUT){
  const filepath=path.resolve(process.env.SCALP_REPLAY_OUTPUT);
  await mkdir(path.dirname(filepath),{recursive:true});
  await writeFile(filepath,JSON.stringify(summary,null,2)+'\n',{mode:0o600,flag:'w'});
 }
}
main().catch(e=>{console.error('Read-only historical replay blocked:',String(e.message||e));process.exitCode=1;});
