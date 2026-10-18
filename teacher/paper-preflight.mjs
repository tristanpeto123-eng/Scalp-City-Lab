// Read-only Alpaca PAPER connection probe. Can be used BEFORE a pupil passes
// historical admission, and never places, cancels or modifies any order.
import {CryptoTeacherBroker} from './alpaca-crypto.mjs';
import {PAIRS} from '../strategy-validation-core.mjs';

export async function preflightPaper({broker,symbols=PAIRS}={}){
 if(!broker||!Array.isArray(symbols)||!symbols.length)throw Error('PREFLIGHT: broker/pupils required');
 if(new Set(symbols).size!==symbols.length||symbols.some(s=>!PAIRS.includes(s)))
  throw Error('PREFLIGHT: invalid/duplicate pupil pair');
 const accounts=new Set(),rows=[];
 for(const symbol of symbols){
  // Each account+symbol query is a GET against paper-only HTTPS.
  const [account,asset,positions,openOrders]=await Promise.all([
   broker.account(symbol),broker.asset(symbol),broker.positions(symbol),
   broker.openOrders(symbol)]);
  if(!account?.id||accounts.has(account.id))
   throw Error('PREFLIGHT: missing or shared crypto paper account');
  accounts.add(account.id);
  if(!asset||asset.symbol!==symbol||asset.class!=='crypto')
   throw Error('PREFLIGHT: symbol not confirmed to be a crypto asset');
  const reasons=[];
  if(!['ACTIVE','PAPER_ONLY'].includes(account.status))
    reasons.push('Account status '+String(account.status||'unknown'));
  if(account.trading_blocked||account.account_blocked||account.trade_suspended_by_user)
    reasons.push('Broker account blocked/suspended');
  if(account.crypto_status&& !['ACTIVE','PAPER_ONLY'].includes(account.crypto_status))
    reasons.push('Crypto permission not active');
  if(!asset.tradable||asset.shortable||asset.marginable)
    reasons.push('Asset not eligible for long-only spot trading');
  if(!Array.isArray(positions)||!Array.isArray(openOrders))
    reasons.push('Cannot establish clean paper inventory');
  else if(positions.length||openOrders.length)
    reasons.push('Paper account is not empty; manual review mandatory');
  if(!Number.isFinite(Number(account.non_marginable_buying_power))||
      Number(account.non_marginable_buying_power)<25)
    reasons.push('Insufficient paper-only buying power for $25 order');
  const min=Number(asset.min_order_size),increment=Number(asset.min_trade_increment);
  if(!Number.isFinite(min)||min<=0||!Number.isFinite(increment)||increment<=0)
    reasons.push('Asset size/precision missing');
  rows.push({symbol,passed:!reasons.length,reasons,
    accountHashSuffix:String(account.id).slice(-5),
    status:account.status,cryptoStatus:account.crypto_status||'NOT_REPORTED',
    minimumOrderSize:min,minimumTradeIncrement:increment,
    verifiedPaperOnly:true,operation:'READ_ONLY_GET'});
 }
 return {schema:'TEACHER_ALPACA_PAPER_PREFLIGHT_V1',check:'READ_ONLY_NO_ORDERS',
   accountsChecked:rows.length,allPassed:rows.every(x=>x.passed),rows,
   next:'Separate independent research admission and owner release approval still required'};
}
async function main(){
 const value=process.env.TEACHER_PAPER_CREDENTIALS_JSON;
 if(!value)throw Error('PREFLIGHT: set private PAPER credentials on the host, not in GitHub/browser');
 let credentials;
 try{credentials=JSON.parse(value)}catch{throw Error('PREFLIGHT: credentials configuration must be JSON');}
 const symbols=process.env.TEACHER_PREFLIGHT_SYMBOLS?
   process.env.TEACHER_PREFLIGHT_SYMBOLS.split(','):PAIRS.filter(p=>credentials[p]?.key&&credentials[p]?.secret);
 if(!symbols.length)throw Error('PREFLIGHT: no paper account credentials configured');
 const report=await preflightPaper({broker:new CryptoTeacherBroker({credentials}),symbols});
 console.log(JSON.stringify(report,null,2));
 if(!report.allPassed)process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+
  (await import('node:path')).resolve(process.argv[1])).href)
  main().catch(e=>{console.error('READ_ONLY_PREFLIGHT_BLOCKED',e.message);process.exitCode=1;});
