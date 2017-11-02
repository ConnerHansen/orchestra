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
     * The constructor for the service dashboards
     * @param       {service} service the service object to use
     * @constructor
     */
    function ServiceDashboard(parent, service) {
      let self = this,
        flexAmount = 1,
        lineCount = 0,
        domButtons = {},
        domContents,
        domElement,
        domHeader,
        domMinimized,
        domTitle,
        dropdown,
        isScrolling = false,
        status = ServiceStatus.STOPPED,
        tailing = true;

      self.settingsButtons = {};

      function buildButton(clss, icon, title) {
        let btn = $("<div class='btn " + clss + "' data-toggle='tooltip' data-placement='bottom' title='" +
          title + "'><span class='glyphicon " +
          icon + "' aria-hidden='true'></span></div>");
        btn.tooltip();

        return btn;
      }

      function buildButtons() {
        let play = buildButton("btn-play", "glyphicon-play", "Start " + service.name),
          stop = buildButton("btn-stop", "glyphicon-stop", "Stop " + service.name),
          settings = buildSettings(),
          expand = buildButton("btn-expand", "glyphicon-resize-full", "Expand Dashboard"),
          contract = buildButton("btn-contract", "glyphicon-resize-small", "Shrink Dashboard"),
          container = $("<div class='btn-container'/>");

        domButtons.contract = contract;
        domButtons.expand = expand;
        domButtons.play = play;
        domButtons.settings = settings;
        domButtons.stop = stop;

        play.click(function() {
          if (play.attr(DISABLED) == null) {
            play.attr(DISABLED, DISABLED);

            parent.socket().write({
              data: [{
                project_id: parent.project().id,
                service_id: service.id,
                type: "start"
              }]
            });
          }
        });

        stop.click(function() {
          if (stop.attr(DISABLED) == null) {
            stop.attr(DISABLED, DISABLED);

            parent.socket().write({
              data: [{
                project_id: parent.project().id,
                service_id: service.id,
                type: "stop"
              }]
            });
          }
        });

        expand.click(function(evt) {
          if (flexAmount < 4) {
            flexAmount++;

            // Were we zero before? We need to increment the counter at
            // the start so that when the parent checks the flexAmount
            // will be at the right count
            if (flexAmount <= 1) {
              domElement.removeClass(COLLAPSED);
              domMinimized.addClass(COLLAPSED);
              parent.checkForMinimized();
            }

            domElement.css("flex-grow", flexAmount);
          }
        });

        contract.click(function(evt) {
          if (flexAmount > 1) {
            flexAmount--;
            domElement.css("flex-grow", flexAmount);
          } else if (flexAmount == 1) {
            flexAmount--;
            domMinimized.removeClass(COLLAPSED);
            domElement.addClass(COLLAPSED);
            domElement.css("flex-grow", "inherit");
            parent.checkForMinimized();
          }
        });

        container.append([play, stop, settings, expand, contract]);

        return container;
      }

      function buildSettings() {
        let settings = $("<div class='btn-group'>" +
            "<div class='btn dropdown-toggle' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>" +
              "<span class='glyphicon glyphicon-option-vertical' aria-hidden='true'></span>" +
            "</div>" +
            "<ul class='dropdown-menu'>" +
            "</ul>" +
          "</div>"),
          configure = $("<li><a href='javascript:;'>Configure Service</a></li>"),
          changeBranch = $("<li class='disabled'><a href='javascript:;'>Change Branch</a></li>"),
          clear = $("<li><a href='javascript:;'>Clear Log</a></li>");

        dropdown = settings.children(".dropdown-menu");
        dropdown.append([configure, changeBranch, clear]);
        self.settingsButtons.configure = configure;
        self.settingsButtons.changeBranch = changeBranch;
        self.settingsButtons.clear = clear;

        // Now setup the button actions
        configure.click(self.onConfigureClick);

        clear.click(function() {
          if (!clear.hasClass(DISABLED)) {
            self.clear();
          }
        });

        return settings;
      }

      function scrollToBottom() {
        if (tailing && !isScrolling) {
          isScrolling = true;

          domContents.animate({scrollTop: domContents[0].scrollHeight}, 800, function() {
            // Remove extraneous lines...
            // child = div.children(".logger-content").first();
            //
            // // This jiggles the screen, so... turn off the scrubbing
            // // until they start tailing again
            // let children = child.children(),
            //   curr = 0;
            //
            // while (lines > maxLines) {
            //   if (children.length > curr && children[curr]) {
            //     let currChild = children[curr],
            //       lineId = $(currChild).prop("lineId");
            //
            //     currChild.remove();
            //     delete children[curr];
            //     delete lineValues[lineId];
            //   }
            //
            //   curr++;
            //   lines--;
            // }
            //
            isScrolling = false;

            // Ensure we're at the bottom here, we have to
            // re-get the element because its scrollHeight
            // has likely changed again
            domContents.scrollTop(domContents[0].scrollHeight);
          });
        }
      }

      /**
       * Appends a new line to the service dashboard
       * @param {string} msg the message to log to the dashboard
       */
      self.appendLine = function(msg) {
        let segments = msg.split("\n")

        // Was this the first line?``
        if (lineCount == 0) {
          domContents.removeClass("empty");
        }

        for (let i=0; i<segments.length; ++i) {
          let currLine = segments[i],
            entries = currLine.split("•");

          for (let j=0; j<entries.length; ++j) {
            if (entries.length > 1 && j < entries.length-1)
              entries[j] = entries[j] + "•";

            let line = new orch.dashboard.LogLine(entries[j]);
            // TODO: make this a single append rather than n appends
            domContents.append(line.render());
            ++lineCount;
          }
        }

        if (domElement.hasClass("highlighted")) {
          domElement.removeClass("highlighted");
          domMinimized.removeClass("highlighted");
          domElement.addClass("highlighted-alt");
          domMinimized.addClass("highlighted-alt");
        } else {
          domElement.removeClass("highlighted-alt");
          domMinimized.removeClass("highlighted-alt");
          domElement.addClass("highlighted");
          domMinimized.addClass("highlighted");
        }

        scrollToBottom();
      }

      /**
       * Clears out the current service dashboard, returning it
       * to its initial empty state
       */
      self.clear = function() {
        lineCount = 0;
        domContents.html("");

        if (!domContents.hasClass("empty"))
          domContents.addClass("empty");
      }

      self.dashboardClass = function() {
        return "service-dashboard";
      }

      /**
       * destroy will destroy the current dashboard and remove it from view
       */
      self.destroy = function() {
        domElement.addClass(COLLAPSED);
        domMinimized.addClass(COLLAPSED);
        domElement.css("flex-grow", "inherit");

        // Yeah yeah should be event driven instead of using a
        // fixed timeout amount. Sounds like a you problem.
        setTimeout(function() {
          domElement.remove();
          domMinimized.remove();

          domElement = null;
          domMinimized = null;
        }, 1000);
      }

      self.domContents = function() {
        return domContents;
      }

      self.domElement = function() {
        return domElement;
      }

      self.domHeader = function() {
        return domHeader;
      }

      self.domTitle = function() {
        return domTitle;
      }

      self.dropdown = function() {
        return dropdown;
      }

      self.isCollapsed = function() {
        return flexAmount <= 0;
      }

      self.onConfigureClick = function() {
        if (!self.settingsButtons.configure.hasClass(DISABLED) && self.status() != ServiceStatus.RUNNING) {
          let modal = orch.globals.MainModal,
            currentForm;

          currentForm = new orch.modal.ServiceModalForm(service, true, true);
          modal.title("Configure " + service.name);
          modal.form(currentForm);
          modal.show();
        }
      }

      /**
       * Renders the current dashboard element
       */
      self.render = function() {
        if (domElement == null) {
          domElement = $(`<div class='${self.dashboardClass()}'/>`);
          domHeader = $("<div class='service-dashboard-header header'/>");
          domTitle = $(`<h3>${service.name}</h3>`);

          domElement.click(function() {
            if (orch.globals.selectedService &&
              self != orch.globals.selectedService) {
              orch.globals.selectedService.domElement().removeClass("selected");
            }
            orch.globals.selectedService = self;
            orch.globals.selectedService.domElement().addClass("selected");
          });

          domHeader.append([buildButtons(), domTitle]);
          domHeader.dblclick(function() {
            if (parent.visibleServices().length > 1) {
              if (flexAmount <= 1) {
                flexAmount = 3;
                domButtons.expand.click();
              } else {
                flexAmount = 2;
                domButtons.contract.click();
              }
            } else {
              flexAmount = 1;
              domButtons.contract.click();
            }
          });

          domContents = $("<div class='service-logs empty'/>");
          domContents.bind('mousewheel DOMMouseScroll', function(e) {
            let scrollTo = null;
            if (orch.globals.selectedService == self) {
              if (e.type == 'mousewheel') {
                scrollTo = (e.originalEvent.wheelDelta * -0.5);
              } else if (e.type == 'DOMMouseScroll') {
                scrollTo = 40 * e.originalEvent.detail;
              }

              if (scrollTo) {
                e.preventDefault();
                domContents.scrollTop(scrollTo + domContents.scrollTop());
              }
            } else {
              if (e.type == 'mousewheel') {
                scrollTo = (e.originalEvent.wheelDelta * -0.5);
              } else if (e.type == 'DOMMouseScroll') {
                scrollTo = 40 * e.originalEvent.detail;
              }

              if (scrollTo) {
                // We want to scroll the container that projects rest in
                let doc = $(document);
                e.preventDefault();
                doc.scrollTop(scrollTo +
                  doc.scrollTop());
              }
            }
          });
          domElement.append([domHeader, domContents]);
        }

        return domElement;
      }

      self.renderMinimized = function() {
        if (domMinimized == null) {
          domMinimized = $("<div class='service-minimized " + self.dashboardClass() + " collapsed'>" + service.name + "</div>");
          let button = $("<span class='btn glyphicon glyphicon-fullscreen' aria-hidden='true'></span>");

          domMinimized.append(button);
          button.click(function() {
            domButtons.expand.click();
          });
          domMinimized.dblclick(function() {
            domButtons.expand.click();
          })
        }

        return domMinimized;
      }

      /**
       * The getter for services, we don't allow for this to be set
       * later since that would mess shit up
       */
      self.service = function() {
        return service;
      }

      /**
       * Getter/setter for status
       */
      self.status = function() {
        if (arguments.length != 0) {
          domElement.removeClass(status);
          domMinimized.removeClass(status);

          if (status == ServiceStatus.RUNNING && arguments[0] != ServiceStatus.RUNNING) {
            domContents.append($("<hr />"));
          }

          status = arguments[0];
          domElement.addClass(status);
          domMinimized.addClass(status);

          if (status == ServiceStatus.RUNNING) {
            domButtons.play.attr(DISABLED, DISABLED);
            domButtons.stop.attr(DISABLED, null);
            self.settingsButtons.configure.addClass(DISABLED);

          } else {
            domButtons.play.attr(DISABLED, null);
            domButtons.stop.attr(DISABLED, DISABLED);
            self.settingsButtons.configure.removeClass(DISABLED);
          }

          parent.refreshButtons();
        }

        return status;
      }

      /**
       * Updates the current dashboard with the newest project
       * configuration settings
       */
      self.update = function(serviceConfig) {
        service.name = serviceConfig.name;
        service.description = serviceConfig.description;
        service.branch = serviceConfig.branch;
        service.delay_after = serviceConfig.delay_after;
        service.delay_before = serviceConfig.delay_before;
        service.working_dir = serviceConfig.working_dir;
        service.commands = serviceConfig.commands;

        domTitle.html(service.name);
      }
    }

    orch.dashboard = orch.dashboard || {};
    orch.dashboard.ServiceDashboard = ServiceDashboard;
    orch.dashboard.ServiceStatus = ServiceStatus;
    orch.dashboard.COLLAPSED = COLLAPSED;
    orch.dashboard.DISABLED = DISABLED;
})();
