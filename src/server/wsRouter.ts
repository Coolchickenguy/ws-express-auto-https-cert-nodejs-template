import { router } from "./router.js";
import ws from "ws";
import type {IncomingMessage} from "http";
type callbackFunction = (
  socket: ws.WebSocket,
  next: () => void
) => void | Promise<void>;
export class wsRouter {
  _router: ReturnType<typeof router<{ ws: {}; wss: {} }>>;
  constructor() {
    this._router = new router({ ws: {}, wss: {} });
  }
  ws(path: string, listener: callbackFunction) {
    this._router.routes.ws.paths.push([path, listener]);
  }
  wss(path: string, listener: callbackFunction) {
    this._router.routes.wss.paths.push([path, listener]);
  }
  async requestHandler(
    request:IncomingMessage,
    socket: ws.WebSocket,
    isSecure: boolean
  ): Promise<void> {
    const routes = this._router.getRoutes(
      request.url as string,
      isSecure ? "wss" : "ws"
    ) as callbackFunction[];
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
    const run = () =>
      (routes.shift() || (() => {}))(socket, () => process.nextTick(run));
    run();
  }
}
