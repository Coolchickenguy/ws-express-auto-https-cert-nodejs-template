import * as express from "express";
import type { wsRouter } from "./wsRouter.js";
import add404 from "./middleware/404.js";

export default async function configure(app:express.Express,ws:wsRouter):Promise<void>{
    app.use(express.static("./assets/public"));
   /* ws.wss("/",function(socket){
        console.log("/404page/404pageng");
        socket.on("message",console.log.bind(console));
    })*/
    add404(app,ws);
}