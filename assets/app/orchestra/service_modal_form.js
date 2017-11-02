"use strict";
(function() {
  function ServiceModalForm(service, visible, isRoot) {
    let self = this,
      title = (service.name != null && service.name != "Unnamed Service") ? service.name : "New Service",
      defaultClasses = (isRoot) ? "" : "service-dashboard stopped",
      style = (visible == false) ? `${defaultClasses} collapsed` : defaultClasses,
      nameField = new orch.ui.TextField("name", "Name", service.name),
      descField = new orch.ui.TextField("description", "Description", service.description),
      branchField = new orch.ui.TextField("branch", "Branch", service.branch),
      delayAfterField = new orch.ui.TextField("delay_after", "Delay After", "" + service.delay_after),
      delayBeforeField = new orch.ui.TextField("delay_before", "Delay Before", "" + service.delay_before),
      workingField = new orch.ui.TextField("working_dir", "Working Dir", service.working_dir),
      commandsField = new orch.ui.CodeField("commands", "Commands", service.commands.join("\n"));

    // extend ModalForm
    orch.modal.ModalForm.call(self, style, title, isRoot);

    // Add the fields to the current form
    self.addFields(
      nameField,
      descField,
      workingField,
      branchField,
      delayAfterField,
      delayBeforeField,
      commandsField
    );

    // Setup validators and error messages
    nameField.errorMessage("The name you entered isn't valid");
    nameField.validate = function() {
      return nameField.value().trim().length > 0;
    }

    delayAfterField.errorMessage("Enter a valid integer");
    delayAfterField.validate = function() {
      return delayAfterField.value().length != 0 && !isNaN(parseInt(delayAfterField.value()));
    }

    delayBeforeField.errorMessage("Enter a valid integer");
    delayBeforeField.validate = function() {
      return delayBeforeField.value().length != 0 && !isNaN(parseInt(delayBeforeField.value()));
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
          url: host + "/api/v1/service/" + encodeURI(service.id || nameField.value()),
          data: JSON.stringify(self.value()),
          type: 'POST',
          contentType: 'application/json; charset=UTF-8',
          dataType: 'json',
          success: function() {
            orch.MessageFeed.success(
              "Successfully saved service <strong>" + nameField.value() + "</strong>");
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
     * value gets the current hash of values for this modal form
     */
    self.value = function() {
      let data = {};

      data.name = nameField.value();
      data.id = service.id;
      data.description = descField.value();
      data.branch = branchField.value();
      data.delay_after = parseInt(delayAfterField.value()) || 0;
      data.delay_before = parseInt(delayBeforeField.value()) || 0;
      data.working_dir = workingField.value();
      data.type = "runnable_service_configuration";
      data.commands = commandsField.value();

      return data;
    }
  }

  orch.modal = orch.modal || {};
  orch.modal.ServiceModalForm = ServiceModalForm;
})();
