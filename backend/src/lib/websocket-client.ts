import WebSocket from "ws";

export function broadcastSync(module: string, action: string, data?: any) {
  try {
    const ws = new WebSocket("ws://localhost:3002");
    ws.on("open", () => {
      ws.send(JSON.stringify({ module, action, data }));
      ws.close();
    });
    ws.on("error", () => {
      // Ignore websocket errors if server is down
    });
  } catch (err) {
    // Ignore
  }
}
