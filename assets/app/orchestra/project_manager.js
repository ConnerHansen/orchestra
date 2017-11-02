"use strict";

(function() {
  function ProjectManager() {
    let self = this;

    self.getAll = function(callback) {
      jQuery.get("api/v1/projects", function(data) {
        callback(JSON.parse(data));
      });
    };
  }

  window.orch.ProjectManager = new ProjectManager();
})()
