// Credential preflight: READ ONLY. No order method is called by this program.
import { AlpacaPaper } from './alpaca-paper.mjs';
import { curateBars, inOpeningGrace } from './engine.mjs';

async function run(){
  if(!process.env.ALPACA_PAPER_KEY||!process.env.ALPACA_PAPER_SECRET){
    console.error('BLOCKED: Configure paper-only ALPACA_PAPER_KEY and ALPACA_PAPER_SECRET as private environment secrets.');
    process.exitCode=2;return;
  }
  const broker=new AlpacaPaper();
  const [account,clock]=await Promise.all([broker.account(),broker.clock()]);
  if(account.status!=='ACTIVE')throw Error('Paper account is not active.');
  const now=Date.now(), open=Boolean(clock.is_open);
  const preopenGrace=open&&inOpeningGrace(now);
  const symbols=[];
  for(const symbol of ['SPY','QQQ','IWM']){
    const raw=await broker.history(symbol);
    if(raw.length<150)throw Error(symbol+': fewer than 150 completed IEX candles');
    let status='MARKET_CLOSED_OR_OPENING_GRACE';
    if(open&&!preopenGrace){
      curateBars(raw,now);
      status='FRESH_FEED_VERIFIED';
    }
    symbols.push({
      symbol,completedBars:raw.length,lastBar:raw.at(-1)?.t,
      feed:'iex',status
    });
  }
  console.log(JSON.stringify({
    mode:'READ_ONLY_PREFLIGHT',broker:'ALPACA_PAPER',accountStatus:account.status,
    tradingAllowed:false,marketOpen:open,
    symbols,checkedAt:new Date(now).toISOString()
  },null,2));
}
run().catch(err=>{console.error('PREFLIGHT FAILED:',String(err?.message||err));process.exitCode=1;});
