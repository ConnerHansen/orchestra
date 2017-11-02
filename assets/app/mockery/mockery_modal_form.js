"use strict";
(function() {
  function defaultConfiguration() {
    return {
      name: "Default",
      active: true,
      rules: [defaultRule()]
    }
  }

  function defaultyMockery() {
    return {
      description: "",
      name: "Unnamed Mock",
      matched: {
        default: {
          match: "*",
          response: {
            type: "status_code",
            value: 200
          }
        }
      }
    }
  }

  function defaultRule() {
    return {
      regex: "*",
      body: null,
      content_type: "application/json",
      status_code: 200
    }
  }

  function MockeryModalForm(service, visible, isRoot) {
    // initialize the service if it's null
    service = service || defaultyMockery();

    let self = this,
      style = (visible == false) ? "panel-mockery collapsed" : "panel-mockery",
      title = (service.name != null && service.name != "Unnamed Mock") ? service.name : "New Mock Service",
      // mocksPanel = $("<div class='mocks-panel'/>"),
      // mocksLabel = $("<div class='form-group'><label>Defined Configurations</label></div>"),
      // addMockeryServiceConfig = $("<div class='btn add-mockery-btn'>" +
      //     "<div class='add-service-text'>Add New Mock Configuration</div>" +
      //     "<span class='glyphicon glyphicon-plus' aria-hidden='true'></span>" +
      //   "</div>"),
      addMockeryServiceConfig = new orch.ui.Button("Add New Mock Configuration", null, "modal-btn-right add-mockery-btn"),
      nameField = new orch.ui.TextField("name", "Name", service.name),
      descField = new orch.ui.TextField("description", "Description", service.description),
      portField = new orch.ui.TextField("port", "Port", service.port),
      configHolder = $("<div />"),
      configPanels = [];

    function init() {
      if (service.configurations != null)
        for (let i=0; i<service.configurations.length; ++i) {
          configPanels.push(new mockery.modal.MockeryConfigurationForm(service, service.configurations[i]));
          configHolder.append(configPanels[i].render());
        }

      // extend ModalForm
      orch.modal.ModalForm.call(self, style, title, isRoot);

      addMockeryServiceConfig.click(function() {
        let inactiveConfig = defaultConfiguration();
        inactiveConfig.active = false;

        let newPanel = new mockery.modal.MockeryConfigurationForm(service, inactiveConfig);
        newPanel.render().css("display", "none");

        configPanels.push(newPanel);
        configHolder.append(newPanel.render());

        newPanel.render().slideDown();
      })

      self.addFields([
        nameField,
        descField,
        portField
      ]);

      self.append([
        // mocksLabel,
        configHolder,
        addMockeryServiceConfig.render()
      ]);

      nameField.errorMessage("The name you entered isn't valid");
      portField.errorMessage("The port you entered is not a valid integer");

      // Setup the close event
      self.close(function() {
        let div = self.render();
        div.css("height", div.outerHeight() + "px");
        div.removeClass("flexible");

        self.enabled(false);
        // TODO :(
        setTimeout(function() {
          div.addClass("collapsed");
        }, 50);
      });
    }
    init();

    /**
     * save performs the save and collapse functionality
     * @param  {Function} callback the function to call when the request is completed
     */
    function save(callback) {
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
     * validate validates the current form. Because this form is more than just
     * primitive fields, we have to override the base behavior
     */
    function validate() {
      if (!self.enabled())
        return true;

      let isValid = true;

      if (nameField.value().trim().length == 0) {
        isValid = false;
        nameField.error(true);
      } else {
        nameField.error(false);
      }

      if (portField.value().length == 0 || isNaN(parseInt(portField.value()))) {
        isValid = false;
        portField.error(true);
      } else {
        portField.error(false);
      }

      for (let i in configPanels) {
        if (configPanels[i].enabled())
          isValid = isValid && configPanels[i].validate();
      }

      if (isRoot && !isValid)
        orch.MessageFeed.error("The form contains errors that must be fixed before saving", 5000);

      return isValid;
    }

    /**
     * value retrieves the current JSON object of values for the form in a format
     * that the backend can understand
     * @return {[type]} [description]
     */
    function value() {
      let data = {};

      data.name = nameField.value();
      data.id = service.id;
      data.description = descField.value();
      data.port = portField.value();
      data.type = "mockery_service_configuration";
      data.configurations = [];
      for (let i=0; i<configPanels.length; ++i) {
        if (configPanels[i].enabled())
          data.configurations.push(configPanels[i].value());
      }

      return data;
    }

    self.save = save;
    self.validate = validate;
    self.value = value;
  }

  mockery.modal = mockery.modal || {};
  mockery.modal.MockeryModalForm = MockeryModalForm;
})();
