"use strict";
(function() {
  function MessageFeed() {
    let self = this,
      div = $("#message_feed");

    function remove(elem) {
      // elem.slideUp(200, function() {
      //   elem.remove();
      // });
      elem.addClass("collapsed");
      setTimeout(function() {
        elem.remove();
      }, 500);
    }

    function renderAlert(msg, className, dismissTime) {
      let elem = $("<div class='alert alert-dismissable " + className + "' role='alert'>" +
          "<button type='button' class='close' aria-label='Close'>" +
            "<span aria-hidden='true'>&times;</span>" +
          "</button>" +
          msg +
        "</div>");
      elem.alert();

      // Click anywhere on the alert to remove it
      // FIXME: what if someone wants to select the message contents?
      elem.click(function(){
        remove(elem);
      });

      // If we have a timeout on this function, then
      // we should respect that and set it up
      if (dismissTime > 0) {
        setTimeout(function() {
          remove(elem);
        }, dismissTime);
      }

      return elem;
    }

    self.error = function(msg, timeout) {
      let alert = renderAlert(msg, "alert-danger", timeout || 0);
      div.append(alert);
    }

    self.info = function(msg, timeout) {
      let alert = renderAlert(msg, "alert-info", timeout || 5000);
      div.append(alert);
    }

    self.success = function(msg, timeout) {
      let alert = renderAlert(msg, "alert-success", timeout || 5000);
      div.append(alert);
    }

    self.warn = function(msg, timeout) {
      let alert = renderAlert(msg, "alert-warning", timeout || 5000);
      div.append(alert);
    }
  }

  orch.MessageFeed = new MessageFeed();
})();
