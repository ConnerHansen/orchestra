"use strict";

(function() {
  // Make a new socket, and (for now) force a fake login
  let sock = new orch.Socket(),
    socketOpened = false;

  orch.globals.user = {
    "display_name": "Test",
    "username": "test@example.com",
    "password": "test"
  };

  function init() {
    if (orch.globals.user) {
      $("#user-email").text(orch.globals.user.display_name || orch.globals.user.username);
    }

    let host = orch.utilities.getHost();
    // Send an ajax call, probably should do this over the websocket instead
    $.ajax({
      url: host + "/login",
      data: JSON.stringify(orch.globals.user),
      type: 'POST',
      contentType: 'application/json; charset=UTF-8',
      dataType: 'json',
      success: function(data) {
        if (data && data.meta && data.meta.token) {
          // We got a token, so store it and continue with
          // the normal load process
          orch.globals.user.token = data.meta.token;

          orch.MessageFeed.success(
            "Successfully logged in. Welcome <strong>" + orch.globals.user.username + "</strong>");
          openSocket();
        }
      },
      error: function(msg) {
        console.error(msg);
      }
    });
  }
  init();

  // openSocket opens the socket connection and prepares the current
  // dashboard for use
  function openSocket() {
    sock.onMessage(function(socketMessage) {
      orch.processMessage(socketMessage);
    });

    sock.onOpen(function() {
      if (!socketOpened) {
        socketOpened = true
        orch.globals.socket.write({
          data: [{
            type: "list_projects"
          }]
        });
      }
    });

    // Let everyone use it
    orch.globals.socket = sock;

    // Now that we're all setup, actually open the socket
    sock.open();
  }

  orch.globals.MainModal = new orch.modal.Modal("main");
})()
