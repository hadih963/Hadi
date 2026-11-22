// A WebSocket that reconnects by itself (TV Wi-Fi drops, laptop sleeps, server restarts).
// Usage: const conn = connect({ onMessage, onStatus }); conn.send({ type: 'undo' });
export function connect({ onMessage, onStatus = () => {} }) {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  let ws = null;
  let delay = 1000;           // retry after 1s, 2s, 4s ... max 15s
  const queue = [];           // messages typed while offline are sent after reconnect

  function open() {
    ws = new WebSocket(url);
    ws.onopen = () => {
      delay = 1000;
      onStatus(true);
      while (queue.length) ws.send(queue.shift());
    };
    ws.onmessage = (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      onMessage(msg);
    };
    ws.onclose = () => {
      onStatus(false);
      setTimeout(open, delay);
      delay = Math.min(delay * 2, 15000);
    };
    ws.onerror = () => ws.close();
  }
  open();

  return {
    send(msg) {
      const data = JSON.stringify(msg);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
      else if (queue.length < 200) queue.push(data);
    },
  };
}
