import * as express from "express";
import type { wsRouter } from "./wsRouter.js";

export default async function configure(app:express.Express,ws:wsRouter):Promise<void>{
    app.use(express.static("./assets/public"));
    ws.wss("/",(socket) => {
        console.log("connecting");
        socket.on("message",console.log.bind(console));
    })
}