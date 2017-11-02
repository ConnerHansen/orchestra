"use strict";

(function() {
  function Mockery() {
    let self = this;

    self.Globals = {};
  }

  window.mockery = new Mockery();
})()
