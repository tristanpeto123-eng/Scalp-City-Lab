// Hard-coded Alpaca PAPER endpoint. This module has NO option for production/live order URLs.
// Alpaca free IEX feed only covers one exchange, not consolidated US trades.
const TRADE='https://paper-api.alpaca.markets';
const DATA='https://data.alpaca.markets';
export class AlpacaPaper {
  constructor({key=process.env.ALPACA_PAPER_KEY,secret=process.env.ALPACA_PAPER_SECRET,fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
    if(!key||!secret)throw Error('Paper-account key and secret are required');
    this.key=key;this.secret=secret;this.fetchImpl=fetchImpl;this.now=now;
  }
  async req(base,path,{method='GET',body}={}){
    const res=await this.fetchImpl(base+path,{method,headers:{'APCA-API-KEY-ID':this.key,'APCA-API-SECRET-KEY':this.secret,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    if(!res.ok)throw Error(`Alpaca ${method} ${path.split('?')[0]} HTTP ${res.status}: ${(await res.text()).slice(0,120)}`);
    return await res.json();
  }
  clock(){return this.req(TRADE,'/v2/clock');}
  account(){return this.req(TRADE,'/v2/account');}
  positions(){return this.req(TRADE,'/v2/positions');}
  openOrders(){return this.req(TRADE,'/v2/orders?status=open&limit=100');}
  recentOrders(){return this.req(TRADE,'/v2/orders?status=all&limit=100&direction=desc');}
  async history(symbol){
    if(!['SPY','QQQ','IWM'].includes(symbol))throw Error('Unauthorized ticker');
    const start=new Date(this.now()-21*86400_000).toISOString();
    const end=new Date(this.now()).toISOString();
    const q=new URLSearchParams({timeframe:'15Min',feed:'iex',start,end,limit:'1000',sort:'asc'});
    const data=await this.req(DATA,`/v2/stocks/${symbol}/bars?${q}`);
    if(data.next_page_token)throw Error('Unconsumed market-data pagination; increase data window logic');
    return (data.bars||[]).filter(b=>Date.parse(b.t)+15*60_000<=this.now()-30_000);
  }
  async orderByClientId(id){
    // 404 = no such order; other statuses must NOT be interpreted as no order.
    const res=await this.fetchImpl(`${TRADE}/v2/orders:by_client_order_id?client_order_id=${encodeURIComponent(id)}`,{
      headers:{'APCA-API-KEY-ID':this.key,'APCA-API-SECRET-KEY':this.secret},signal:AbortSignal.timeout(12000)});
    if(res.status===404)return null;
    if(!res.ok)throw Error('Unable to establish paper order idempotency: HTTP '+res.status);
    return res.json();
  }
  paperOrder(order){
    if(!['SPY','QQQ','IWM'].includes(order.symbol)||!['buy','sell'].includes(order.side)||order.type!=='market'||order.time_in_force!=='day'||!order.client_order_id)throw Error('Rejected non-paper/invalid order');
    return this.req(TRADE,'/v2/orders',{method:'POST',body:order});
  }
}
