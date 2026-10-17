// Strictly read-only Alpaca PAPER crypto credential and 24/7 market-data check.
// No paperOrder(), no POST, no transaction or production brokerage access.
const PAPER='https://paper-api.alpaca.markets';
const DATA='https://data.alpaca.markets';
const PAIRS=['BTC/USD','ETH/USD'];
const timeframeMs=15*60*1000;
const key=process.env.ALPACA_PAPER_KEY,secret=process.env.ALPACA_PAPER_SECRET;
if(!key||!secret){console.error('Paper Actions secrets missing');process.exit(2);}
async function readJSON(base,path){
  const response=await fetch(base+path,{method:'GET',
    headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret},
    signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Read-only API '+path.split('?')[0]+' HTTP '+response.status);
  return response.json();
}
function validate(rows,now){
  if(!Array.isArray(rows)||rows.length<75)throw Error('Insufficient crypto 15-minute history');
  let previous=0;let recent=null;let count=0;
  for(const row of rows){
    const ts=Date.parse(row.t);
    if(!Number.isFinite(ts)||ts<=previous)throw Error('Nonmonotonic or duplicate crypto bars');
    previous=ts;
    const o=Number(row.o),h=Number(row.h),l=Number(row.l),c=Number(row.c),v=Number(row.v);
    if(![o,h,l,c,v].every(Number.isFinite)||Math.min(o,h,l,c)<=0||v<0||
       h<Math.max(o,l,c)||l>Math.min(o,h,c))throw Error('Invalid crypto OHLCV');
    if(ts+timeframeMs<=now-30_000){count++;recent=ts;}
  }
  if(recent===null)throw Error('No completed crypto bars');
  return {completedBars:count,ageMinutes:Math.round((now-(recent+timeframeMs))/60000),
          latestCompletedAt:new Date(recent+timeframeMs).toISOString()};
}
async function main(){
  const now=Date.now();
  const [account,assetList]=await Promise.all([
    readJSON(PAPER,'/v2/account'),
    readJSON(PAPER,'/v2/assets?status=active&asset_class=crypto')
  ]);
  if(account.status!=='ACTIVE')throw Error('PAPER account is not ACTIVE');
  if(!Array.isArray(assetList))throw Error('Crypto asset response invalid');
  const pairs=[];
  for(const pair of PAIRS){
    const match=assetList.find(a=>a.symbol===pair);
    const eligible=Boolean(match&&match.status==='active'&&match.tradable===true&&
      match.fractionable===true&&match.shortable===false);
    const start=new Date(now-3*86400_000).toISOString();
    const end=new Date(now).toISOString();
    const query=new URLSearchParams({symbols:pair,timeframe:'15Min',start,end,limit:'1000',sort:'asc'});
    const data=await readJSON(DATA,'/v1beta3/crypto/us/bars?'+query);
    if(data.next_page_token)throw Error(pair+': additional pages; incomplete data');
    const result=validate(data?.bars?.[pair],now);
    const freshness=result.ageMinutes<=45?'FRESH':'STALE';
    pairs.push({pair,paperTradable:eligible,assetStatus:match?.status||'NOT_LISTED',
      feed:'crypto/us',...result,freshness});
  }
  const ok=pairs.every(p=>p.paperTradable&&p.freshness==='FRESH');
  console.log(JSON.stringify({check:'CRYPTO_PAPER_READ_ONLY',paperAccount:account.status,
    paperOrdersSubmitted:0,clock:'24/7',pairs,checkedAt:new Date(now).toISOString(),result:ok?'PASS':'BLOCKED'},null,2));
  if(!ok)process.exitCode=2;
}
main().catch(e=>{console.error('CRYPTO PREFLIGHT BLOCKED:',String(e.message||e));process.exitCode=1;});
