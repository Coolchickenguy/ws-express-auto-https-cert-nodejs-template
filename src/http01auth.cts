"use strict";

//var request;
import path from "path";
import http from "http";
import { Duplex } from "stream";
import { Socket } from "net";
import { createServer } from "net";
type server = {
  /**
   * The function passed to the tcp server to intercept requests from the default callback
   */
  get requestInterceptor(): (socket: Socket) => void;
  /**
   * Start intercepting requests
   * @param callbackFunction The callback for intercepted requests.
   */
  startIntercept(
    callbackFunction: (
      request: Buffer,
      socket: Socket,
    ) => true | void | Promise<true | void>,
  ): void;
  /**
   * Stop intercepting requests
   */
  removeIntercept(
    callbackFunction: (
      request: Buffer,
      socket: Socket,
    ) => true | void | Promise<true | void>,
  ): void;
};
let server: server | undefined;
let requestInterceptor:
  | ((request: Buffer, socket: Socket) => true | void | Promise<true | void>)
  | undefined;
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
        var httpServer = http.createServer(function (request, response) {
          if (
            request.url ===
              path.posix.join("/.well-known/acme-challenge/", ch.token) ||
            request.url ===
              path.posix.join("/.well-known/acme-challenges/", ch.token)
          ) {
            response.end(ch.keyAuthorization);
          } else {
            // @ts-ignore
            response.socket.write(Buffer.alloc(0));
            // @ts-ignore
            response.socket.end();
          }
        });
        requestInterceptor = (request, sock) => {
          return new Promise<void | true>(function (resolve) {
            const output: Buffer[] = [];
            const captureStream = new Duplex({
              read: function () {},
              write: function (chunk, _encoding, cb) {
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
        };
        server?.startIntercept(requestInterceptor);
      }

      return Promise.resolve(null);
    },

    get: function (data: any): Promise<{ keyAuthorization: string } | null> {
      // console.log('List Key Auth URL', data);

      var ch = data.challenge;
      if (!requestInterceptor) {
        return Promise.resolve(null);
      }
      // Do this so the preflight check actually checks anything
      // It may look like it uses the network, but it 100% does it all in memory for safety.
      return new Promise(function (resolve) {
        const tcpServer = createServer(server?.requestInterceptor);
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
        tcpServer.emit("connection", sock1);
        http
          .request(
            {
              // Make the http server write the request to the tcp server
              createConnection: function () {
                return sock2;
              },
              hostname: "localhost",
              port: 80,
              path: path.posix.join("/.well-known/acme-challenges/", ch.token),
              method: "GET",
            },
            function (response) {
              const data: Buffer[] = [];
              response.on("data", Array.prototype.push.bind(data));
              response.on("end", function () {
                const dataBuffer = Buffer.concat(data);
                resolve({ keyAuthorization: dataBuffer.toString() });
              });
            },
          )
          .end();
      });
    },

    remove: function (): Promise<null> {
      // console.log('Remove Key Auth URL', data);
      if (requestInterceptor !== undefined) {
        server?.removeIntercept(requestInterceptor);
        requestInterceptor = undefined;
      }
      return Promise.resolve(null);
    },
  };
}
