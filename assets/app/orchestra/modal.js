"use strict";

(function(){
  function Modal(key) {
    let self = this,
      currentForm,
      domElement = $("#" + key + "-modal"),
      domHeader = $("#" + key + "-modal-header"),
      domTitle = $("#" + key + "-modal-title"),
      domBody = $("#" + key + "-modal-body"),
      domSave = $("#" + key + "-modal-save"),
      domClose = $("#" + key + "-modal-close"),
      domShow = $("#" + key + "-modal-show"),
      // defaultCloseHtml = "<button id='main-modal-close' type='button' class='close' data-dismiss='modal' aria-label='Close'>" +
      //   "<span aria-hidden='true'>×</span>" +
      // "</button>",
      title = "Modal Title";

    domSave.click(function() {
      self.save();
    });

    self.appendBody = function(content) {
      domBody.append(content);
    }

    self.clearBody = function() {
      domBody.html("");
      // domClose.html(defaultCloseHtml);
    }

    self.close = function() {
      domClose.click();
    }

    self.form = function() {
      if (arguments.length > 0) {
        // We're setting this to a new form, so clear out
        // the old form
        self.clearBody();
        currentForm = arguments[0];

        // Make sure this is usable
        if (currentForm && currentForm.render != null)
          self.appendBody(currentForm.render());
      }

      return currentForm;
    }

    self.save = function() {
      currentForm.save(function(success) {
        if (success) {
          self.close();
        } else {
          // TODO: somehow surface this error to the user
          console.log("Saving the form failed :(");
          orch.MessageFeed.error("Could not save the form");
        }
      });

    }

    // self.setCloseHtml = function(html) {
    //   domClose.html(html);
    // }

    self.show = function() {
      domTitle.html(title);
      domShow.click();
    }

    self.title = function() {
      if (arguments.length > 0) {
        title = arguments[0];
        domTitle.html(title);
      }

      return title;
    }

    self.value = function() {
      return currentForm.value();
    }
  }

  orch.modal = orch.modal || {};
  orch.modal.Modal = Modal;
})();
