"use strict";

(function() {

  function Button(text, callback, classes) {
    let self = this,
      domElement = $(`<div class='btn-group modal-btn ${classes}'>` +
        "<div class='btn dropdown-toggle'></div>" +
      "</div>"),
      btn = domElement.find(".btn");

    btn.click(function(){
      if (callback)
        callback();
    });

    setText(text);

    function click(cb) {
      if (arguments.length > 0) {
        callback = cb;
      } else {
        btn.click();
      }
    }

    function setText(newText) {
      if (arguments.length == 1) {
        text = newText;
        btn.html(text);
      }
      return text;
    }

    self.render = function() {
      return domElement;
    }

    self.click = click;
    self.text = setText;
  }

  orch.ui = orch.ui || {};
  orch.ui.Button = Button;
})();
