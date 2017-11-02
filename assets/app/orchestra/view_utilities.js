"use strict";

(function() {
  function ViewUtilities() {
    let self = this;

    self.makeServiceManagementButtons = function(service) {
      return "<div class=service_management_buttons'>" +
        "<div class='service_start'>S</div>" +
        "<div class='service_restart'>R</div>" +
        "<div class='service_console'>C</div>";
    }

    self.makeServiceManagementPanel = function(service) {
      return "<div class='service_management_panel'>" +
        "<div class='service_management_header'>" +
          "<h2 class='service_name'>" + service.name + "<\h2>" +
          self.makeServiceManagementButtons(service) +
        "</div>" +
      "</div>";
    }

    // makeProjectPanel creates a new view for a project
    self.makeProjectPanel = function(project) {
      return "<div class=\"project_panel\">" +
          "<h2>" + project.name + "</h2>" +
          "<div>" + project.id + "</div>" +
          "<h3>Services</h3>" +
          "<div>" + project.services + "</div>" +
        "</div>";
    }
  }

  // Get all the projects and populate the page
  orch.ViewUtilities = new ViewUtilities();
})()
