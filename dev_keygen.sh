#!/bin/bash

mkdir -p ssl/

# Simple generator for creating local, self-signed certs for dev
openssl genrsa -out ssl/server.key 2048 -nodes
openssl req -new -key ssl/server.key -out ssl/server.csr -nodes -subj "/C=AB/ST=CD/L=Efghij/O=Dev/CN=localhost"
openssl x509 -req -days 365 -in ssl/server.csr -signkey ssl/server.key -out ssl/server.crt
