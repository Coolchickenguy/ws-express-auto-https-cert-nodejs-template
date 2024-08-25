import express from "express";
import listen from "./https.js";
import { getCerts, setup } from "./certTools.js";
import { getConfig } from "./config.js";
import { giveServer } from "./http01auth.cjs";
import configure from "./server/index.js";
import { wsRouter } from "./server/wsRouter.js";
import { WebSocketServer } from "ws";
import { createServer } from "http";
const webSocketServerInstance = new WebSocketServer({ noServer: true });
const config = getConfig();
if (config.doCert) {
  await setup();
}
const app = express();
const wsRouterInstance = new wsRouter();
configure(app, wsRouterInstance);
let cert: ReturnType<typeof getCerts>;
let servers: Awaited<ReturnType<typeof listen>>[];
async function refreshCerts(): Promise<void> {
  cert = getCerts(config.subject);
  if (servers) {
    servers.forEach((value) => {
      value.refresh(cert);
    });
  } else {
    servers = [await listen(app, cert, 443), await listen(app, cert, 80)];
    const port80RedirectServer = createServer(function (req, res) {
      res.writeHead(302, {
        location: `https://${req.headers.host?.replace(/:\d+$/gm,"") || "localhost" + req.url}`,
      });
      res.end();
    });
    servers[1].insecureServer = port80RedirectServer;
    servers[1].secureServer = port80RedirectServer;
    // Handle websockets
    servers[0].secureServer.on("upgrade", (req, socket, head) => {
      webSocketServerInstance.handleUpgrade(
        req,
        socket,
        head,
        function (ws, request) {
          wsRouterInstance.requestHandler(request, ws, true);
        }
      );
    });
    servers[1].insecureServer.on("upgrade", (req, socket, head) => {
      webSocketServerInstance.handleUpgrade(
        req,
        socket,
        head,
        function (ws, request) {
          wsRouterInstance.requestHandler(request, ws, false);
        }
      );
    });
    // Give port 80
    giveServer(servers[1]);
  }
}
await refreshCerts();
