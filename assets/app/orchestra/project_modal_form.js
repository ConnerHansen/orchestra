"use strict";
(function() {
  orch.modal = orch.modal || {};

  function defaultService() {
    return {
      branch: "",
      commands: [],
      delay_after: 0,
      delay_before: 0,
      description: "",
      name: "Unnamed Service",
      working_dir: ""
    }
  }

  function defaultProject() {
    return {
      name: null,
      description: null,
      services: []
    }
  }

  // TODO: this does not extend ModalForm -- in order to make this consistent
  // we should really reuse that
  function ProjectModalForm(project) {
    project = project || defaultProject();

    let self = this,
      div = $("<div class='container-fluid modal-project' />"),
      addPanel = $("<div class='add-panel'/>"),
      addDropdown = new orch.ui.DropdownMenu("Add New Service"),
      nameField = new orch.ui.TextField("name", "Name", project.name),
      descField = new orch.ui.TextField("description", "Description", project.description),
      toggled = false,
      toggleCollapseButton = new orch.ui.Button("Collapse All", toggleCollapse),
      serviceForms = [];

    div.append(nameField.render());
    div.append(descField.render());
    div.append(toggleCollapseButton.render());
    toggleCollapseButton.render().addClass("form-group modal-btn-right");

    for (let i=0; i<project.services.length; ++i) {
      let serviceBlock;

      if (project.services[i].type == "runnable_service_configuration")
        serviceBlock = new orch.modal.ServiceModalForm(project.services[i]);
      else if(project.services[i].type == "mockery_service_configuration")
        serviceBlock = new mockery.modal.MockeryModalForm(project.services[i]);
      else
        console.error("Could not understand the service: " + json.stringify(project.services[i]));

      serviceForms.push(serviceBlock);
      div.append(serviceBlock.render());

      // TODO: add CSS animation callback
      setTimeout(function() {
        serviceBlock.render().css("height", serviceBlock.render().outerHeight() + "px");
        serviceBlock.render().addClass("flexible");
      }, 500);
    }
    setupAddDropdownMenu();

    addPanel.append(addDropdown.render());
    div.append(addPanel);

    /**
     * setupAddDropdownMenu sets up the add* dropdown menu for this form
     */
    function setupAddDropdownMenu() {
      addDropdown.render().addClass("add-service-modal-btn");
      addDropdown.verticalButtonHtml("<span class='glyphicon glyphicon-plus' aria-hidden='true'></span>");

      addDropdown.addEntry("Shell Executable Service", function() {
        let serviceBlock = new orch.modal.ServiceModalForm(defaultService(), false);
        serviceForms.push(serviceBlock);
        div.append(serviceBlock.render());
        serviceBlock.render().css("height", serviceBlock.getHeight() + "px");
        serviceBlock.render().removeClass("collapsed");

        // TODO: add CSS animation callback
        setTimeout(function() {
          serviceBlock.render().addClass("flexible");
        }, 500);
      });

      addDropdown.addEntry("Mock Server", function() {
        let serviceBlock = new mockery.modal.MockeryModalForm(null, false);
        serviceForms.push(serviceBlock);
        div.append(serviceBlock.render());
        serviceBlock.render().css("height", serviceBlock.getHeight() + "px");
        serviceBlock.render().removeClass("collapsed");

        // TODO :(
        setTimeout(function() {
          serviceBlock.render().addClass("flexible");
        }, 500);
      });
    }

    /**
     * toggleCollapse toggles the collapsed state for all of the
     * currently rendered services
     */
    function toggleCollapse() {
      for (let i in serviceForms) {
        if (toggled)
          serviceForms[i].expand();
        else
          serviceForms[i].minimize();
      }

      if (toggled)
        toggleCollapseButton.text("Collapse All");
      else
        toggleCollapseButton.text("Expand All");

      toggled = !toggled;
    }

    self.render = function() {
      return div;
    }

    /**
     * save performs the save and collapse functionality
     * @param  {Function} callback the function to call when the request is completed
     */
    self.save = function(callback) {
      // Save if it's a valid form
      if (self.validate()) {
        let host = orch.utilities.getHost();
        // Send an ajax call, probably should do this over the websocket instead
        $.ajax({
          url: host + "/api/v1/project/" + encodeURI(project.id || nameField.value()),
          data: JSON.stringify(self.value()),
          type: 'POST',
          contentType: 'application/json; charset=UTF-8',
          dataType: 'json',
          success: function() {
            orch.MessageFeed.success(
              "Successfully saved project <strong>" + nameField.value() + "</strong>");
            callback(true);
          },
          error: function(msg) {
            console.error(msg);
            callback(false);
          }
        });
      }
    }

    /**
     * validate performs the validation check for this form
     */
    self.validate = function() {
      let isValid = true;

      if (nameField.value().trim().length == 0) {
        isValid = false;
        nameField.error(true, "That name you entered isn't valid :(");
      } else {
        nameField.error(false);
      }

      for (let i in serviceForms) {
        let currForm = serviceForms[i];
        isValid = currForm.validate() && isValid;
      }

      if (!isValid) {
        orch.MessageFeed.error("The form contains errors that must be fixed before saving", 5000);
      }

      return isValid;
    }

    self.value = function() {
      let data = [];

      // Now gather all the data for individual services
      for (let i in serviceForms) {
        let currForm = serviceForms[i];
        if (currForm.enabled())
          data.push(currForm.value());
      }

      return {
        name: nameField.value(),
        id: project.id,
        description: descField.value(),
        services: data
      };
    }
  }

  orch.modal.ProjectModalForm = ProjectModalForm;
})();
