import * as stream from "stream";
import * as http from "http";
import { createServer as createNetServer } from "net";
createNetServer((socket) => {
  socket.on("data", (rawRequest) => {
    const server = http.createServer((req, res) => {
        res.socket.write(Buffer.alloc(0));
        res.socket.end();
        return 
      res.setHeader("Connection", "close");
      res.end(req.url);
    });
    const out = [];
    const hack = new stream.Duplex({
      read: () => {},
      write: (chunk, encodeing, cb) => {
        out.push([chunk, encodeing]);
        cb();
      },
    });
    server.emit("connection", hack);
    hack.push(rawRequest);
    hack.push(null);
    hack.on("end", () => {
      console.log(out.toString());
      process.exit(0);
    });
  });
}).listen(1280);
http.get("http://localhost:1280");
