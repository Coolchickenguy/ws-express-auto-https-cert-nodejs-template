"use strict";

//var request;
import path from "path";
import http from "http";
import { Duplex } from "stream";
import { Socket } from "net";
import { createServer } from "net";
type server = {
  get intercepter(): undefined | ((socket: Socket) => void);
  startIntercept(
    callbackFunction: (
      request: Buffer,
      socket: Socket
    ) => void | true | Promise<void | true>
  ): void;
  endIntercept(): void;
};
let server: server | undefined;
export function giveServer(inputServer: server) {
  server = inputServer;
}
export function create() {
  return {
    init: function () {
      return Promise.resolve(null);
    },

    set: function (data: any) {
      // console.log('Add Key Auth URL', data);

      var ch = data.challenge;
      if (server?.startIntercept) {
        var httpServer = http.createServer(function (request, responce) {
          if (
            request.url ===
              path.posix.join("/.well-known/acme-challenge/", ch.token) ||
            request.url ===
              path.posix.join("/.well-known/acme-challenges/", ch.token)
          ) {
            responce.end(ch.keyAuthorization);
          } else {
            // @ts-ignore
            responce.socket.write(Buffer.alloc(0));
            // @ts-ignore
            responce.socket.end();
          }
        });
        server?.startIntercept((request, sock) => {
          return new Promise<void | true>(function (resolve) {
            const output: Buffer[] = [];
            const captureStream = new Duplex({
              read: function () {},
              write: function (chunk, _encodeing, cb) {
                output.push(chunk);
                cb();
              },
            });

            httpServer.emit("connection", captureStream);
            captureStream.push(request);
            captureStream.push(null);
            captureStream.on("end", function () {
              const outBuff = Buffer.concat(output);
              if (outBuff.length === 0) {
                resolve(true);
              } else {
                // Handle a timed out socket
                sock.on("timeout", function () {
                  sock.destroy();
                });
                sock.write(outBuff);
                sock.end();
                resolve();
              }
            });
          });
        });
      }

      return Promise.resolve(null);
    },

    get: function (data: any): Promise<{ keyAuthorization: string } | null> {
      // console.log('List Key Auth URL', data);

      var ch = data.challenge;
      if (!server) {
        return Promise.resolve(null);
      }
      // Do this so the preflight check actually checks anything
      // It may look like it uses the network, but it 100% does it all in memory for saftey.
      return new Promise(function (resolve) {
        const intercepter = server?.intercepter;
        if (typeof intercepter === "function") {
          const server = createServer(intercepter);
          // A pair of linked Duplex streams
          const sock1: Duplex = new Duplex({
            read() {},
            write(chunk, encoding, cb) {
              sock2.push(chunk, encoding);
              cb();
            },
          });
          const sock2 = new Duplex({
            read() {},
            write(chunk, encoding, cb) {
              sock1.push(chunk, encoding);
              cb();
            },
          });
          // Pass the server the first socket
          server.emit("connection", sock1);
          http
            .request(
              {
                // Make the http server write the request to the tcp server
                createConnection: function () {
                  return sock2;
                },
                hostname: "localhost",
                port: 80,
                path: path.posix.join(
                  "/.well-known/acme-challenges/",
                  ch.token
                ),
                method: "GET",
              },
              function (responce) {
                const data: Buffer[] = [];
                responce.on("data", Array.prototype.push.bind(data));
                responce.on("end", function () {
                  const dataBuffer = Buffer.concat(data);
                  resolve({ keyAuthorization: dataBuffer.toString() });
                });
              }
            )
            .end();
        } else {
          resolve(null);
        }
      });
    },

    remove: function (): Promise<null> {
      // console.log('Remove Key Auth URL', data);
      server?.endIntercept();
      return Promise.resolve(null);
    },
  };
}
