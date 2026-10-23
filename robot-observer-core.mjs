/**
 * Autonomous Robot Observer: independent, fail-closed historical research UI.
 * It NEVER learns, trades, updates broker state or grants a Teacher grade.
 * Browser-only replay animation is NOT new model learning or broker trading.
 */
export const REPORT_SCHEMA = 'SCALP_RAPID_RL_REPLAY_V1';
export const REPLAY_SCHEMA = 'SCALP_CAUSAL_REPLAY_5MIN_V1';
export const SYMBOLS = Object.freeze([
  'BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD',
  'AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD'
]);
export const COACH_TYPES = Object.freeze([
  'Investigate inactivity',
  'Review transaction costs',
  'Review excessive trading',
  'Review drawdown',
  'Consider more exploration'
]);
const finite = x => typeof x === 'number' && Number.isFinite(x);
const fail = why => { throw new Error('UNVERIFIED_RESEARCH: '+why); };

export function validateReport(data) {
  if (!data || data.schema !== REPORT_SCHEMA ||
      data.marketBarTimeframe !== '5Min' ||
      data.simulationClock !== 'HISTORICAL_REPLAY' ||
      data.decisionsAreNotBrokerTrades !== true ||
      data.paperOrders !== 0 || data.liveOrders !== 0 ||
      data.verifiedForwardGrades !== 0 ||
      data.sealedHoldoutAccessed !== false || data.automaticAdmissions !== 0)
    fail('not a locked simulated 5-minute historical report');
  if (!Array.isArray(data.pupils) || data.pupils.length !== SYMBOLS.length ||
      new Set(data.pupils.map(x => x.symbol)).size !== SYMBOLS.length ||
      data.pupils.some(x => !SYMBOLS.includes(x.symbol))) fail('incorrect pupil roster');
  if (!Number.isFinite(Date.parse(data.generatedAt))) fail('unverifiable generation timestamp');
  if (!Number.isInteger(data.gradientUpdates) || data.gradientUpdates < 0 ||
      !Number.isInteger(data.decisionCount) || data.decisionCount < 0 ||
      !Number.isInteger(data.simulatedClosedTrades) || data.simulatedClosedTrades < 0)
    fail('incorrect training counters');
  for (const p of data.pupils) {
    if (!/^[0-9a-f]{64}$/.test(p.modelSha256 || '') ||
        !/^[0-9a-f]{64}$/.test(p.sourceTrainingFingerprint || '') ||
        p.visualReplayPath !== 'rl-rapid/replays/'+p.symbol.replace('/','-')+'-5m.json' ||
        p.paperOrders !== 0 || p.forwardVerified !== false ||
        p.researchOnly !== true ||
        !Number.isInteger(p.cumulativeGradientUpdates) ||
        !Number.isInteger(p.cumulativeDecisions) ||
        !finite(p.laterDevelopmentNetGbp) ||
        !finite(p.laterDevelopmentStressedNetGbp) ||
        !finite(p.laterDevelopmentMaxDrawdownPct) ||
        p.laterDevelopmentMaxDrawdownPct < 0) fail('pupil research provenance failed');
  }
  return data;
}

export function validateTrace(data, pupil) {
  if (!data || !pupil || data.schema !== REPLAY_SCHEMA ||
      data.symbol !== pupil.symbol || data.policySha256 !== pupil.modelSha256 ||
      data.timeframe !== '5Min' || data.historicalOnly !== true ||
      data.futureCandlesVisibleAtOnce !== false ||
      data.fillsAreSimulated !== true || data.forwardPaperVerified !== false ||
      data.heldOutQuarantineTouched !== false ||
      data.paperOrders !== 0 || data.liveOrders !== 0 ||
      data.accountingCurrency !== 'VIRTUAL_UNITS' ||
      data.startingVirtualBalance !== 50 ||
      !Array.isArray(data.candles) || data.candles.length < 35 ||
      !Array.isArray(data.decisions) || !data.decisions.length ||
      !Array.isArray(data.virtualFills) || !Array.isArray(data.closedTrades))
    fail('unverified or mismatched virtual trading replay');
  let prev = -Infinity;
  const candleTimes = new Set();
  for (const c of data.candles) {
    if (!Number.isInteger(c.t) || c.t <= prev ||
        ![c.o,c.h,c.l,c.c,c.v].every(finite) ||
        c.c <= 0 || c.h < Math.max(c.o,c.c,c.l) ||
        c.l > Math.min(c.o,c.c,c.h) || c.v < 0) fail('untrusted historical candle');
    if (prev !== -Infinity && c.t-prev !== 300000)
      fail('noncontiguous published native 5m market data');
    candleTimes.add(c.t); prev=c.t;
  }
  let last = -Infinity;
  for (const d of data.decisions) {
    if (!Number.isInteger(d.observedCandleTime) ||
        !Number.isInteger(d.nextCandleTime) ||
        d.nextCandleTime !== d.observedCandleTime + 300000 ||
        d.observedCandleTime <= last ||
        !candleTimes.has(d.observedCandleTime) ||
        !candleTimes.has(d.nextCandleTime) ||
        !['LONG','FLAT'].includes(d.action) ||
        !finite(d.equityGbp) || d.equityGbp < 0 ||
        !Number.isInteger(d.simulatedClosedTrades) ||
        !['BUY','SELL',null].includes(d.executionSide) ||
        (d.executionSide !== null && !finite(d.executionPriceUsd)))
      fail('noncausal or malformed replay decision');
    last=d.observedCandleTime;
  }
  last=-Infinity;
  for (const f of data.virtualFills) {
    if (!['BUY','SELL'].includes(f.side) || !Number.isInteger(f.candleTime) ||
        f.candleTime < last || !candleTimes.has(f.candleTime) ||
        !finite(f.executionPriceUsd) || f.executionPriceUsd <= 0 ||
        !finite(f.feeVirtual) || f.feeVirtual < 0 ||
        !Number.isInteger(f.sourceDecisionTime) ||
        f.sourceDecisionTime !== f.candleTime-300000)
      fail('noncausal or malformed simulated fill');
    last=f.candleTime;
  }
  last=-Infinity;
  for (const t of data.closedTrades) {
    if (!Number.isInteger(t.exitTime) || t.exitTime < last ||
        !candleTimes.has(t.exitTime) || !finite(t.netProfitVirtual) ||
        !['WIN','LOSS'].includes(t.outcome))
      fail('malformed closed-trade evidence');
    last=t.exitTime;
  }
  return data;
}

export function replayState(trace, pupil, cursor) {
  validateTrace(trace, pupil);
  if (!Number.isInteger(cursor) || cursor < 0 || cursor >= trace.decisions.length)
    throw new RangeError('Invalid historical replay position');
  const decision=trace.decisions[cursor];
  const completed=trace.closedTrades.filter(t=>t.exitTime <= decision.nextCandleTime);
  const fills=trace.virtualFills.filter(t=>t.candleTime <= decision.nextCandleTime);
  let peak=trace.startingVirtualBalance, maxDrawdownPct=0;
  for(let j=0;j<=cursor;j++) {
    const equity=trace.decisions[j].equityGbp;
    peak=Math.max(peak,equity);
    maxDrawdownPct=Math.max(maxDrawdownPct,100*(peak-equity)/Math.max(peak,1e-9));
  }
  const wins=completed.filter(t=>t.netProfitVirtual>0).length;
  return {
    decision, fills, completed,
    candles:trace.candles.filter(x=>x.t <= decision.nextCandleTime),
    equity:decision.equityGbp,
    net:decision.equityGbp-trace.startingVirtualBalance,
    maxDrawdownPct,
    wins,
    winRate:completed.length?100*wins/completed.length:null,
    openPosition:decision.openPosition === true,
    mode:'HISTORICAL_VIRTUAL_REPLAY'
  };
}

export function coachingPacket({type,note,symbol,modelSha256,generatedAt}) {
  if(!COACH_TYPES.includes(type) || !SYMBOLS.includes(symbol) ||
     !/^[0-9a-f]{64}$/.test(modelSha256||'') ||
     !Number.isFinite(Date.parse(generatedAt)) ||
     typeof note!=='string' || note.length>250)
    throw new Error('Invalid local coaching draft');
  return {
    schema:'SCALP_OWNER_COACH_PROPOSAL_V1',
    status:'LOCAL_DRAFT_NOT_SENT_NOT_APPLIED',
    symbol,modelSha256,sourceReportAt:generatedAt,
    intervention:type,notes:note.trim(),
    effectOnTraining:'NONE_UNTIL_INDEPENDENT_REVIEW',
    brokerOrders:0,gradesGranted:0
  };
}
