"use strict";

(function() {
  function MockeryDashboard(parent, service) {
    let self = this,
      ServiceStatus = orch.dashboard.ServiceStatus,
      DISABLED = orch.dashboard.DISABLED,
      COLLAPSED = orch.dashboard.COLLAPSED,
      currentConfigurations,
      div;

    // extend ServiceDashboard
    orch.dashboard.ServiceDashboard.call(self, parent, service);

    function buildConfigurations() {
      let configs = [];
      for (let i=0; i<service.configurations.length; ++i) {
        let className = (service.configurations[i].active) ? "active" : "",
          menuItem = $("<li class='" + className + "'><a href='javascript:;'>" +
            service.configurations[i].name + "</a></li>");

        menuItem.click(function() {
          let success = orch.globals.socket.write({
            data: [{
              data: [i],
              project_id: parent.project().name,
              service_id: service.id,
              type: "set_active_configuration"
            }]
          });

          if (!success) {
            orch.MessageFeed.warn("Could not update configuration");
          }
        });

        configs.push(menuItem);
      }

      return configs;
    }

    function setupConfigurationDropdown() {
      let dropdown = self.dropdown();
      if (currentConfigurations)
        for (let i=0; i<currentConfigurations.length; ++i) {
          currentConfigurations[i].remove();
        }

      currentConfigurations = buildConfigurations()
      dropdown.append(currentConfigurations);
    }

    self.dashboardClass = function(){ return "service-dashboard mockery-dashboard"};

    self.onConfigureClick = function() {
      if (!self.settingsButtons.configure.hasClass(DISABLED) && self.status() != ServiceStatus.RUNNING) {
        let modal = orch.globals.MainModal,
          currentForm;

        currentForm = new mockery.modal.MockeryModalForm(service, true, true);
        modal.title("Configure " + service.name);
        modal.form(currentForm);
        modal.show();
      }
    }

    let shadowRender = self.render;
    self.render = function() {
      if (!div) {
        div = shadowRender();
        self.dropdown().append($("<li role='separator' class='divider'></li>"));
        setupConfigurationDropdown();

        // Enable the configure button
        // self.settingsButtons.configure.removeClass("disabled");
        // self.settingsButtons.configure.click(function() {
        //   let newForm = new mockery.modal.MockeryServiceConfigModalForm(service, parent.project());
        //   orch.globals.MainModal.close();
        //   orch.globals.MainModal.clearBody();
        //   orch.globals.MainModal.appendBody(newForm.render());
        //   orch.globals.MainModal.form(newForm);
        //   orch.globals.MainModal.title("Configure " + service.name);
        //   orch.globals.MainModal.show();
        // });
      }

      return div;
    }

    /**
     * Updates the current dashboard with the newest project
     * configuration settings
     */
    self.update = function(serviceConfig) {
      service.name = serviceConfig.name;
      service.description = serviceConfig.description;
      service.delay_after = serviceConfig.delay_after;
      service.delay_before = serviceConfig.delay_before;
      service.port = serviceConfig.port;
      service.configurations = serviceConfig.configurations;
      service.rules = serviceConfig.rules;

      self.domTitle().html(service.name);
      setupConfigurationDropdown();
    }
  }

  mockery.dashboard = mockery.dashboard || {};
  mockery.dashboard.MockeryDashboard = MockeryDashboard;
})();
