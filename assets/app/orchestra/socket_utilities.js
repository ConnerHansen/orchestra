"use strict";

(function() {
  /**
   * Socket the class for managing socket connections and communicating
   * with the server
   * @constructor
   */
  function Socket() {
    let self = this,
      connection,
      currentToken,
      onMessage,
      onOpen;

    // beforeWrite is the function that's triggered just before writing
    // out a payload to the socket
    self.beforeWrite = function(payload) {
      // This is a hash, so tack on the token to the metadata
      if (!payload.meta)
        payload.meta = {};

      // If we don't have a user or a token on that user, this should
      // explode
      payload.meta.token = orch.globals.user.token;
    }

    /**
     * Getter/setter for the connection property
     */
    self.connection = function() {
      if (arguments.length == 0) {
        return connection;
      } else {
        connection = arguments[0];
        return connection;
      }
    }

    /**
     * Getter/setter for the onMessage function
     */
    self.onMessage = function() {
      if (arguments.length == 0) {
        onMessage();
      } else {
        onMessage = arguments[0];
      }
    }

    self.onOpen = function() {
      if (arguments.length == 0) {
        onOpen();
      } else {
        onOpen = arguments[0];
      }
    }

    /**
     * Opens a new connection back to the server
     */
    self.open = function() {
      let protocol = "ws://";

      // Make sure if we're https, then we stick to it even over
      // the websocket connection
      if (document.location.protocol == "https:")
        protocol = "wss://";

      connection = new WebSocket(protocol + document.location.host +
        "/ws?username=" + orch.globals.user.username + "&token=" + orch.globals.user.token);


      connection.onclose = function (evt) {
        orch.MessageFeed.warn("Lost websocket connection");

        let interval = setInterval(function() {
          if (connection.readyState == WebSocket.CLOSED ||
            connection.readyState == WebSocket.CLOSING)
            self.open();
          else
            clearInterval(interval);
        }, 5000);
      };

      connection.onopen = function(evt) {
        orch.MessageFeed.success("Websocket connection established!");
        onOpen();
      }

      connection.onmessage = function (evt) {
        let data = JSON.parse(evt.data);
        if (data && data.meta && data.meta.token)
          orch.globals.user.token = data.meta.token;

        onMessage(evt);
      };

      return connection;
    }

    /**
     * write writes the given message out to the socket. If the message is
     * a string, then it will be passed through untouched
     */
    self.write = function(msg) {
      let success = false;
      if (connection == null) {
        console.error("connection is null");
      } else {
        if (connection.readyState != WebSocket.CLOSED &&
          connection.readyState != WebSocket.CLOSING) {
          // If it's already a string, just send it, if it's not, make it
          // a string then send it
          if (typeof(msg) == "string")
            connection.send(msg);
          else {
            self.beforeWrite(msg);
            connection.send(JSON.stringify(msg));
          }

          success = true;
        }
      }

      return success;
    }
  }

  function SocketUtilities() {
    let self = this;

    function createSocket() {
      let sock = new Socket();

      return sock;
    }
  }

  orch.Socket = Socket;
  orch.SocketUtilities = SocketUtilities;
})()
