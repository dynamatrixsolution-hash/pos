import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3002 });

console.log("WebSocket Server running on port 3002");

wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (message: string) => {
    try {
      const data = JSON.parse(message);
      // Broadcast this message to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (e) {
      console.error("Failed to parse websocket message:", e);
    }
  });
});
