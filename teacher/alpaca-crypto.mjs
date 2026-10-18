// Teacher's crypto broker: all order writes are hard-pinned to Alpaca PAPER.
// Separate paper credentials/account per enrolled pupil; no live URLs or transfers.
import {PAIRS} from '../strategy-validation-core.mjs';
const PAPER='https://paper-api.alpaca.markets';
const DATA='https://data.alpaca.markets';
export class CryptoTeacherBroker {
  constructor({credentials={},fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
    this.credentials=credentials;this.fetchImpl=fetchImpl;this.now=now;
  }
  auth(symbol){
    if(!PAIRS.includes(symbol))throw Error('TEACHER: disallowed crypto symbol');
    const c=this.credentials[symbol];
    if(!c?.key||!c?.secret)throw Error('TEACHER: dedicated paper credentials absent for '+symbol);
    return {'APCA-API-KEY-ID':c.key,'APCA-API-SECRET-KEY':c.secret,
      Accept:'application/json','Content-Type':'application/json'};
  }
  async request(symbol,base,path,{method='GET',body,allow404=false}={}){
    if(![PAPER,DATA].includes(base)||!['GET','POST'].includes(method))
      throw Error('TEACHER: forbidden broker operation');
    if(method==='POST'&&(base!==PAPER||path!=='/v2/orders'))
      throw Error('TEACHER: orders are the ONLY allowed mutation');
    const response=await this.fetchImpl(base+path,{
      method,headers:this.auth(symbol),
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
      signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'
    });
    if(allow404&&response.status===404)return null;
    if(!response.ok)throw Error('TEACHER: Alpaca '+method+' '+path.split('?')[0]+' HTTP '+response.status);
    return response.json();
  }
  account(symbol){return this.request(symbol,PAPER,'/v2/account');}
  positions(symbol){return this.request(symbol,PAPER,'/v2/positions');}
  openOrders(symbol){return this.request(symbol,PAPER,'/v2/orders?status=open&limit=500');}
  async asset(symbol){
    return this.request(symbol,PAPER,'/v2/assets/'+encodeURIComponent(symbol));
  }
  orderByClientId(symbol,id){
    if(typeof id!=='string'||!/^teacher-[a-f0-9]{34}$/.test(id))
      throw Error('TEACHER: invalid teacher order identifier');
    return this.request(symbol,PAPER,
      '/v2/orders:by_client_order_id?client_order_id='+encodeURIComponent(id),{allow404:true});
  }
  async history(symbol){
    const now=this.now(),q=new URLSearchParams({
      symbols:symbol,timeframe:'15Min',
      start:new Date(now-8*86400_000).toISOString(),
      end:new Date(now-30_000).toISOString(),
      limit:'10000',sort:'asc'
    });
    const items=await this.request(symbol,DATA,'/v1beta3/crypto/us-1/bars?'+q);
    if(items.next_page_token)throw Error('TEACHER: unread historic bars page');
    const bars=items.bars?.[symbol];
    if(!Array.isArray(bars))throw Error('TEACHER: crypto bars omitted');
    // The strategy core independently validates OHLCV, provenance and continuity.
    return {symbol,timeframe:'15Min',source:'ALPACA_KRAKEN_US_US-1',
      generatedAt:new Date(now).toISOString(),bars:bars.filter(b=>
        Number.isFinite(Date.parse(b.t))&&Date.parse(b.t)+900000<=now-30000)};
  }
  paperOrder(symbol,order){
    if(order.symbol!==symbol||!['buy','sell'].includes(order.side)||
       order.type!=='market'||order.time_in_force!=='ioc'||
       !/^teacher-[a-f0-9]{34}$/.test(order.client_order_id||'')||
       (order.side==='buy'?!/^[0-9]+[.][0-9]{2}$/.test(order.notional||'')||order.qty!==undefined:
         !/^[0-9]+([.][0-9]+)?$/.test(order.qty||'')||order.notional!==undefined))
      throw Error('TEACHER: invalid crypto paper order');
    return this.request(symbol,PAPER,'/v2/orders',{method:'POST',body:order});
  }
  async recentOrders(symbol){
    // Deny on truncated account history; this endpoint must not silently assume
    // manual/unattributed orders do not exist beyond a single page.
    const list=await this.request(symbol,PAPER,'/v2/orders?status=all&limit=500&direction=desc');
    if(!Array.isArray(list)||list.length>=500)throw Error('TEACHER: order history not exhaustive');
    return list;
  }
  async ownedPosition(symbol,ids,qty){
    if(!(ids instanceof Set)||!ids.size)return false;
    const all=await this.recentOrders(symbol);
    if(all.some(o=>(o.symbol===symbol)&&Number(o.filled_qty)>0&&!ids.has(o.client_order_id)))
      return false;
    const net=all.filter(o=>o.symbol===symbol&&ids.has(o.client_order_id))
      .reduce((sum,o)=>sum+(o.side==='buy'?1:-1)*Number(o.filled_qty||0),0);
    return Number.isFinite(net)&&net+1e-9>=qty;
  }
  async activities(symbol,types){
    if(!['FILL','CFEE','FEE'].every(t=>typeof t==='string'))
      throw Error('TEACHER: invalid activity filter');
    if(!Array.isArray(types)||!types.length||types.some(t=>!['FILL','CFEE','FEE'].includes(t)))
      throw Error('TEACHER: unsafe activity types');
    const items=[],tokens=new Set();let token=null;
    for(let page=0;page<60;page++){
      const q=new URLSearchParams({activity_types:types.join(','),page_size:'100',direction:'desc'});
      if(token)q.set('page_token',token);
      const batch=await this.request(symbol,PAPER,'/v2/account/activities?'+q);
      if(!Array.isArray(batch))throw Error('TEACHER: invalid activities response');
      items.push(...batch);
      if(batch.length<100)return items;
      token=batch.at(-1)?.id;
      if(typeof token!=='string'||tokens.has(token))throw Error('TEACHER: activity pagination loop');
      tokens.add(token);
    }
    throw Error('TEACHER: activity pagination incomplete');
  }
}
