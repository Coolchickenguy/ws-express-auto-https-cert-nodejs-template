# ws-express-auto-https-cert-nodejs-template
A template for nodejs webservers dealing with websockets.
## Features:
Creates https certs and renews them automaticy ( May be disabled during configuration. If not enabled, uses a self signed cert THAT IS INCLUDED IN THIS REPOSITORY SO IT IS NEARLY USELESS FOR SECURITY )
## How to use
(You must have npm and nodejs installed).
run ```npm i``` to install the deps then run ```npm run build``` to build the server ( Run this whenever you make changes to the src folder. NEVER EDIT THE DIST FORLDER UNLESS YOU LOVE YOUR CHANGES BEING DELETED WHENEVER SOMEONE REBUILDS). To setup the server, run ```npm run setup``` and answer the prompts. To finaly start the server, run ```npm start```
