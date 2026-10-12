// Opt-in observation channel: broadcasts research-agent status for the separate Agent City view.
// This does not grant any trading, approval, or GitHub-write capabilities.
(() => {
  if (!('BroadcastChannel' in window)) return;
  const channel = new BroadcastChannel('scalp-city-lab-telemetry-v1');
  const send = (detail, type) => {
    if (!detail || typeof detail !== 'object' || !detail.agentId) return;
    channel.postMessage({agentId:String(detail.agentId),state:String(detail.state||'OBSERVED'),
      decision:String(detail.decision||type),metric:detail.completed!=null?`${detail.completed}/${detail.total} tasks`:undefined,
      message:detail.error?`Error: ${String(detail.error).slice(0,90)}`:type});
  };
  window.addEventListener('scalp-city:agent-status', event => send(event.detail, 'Agent status update'));
  window.addEventListener('scalp-city:agent-report', event => send(event.detail, 'Backtest report available'));
})();
