import { requestRouter } from "./router.js";
import type ws from "ws";
import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
type callbackFunction = (
  context: {
    request: IncomingMessage;
    response: WebSocket;
    parameters: { path: { [key: string]: string } };
  },
  next: () => void,
) => void | Promise<void>;
export class wsRouter {
  _router: requestRouter<
    {
      ws: { satisfies: ["websocket"] };
      wss: { satisfies: ["websocket"] };
      websocket: {};
    },
    callbackFunction
  >;
  _precedence: number = 0;
  _websocketServer: WebSocketServer;
  constructor() {
    this._router = new requestRouter({
      ws: { satisfies: ["websocket"] },
      wss: { satisfies: ["websocket"] },
      websocket: { satisfies: [] },
    });
    this._websocketServer = new WebSocketServer({ noServer: true });
  }

  do(
    type: keyof typeof this._router.routes,
    path: string,
    listener: callbackFunction,
  ) {
    this._router.routes[type].paths.push({
      path,
      precedence: this._precedence++,
      value: listener,
    });
  }

  async upgradeHandler(
    isSecure: boolean,
    request: IncomingMessage,
    requestSocket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const routes = this._router.getRoutes(
      request.url as string,
      isSecure ? "wss" : "ws",
    );
    if (routes.length === 0) {
      requestSocket.destroy();
      return;
    }
    const [socket] = await new Promise<[ws, IncomingMessage]>((resolve) =>
      this._websocketServer.handleUpgrade(
        request,
        requestSocket,
        head,
        (...args) => resolve(args),
      ),
    );
    let isAlive = true;
    const interval = setInterval(function () {
      if (!isAlive) {
        socket.terminate();
      }
      socket.ping();
      isAlive = false;
    }, 30000);
    socket.on("close", () => clearInterval(interval));
    socket.on("pong", () => (isAlive = true));
    const run = async () => {
      try {
        const route = routes.shift();
        if (route) {
          await route.item.value(
            {
              request,
              response: socket,
              parameters: { path: route.env },
            },
            () => queueMicrotask(run),
          );
        }
      } catch (e) {
        console.error(e);
        socket.close(1011);
      }
    };
    run();
  }
}
