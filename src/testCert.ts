// @ts-ignore
import tester from "acme-challenge-test";
import { create, giveServer } from "./http01auth.cjs";
import { setup, getCerts } from "./certTools.js";
import listen from "./https.js";
import EventEmitter from "events";
const record = "http://miss.pelling.com";
globalThis.mainEmitter = new EventEmitter();
await setup();
const server = await listen(
  (req, res) => {
    res.writeHead(404);
    res.end("Page not found");
    // Don't provide a subject as by default, it uses a self-signed cert and it is only going to be used for http anyway
  },
  getCerts(""),
  80
);
giveServer(server);
mainEmitter.on("command.serverKill", server.kill.bind(server));
tester
  .testRecord("http-01", record, create())
  .then(function () {
    let i = 0;
    let interval = setInterval(function () {
      if (server.isAlive) {
        i++;
      } else {
        console.log("server killed");
      }
      if(server.isAlive && i > 4){
        console.log("Failed to auto kill server. Manualy kiling.");
        server.kill();
      }
      if((i > 4) || !server.isAlive){
        clearInterval(interval);
      }
    }, 500);
    console.info("PASS", record);
  })
  .catch(function (e: Error) {
    console.error(e.message);
    console.error(e.stack);
  });
