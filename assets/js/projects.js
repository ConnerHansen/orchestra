"use strict";

(function() {
  // Get all the projects and populate the page
  orch.ProjectManager.getAll(function(data) {
    // $("#projects").html("<pre>" + data + "</pre>");
    let keys = Object.keys(data);
    let panels = ""

    for (let i=0; i<keys.length; ++i) {
      panels += orch.ViewUtilities.makeProjectPanel(jsonData[keys[i]]);
    }

    $("#projects").html(panels);
  });
})()
