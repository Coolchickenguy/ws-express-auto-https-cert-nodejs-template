import type * as express from "express";
import type { wsRouter } from "../wsRouter.js";
import EventEmitter from "events";
import { type WebSocket } from "ws";

export default async function main(
  app: express.Express,
  ws: wsRouter,
): Promise<void> {
  ws.websocket("/api/v1/websocket/echo", function (req, socket) {
    socket.on("message", function (data, isBinary) {
      socket.send(data, { binary: isBinary });
    });
  });
  const broadcastEmitter = new EventEmitter();

  ws.websocket("/api/v1/websocket/broadcast", function (req, socket) {
    const us = Symbol();
    socket.on("message", function (data, isBinary) {
      broadcastEmitter.emit("data", [us, data]);
    });
    const broadcastListener = ([who, data]: [symbol, WebSocket.RawData]) => {
      if (who !== us) {
        socket.send(data);
      }
    };
    broadcastEmitter.on("data", broadcastListener);
    socket.once("close", () => {
      broadcastEmitter.removeListener("data", broadcastListener);
    });
  });
}
