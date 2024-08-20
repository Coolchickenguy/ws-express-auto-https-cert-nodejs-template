import { createConnection } from "net";
import * as http from "http";
import { createServer } from "net";
import { Duplex } from "stream";

const server = createServer((sock) =>
  sock.on("data", (d) => console.log(d.toString()))
);
const fakeSock1 = new Duplex({ read() {}, write:(...args) => fakeSock2.push(...args) });
const fakeSock2 = new Duplex({ read() {}, write:fakeSock1.push.bind(fakeSock1) });
server.emit("connection",fakeSock1)
//const socket = createConnection({ host: "localhost", port: 80 });
http
  .request(
    {
      createConnection() {
        return fakeSock2;
      },
      hostname: "localhost",
      port: 80,
      path: "/",
      method: "GET",
    },
    (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        console.log(`BODY: ${chunk}`);
      });
      res.on("end", () => {
        console.log("No more data in response.");
      });
    }
  )
  .end();
