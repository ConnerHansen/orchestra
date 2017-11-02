"use strict";

(function() {
  let ServiceStatus = {
      DEAD: "dead",
      FAILED: "failed",
      INDETERMINATE: "indeterminate",
      RUNNING: "running",
      STOPPED: "stopped"
    },
    COLLAPSED = "collapsed",
    DISABLED = "disabled";

  /**
   * The project dashboard constructor
   * @param       {Project} project the current project that this dashboard is for
   * @constructor
   */
  function ProjectDashboard(project) {
    project.services = project.services || [];

    let self = this,
      collapsed = false,
      domButtons = {},
      domContents,
      domElement,
      domHeader,
      domMinimized,
      domPanelBody,
      domTitle,
      minimizedCollapsed = true,
      services = {},
      settingsButtons = {},
      status = ServiceStatus.STOPPED,
      socket;

    function buildButton(clss, icon, title) {
      let btn = $("<div class='btn " + clss + "' data-toggle='tooltip' data-placement='bottom' title='" +
        title + "'><span class='glyphicon " +
        icon + "' aria-hidden='true'></span></div>");
      btn.tooltip();

      return btn;
    }

    function buildButtons() {
      let play = buildButton("btn-play", "glyphicon-play", "Start " + project.name),
        stop = buildButton("btn-stop", "glyphicon-stop", "Stop " + project.name),
        settings = buildSettings(),
        container = $("<div class='btn-container'/>");

      domButtons.play = play;
      domButtons.settings = settings;
      domButtons.stop = stop;

      play.click(function() {
        if (play.attr(DISABLED) == null) {
          play.attr(DISABLED, DISABLED);

          socket.write({
            data: [{
              project_id: project.id,
              type: "start"
            }]
          });
        }
      });

      stop.click(function() {
        if (stop.attr(DISABLED) == null) {
          stop.attr(DISABLED, DISABLED);

          socket.write({
            data: [{
              project_id: project.id,
              type: "stop"
            }]
          });
        }
      });

      container.append([play, stop, settings]);
      return container;
    }

    /**
     * buildSettings constructs the settings menu for the dashboard
     */
    function buildSettings() {
      let settings = $("<div class='btn-group'>" +
          "<div class='btn dropdown-toggle' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>" +
            "<span class='glyphicon glyphicon-option-vertical' aria-hidden='true'></span>" +
          "</div>" +
          "<ul class='dropdown-menu'>" +
          "</ul>" +
        "</div>"),
        dropdown = settings.children(".dropdown-menu"),
        configure = $("<li><a href='javascript:;'>Configure Project</a></li>"),
        clear = $("<li><a href='javascript:;'>Clear All Logs</a></li>"),
        toggleVisibility = $("<li><a href='javascript:;'>Collapse Dashboard</a></li>"),
        remove = $("<li><a href='javascript:;'>Remove Project</a></li>"),
        visible = true;
      dropdown.append([configure, clear, toggleVisibility, remove]);

      // Now setup the button actions
      configure.click(function() {
        if (!configure.hasClass(DISABLED)) {
          let modal = orch.globals.MainModal,
            currentForm;

          // modal.setCloseHtml("<div class='btn btn-danger remove-proj-btn'>" +
          //     "<div class='add-service-text'>Remove Project</div>" +
          //     "<span class='glyphicon glyphicon-remove' aria-hidden='true'></span>" +
          //   "</div>");
          currentForm = new orch.modal.ProjectModalForm(project);
          modal.title("Configure " + project.name);
          modal.form(currentForm);
          modal.show();
        }
      });

      clear.click(function() {
        if (!clear.hasClass(DISABLED)) {
          let keys = Object.keys(services);

          // Clear 'em all
          for (let i=0; i<keys.length; ++i) {
            services[keys[i]].clear();
          }
        }
      });

      toggleVisibility.click(function() {
        if (visible) {
          visible = false;
          // Swap out the label
          toggleVisibility.children("a").html("Expand Dashboard");
          domElement.addClass("minimized");
        } else {
          visible = true;
          // Swap out the label
          toggleVisibility.children("a").html("Collapse Dashboard");
          domElement.removeClass("minimized");
        }
      });
      domHeader.dblclick(function() {
        toggleVisibility.click();
      })

      remove.click(function() {
        if (!remove.hasClass(DISABLED)) {
          let modal = orch.globals.MainModal,
            currentForm = new orch.modal.ProjectRemoveModal(project);

          modal.form(currentForm);
          modal.title("Remove " + project.name);
          modal.show();
        }
      });

      settingsButtons.configure = configure;
      settingsButtons.clear = clear;

      return settings;
    }

    /**
     * refreshButtons forces the dashboard to reevaluate
     */
    function refreshButtons() {
      let runningServices = running()
      if (runningServices > 0) {
        domButtons.stop.attr(DISABLED, null);
        if (!settingsButtons.configure.hasClass(DISABLED))
          settingsButtons.configure.addClass(DISABLED);

        // If everything is running, disable the running button
        if (runningServices == Object.keys(services).length) {
          domButtons.play.attr(DISABLED, DISABLED);
          domElement.removeClass(status);
          status = ServiceStatus.RUNNING;
          domElement.addClass(status);
        } else {
          domButtons.play.attr(DISABLED, null);
          domElement.removeClass(status);
          status = ServiceStatus.INDETERMINATE;
          domElement.addClass(status);
        }
      } else {
        domElement.removeClass(status);
        settingsButtons.configure.removeClass(DISABLED);
        status = ServiceStatus.STOPPED;
        domElement.addClass(status);
        domButtons.play.attr(DISABLED, null);
        domButtons.stop.attr(DISABLED, DISABLED);
      }
    }

    function running() {
      let count = 0,
        keys = Object.keys(services);
      for (let i=0; i<keys.length; ++i) {
        if (services[keys[i]].status() == ServiceStatus.RUNNING) {
          count++;
        } else {
          console.log("Service " + services[keys[i]].name + " status was " + services[keys[i]].status());
        }
      }

      return count;
    }

    /**
     * addService adds a new service to the current project dashboard
     */
    self.addService = function(service) {
      let serviceDash;

      if (service.type == "runnable_service_configuration")
        serviceDash = new orch.dashboard.ServiceDashboard(self, service);
      else if (service.type == "mockery_service_configuration")
        serviceDash = new mockery.dashboard.MockeryDashboard(self, service);

      if (services[service.id]) {
        console.error("Service dashboard with id " + service.id + " already exists!");
      } else {
        services[service.id] = serviceDash;
        domContents.append(serviceDash.render());
        domMinimized.append(serviceDash.renderMinimized());

        // Now set the status so the buttons are configured correctly
        serviceDash.status(ServiceStatus.STOPPED);
      }
    }

    self.checkForMinimized = function() {
      let keys = Object.keys(services),
        visible = self.visibleServices(),
        shouldShowMinimized = visible.length != keys.length,
        shouldShowNormal = visible.length > 0;

      if (minimizedCollapsed && shouldShowMinimized) {
        minimizedCollapsed = false;
        domMinimized.removeClass("minimized");
      } else if (!minimizedCollapsed && !shouldShowMinimized) {
        minimizedCollapsed = true;
        domMinimized.addClass("minimized");
      }

      if (shouldShowNormal)
        domContents.removeClass("minimized");
      else
        domContents.addClass("minimized");

      for (let i in visible) {
        let currVisibleService = visible[i];

        if (i == visible.length-1)
          currVisibleService.render().addClass("last-open");
        else
          currVisibleService.render().removeClass("last-open");
      }
    }

    self.collapse = function() {
      collapsed = true;
      domElement.addClass("collapsed");
    }

    self.domElement = function() {
      return domElement;
    }

    self.domMinimized = function() {
      return domMinimized;
    }

    self.expand = function() {
      collapsed = false;
      domElement.removeClass("collapsed");
    }

    self.isCollapsed = function() {
      return collapsed;
    }

    /**
     * Returns the p¡roject for the current dashboard
     */
    self.project = function() {
      return project;
    }

    /**
     * Refreshes the current button states based on the status
     * of the current services
     */
    self.refreshButtons = refreshButtons;

    /**
     * Renders the dashboard element
     */
    self.render = function() {
      if (domElement == null) {
        domElement = $("<div class='project-dashboard stopped'/>");
        domPanelBody = $("<div class='project-dashboard-body' />");
        domHeader = $("<div class='project-dashboard-header header'/>");
        domMinimized = $("<div class='minimized-content minimized'/>");
        domContents = $("<div class='project-dashboard-content'/>");
        domTitle = $(`<h2>${project.name}</h2>`);

        domHeader.append([domTitle, buildButtons()]);
        for(let i=0; i<project.services.length; ++i) {
          let service = project.services[i];
          self.addService(service);
        }

        // FIXME: clearing the selection here doesn't seem to work. Are service
        // dashboards allowing events to propagate?
        // domContents.click(function() {
        //   if (orch.globals.selectedService) {
        //     orch.globals.selectedService.domElement().removeClass("selected");
        //     orch.globals.selectedService = null;
        //   }
        // });

        domPanelBody.append([domMinimized, domContents]);
        domElement.append([domHeader, domPanelBody]);
      }

      return domElement;
    }

    self.remove = function() {
      self.collapse();

      setTimeout(function() {
        domElement.remove();
      }, 500);
    }

    /**
     * Returns the current running status of this dashboard
     */
    self.running = running;

    /**
     * Returns the services that apply to this dashboard
     */
    self.services = function() {
      return services;
    }

    /**
     * Gets or sets the socket for the dashboard
     */
    self.socket = function() {
      if (arguments.length != 0)
        socket = arguments[0];

      return socket;
    }

    /**
     * Updates the current dashboard with the newest project
     * configuration settings
     */
    self.update = function(projConfig) {
      // Keep track of which services we've seen
      let skippedServices = Object.keys(services);

      if (projConfig.project.name != null) {
        project.name = projConfig.project.name;
        domTitle.html(project.name);
      }
      projConfig.project.services = projConfig.project.services || [];

      project.description = projConfig.project.description;
      for (let i=0; i<projConfig.project.services.length; ++i) {
        let updatedService = projConfig.project.services[i];

        if (services[updatedService.id]) {
          services[updatedService.id].update(updatedService);
          skippedServices.splice(skippedServices.indexOf(updatedService.id), 1);
        } else {
          // Unknown service, means we got a new one!
          self.addService(updatedService);
          project.services.push(updatedService);
        }
      }

      // Clean up any services that weren't seen -- this means that
      // they were removed
      for (let i=0; i<skippedServices.length; ++i) {
        services[skippedServices[i]].destroy();
        delete services[skippedServices[i]];

        for(let j=0; j<project.services.length; ++j) {
          if (project.services[j].id == skippedServices[i]) {
            project.services.splice(j, 1);
            break;
          }
        }
      }
    }

    /**
     * visibleServices returns the current set of displayable services
     */
    self.visibleServices = function() {
      let keys = Object.keys(services),
        visible = [];

      for (let i=0; i<keys.length; ++i) {
        if (!services[keys[i]].isCollapsed())
          visible.push(services[keys[i]]);
      }

      return visible;
    }
  }

  orch.dashboard = orch.dashboard || {};
  orch.dashboard.ProjectDashboard = ProjectDashboard;
  orch.dashboard.ServiceStatus = ServiceStatus;
})()
