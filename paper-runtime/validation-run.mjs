import {AlpacaPaper} from './alpaca-paper.mjs';
import {loadHistoricalCrypto} from './replay-profit.mjs';
import {checkValidationInput,runHistoricalValidation} from './validation-lab.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
// Environment inputs are provided by the Actions "Run workflow" form.
// No free-form code, broker order method or imported user-supplied files.
async function main(){
 const form=checkValidationInput({
  symbol:process.env.SCALP_TEST_SYMBOL||'BTC/USD',
  feed:process.env.SCALP_TEST_FEED||'us-1',
  mode:process.env.SCALP_TEST_MODE||'DURATION',
  startingBalanceGbp:Number(process.env.SCALP_START_GBP||'50'),
  durationDays:process.env.SCALP_TEST_MODE==='PROFIT'?null:Number(process.env.SCALP_DURATION_DAYS||'30'),
  targetNetProfitGbp:process.env.SCALP_TEST_MODE==='PROFIT'?Number(process.env.SCALP_TARGET_PROFIT_GBP||'2000'):null,
  historyDays:Number(process.env.SCALP_HISTORY_DAYS||'180')
 });
 if(!process.env.ALPACA_PAPER_KEY||!process.env.ALPACA_PAPER_SECRET)
  throw Error('Alpaca paper data secrets missing; refuse to claim simulation without market data');
 const source=await loadHistoricalCrypto({broker:new AlpacaPaper(),
  symbol:form.symbol,days:form.historyDays,location:form.feed,
  maximumPages:100});
 const report=runHistoricalValidation({input:form,raw:source.raw,closedBefore:Date.now()-30000});
 const full={...report,source:{
  marketData:'Alpaca read-only historical crypto US / Kraken-US bars',
  endpoint:'GET /v1beta3/crypto/'+form.feed+'/bars',
  paginatedPages:source.fetchedPages,rawCandles:source.raw.length,
  historyRequestedDays:form.historyDays
 }};
 // No actual account transfers, trading orders or funds are accessed.
 console.log('VALIDATION_RESULT '+JSON.stringify(full));
 if(process.env.SCALP_VALIDATION_OUTPUT){
  const out=path.resolve(process.env.SCALP_VALIDATION_OUTPUT);
  await mkdir(path.dirname(out),{recursive:true});
  await writeFile(out,JSON.stringify(full,null,2)+'\n',{mode:0o600});
 }
}
main().catch(e=>{
 console.error('VALIDATION_BLOCKED '+String(e.message||e).slice(0,240));
 process.exitCode=1;
});
