import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const source=await readFile(new URL('../journey-nav.js',import.meta.url),'utf8');
function load(page='robot-academy.html',pupil='SOLUSD'){
 const nodes=[],events=new Map(),historyCalls=[];
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.hidden=false;this.className='';this.textContent='';nodes.push(this)}
  append(...parts){this.children.push(...parts)}
  appendChild(n){this.append(n);return n}
  setAttribute(k,v){this.attrs[k]=String(v)}
  insertAdjacentElement(_where,n){this.append(n)}
  addEventListener(k,fn){this.events??=new Map();this.events.set(k,fn)}
  contains(other){return this.children.includes(other)}
  focus(){}
 }
 const host=new Node('header'),head=new Node('head'),body=new Node('body');
 const document={
  head,body,
  createElement:tag=>new Node(tag),
  createTextNode:txt=>({textContent:txt}),
  querySelector:sel=>sel==='.sc-journey-dock'?null:sel.includes('body >')?host:null,
  querySelectorAll:sel=>sel==='[data-sc-pupil-target]'?
   nodes.filter(n=>Object.hasOwn(n.dataset,'scPupilTarget')):[],
  addEventListener:(key,fn)=>events.set(key,fn)
 };
 const location={href:'https://example.test/Scalp-City-Lab/'+page+'?pupil='+pupil,
  pathname:'/Scalp-City-Lab/'+page,search:'?pupil='+pupil};
 const history={state:null,replaceState:(_state,_title,url)=>historyCalls.push(url)};
 new Script(source,{filename:'journey-nav.js'}).runInNewContext({
  document,location,history,URL,URLSearchParams
 });
 return {nodes,events,historyCalls,byClass:klass=>nodes.find(n=>n.className===klass),
  stage:route=>nodes.find(n=>n.dataset?.scPupilTarget===route)};
}
test('Academy handoff retains the active pupil in Teacher and Trading Floor links',()=>{
 const x=load();
 assert.equal(new URL(x.byClass('sc-journey-quick').href).searchParams.get('pupil'),'SOLUSD');
 assert.equal(new URL(x.stage('trading-floor.html').href).searchParams.get('pupil'),'SOLUSD');
 x.events.get('scalp:pupil-selected')({detail:{pupil:'ETH/USD'}});
 assert.equal(new URL(x.byClass('sc-journey-quick').href).searchParams.get('pupil'),'ETHUSD');
 assert.equal(new URL(x.stage('robot-academy.html').href).searchParams.get('pupil'),'ETHUSD');
 assert.equal(new URL(x.stage('trading-floor.html').href).searchParams.get('pupil'),'ETHUSD');
 assert.match(x.historyCalls.at(-1),/pupil=ETHUSD/);
});
test('Invalid pupil event cannot contaminate any navigation link',()=>{
 const x=load('teacher-console.html','BTCUSD');
 x.events.get('scalp:pupil-selected')({detail:{pupil:'../../../malicious'}});
 assert.equal(x.historyCalls.length,0);
 assert.equal(new URL(x.stage('trading-floor.html').href).searchParams.get('pupil'),'BTCUSD');
 x.events.get('scalp:pupil-selected')({detail:{pupil:'BCHUSD'}});
 assert.match(x.historyCalls.at(-1),/pupil=BCHUSD/);
 assert.equal(new URL(x.stage('trading-floor.html').href).searchParams.get('pupil'),'BCHUSD');
});
