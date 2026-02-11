import type * as express from "express";
import type { wsRouter } from "../wsRouter.js";
import EventEmitter from "events";
import { type WebSocket } from "ws";

export default async function main(
  app: express.Express,
  ws: wsRouter,
): Promise<void> {
  ws.do("websocket", "/api/v1/websocket/echo", function ({ response }) {
    response.on("message", function (data, isBinary) {
      response.send(data, { binary: isBinary });
    });
  });
  const broadcastEmitter = new EventEmitter();

  ws.do("websocket", "/api/v1/websocket/broadcast", function ({ response }) {
    const us = Symbol();
    response.on("message", function (data, isBinary) {
      broadcastEmitter.emit("data", [us, data]);
    });
    const broadcastListener = ([who, data]: [symbol, WebSocket.RawData]) => {
      if (who !== us) {
        response.send(data);
      }
    };
    broadcastEmitter.on("data", broadcastListener);
    response.once("close", () => {
      broadcastEmitter.removeListener("data", broadcastListener);
    });
  });
}
