"use strict";

(function() {
  let Types = {
    LOG_MESSAGE: "service_log_message",
    PROJECT_LIST: "project_list",
    PROJECT_UPDATE: "project_update_message",
    PROJECT_REMOVAL: "project_removal_message",
    STATUS_MESSAGE: "service_status_message"
  };

  function OrchestraCore() {
    let self = this,
      dashboards = {},
      navbar = $("#orch-navbar"),
      navbarButtons = navbar.find("ul"),
      projectButtons = {};

    $("#new-project").click(function() {
      let modal = orch.globals.MainModal,
        currentForm;

      // Start a new, blank project form
      currentForm = new orch.modal.ProjectModalForm();
      modal.title("Configure New Project");
      modal.form(currentForm);

      modal.show();
    });

    /**
     * buildProjectToggleButton builds a new clickable button that will toggle
     * the visibility of the corresponding project dashboard
     * @param  {ProjectDashboard} projectDash the project dashboard that this
     *                                        button corresponds to
     */
    function buildProjectToggleButton(projectDash) {
      let project = projectDash.project(),
        activeDashboards = $.cookie("active_dashboards"),
        entry = $("<li><a href='javascript:;'>" + project.name + "</a></li>");

      projectButtons[project.id] = {
        projectDashboard: projectDash,
        domElement: entry
      }

      // Check to see if this is one of the currently active dashboards
      if (activeDashboards) {
        let dashArray = activeDashboards.split(",");

        for(let i=0; i<dashArray.length; ++i) {
          if (dashArray[i] == project.id && projectDash.isCollapsed())
            projectDash.expand();
        }
      }

      // Is the dashboard currently expanded?
      if (!projectDash.isCollapsed())
        entry.addClass("active");

      entry.click(function() {
        if (projectDash.isCollapsed()) {
          entry.addClass("active");
          projectDash.expand();
        } else {
          entry.removeClass("active");
          projectDash.collapse();
        }

        $.cookie("active_dashboards", getActiveDashboardIDs().join(","), {expires: 30, path: "/"});
      })

      return entry;
    }

    /**
     * getActiveDashboardIDs returns the array of ids for the set of currently
     * active (ie expanded) dashboards
     */
    function getActiveDashboardIDs() {
      let arr = [],
        dashes = getActiveDashboards();

      for (let i=0; i<dashes.length; ++i) {
        arr.push(dashes[i].project().id);
      }

      return arr;
    }

    /**
     * getActiveDashboards returns the array of active (ie expanded) dashboards
     */
    function getActiveDashboards() {
      let arr = [],
        dashes = Object.keys(dashboards);

      for (let i=0; i<dashes.length; ++i) {
        if (!dashboards[dashes[i]].isCollapsed())
          arr.push(dashboards[dashes[i]]);
      }

      return arr;
    }

    /**
     * getDashboard attempts to retrieve a dashboard by project ID
     * @param  {string} id the ID of the project that this dashboard is for
     */
    function getDashboard(id) {
      return dashboards[id];
    }

    /**
     * getDashboards returns all of the dashboards
     */
    function getDashboards() {
      return dashboards;
    }

    /**
     * handleProjectList handles the project list command from the server
     */
    function handleProjectList(data) {
      let currData = data[0],
        keys = Object.keys(currData),
        elems = [];

      for (let i=0; i<keys.length; ++i) {
        let project = currData[keys[i]],
          dash = new orch.dashboard.ProjectDashboard(project);

        elems.push(dash.render());
        dash.collapse();
        registerDashboard(dash);

        // Bind the socket to the dashboard so it knows about it
        dash.socket(orch.globals.socket);
      }

      $("#dashboard").append(elems);
    }

    /**
     * handleDashboardCRUD handles the dashboard CRUD operations that come
     * from the server
     */
    function handleDashboardCRUD(currData, dash) {
      if (currData.type == Types.LOG_MESSAGE) {
        if (dash.services()[currData.id]) {
          dash.services()[currData.id].appendLine(currData.content);
        }
      } else if (currData.type == Types.STATUS_MESSAGE) {
        if (dash.services()[currData.id])
          dash.services()[currData.id].status(currData.status);
      } else if (currData.type == Types.PROJECT_UPDATE) {
        dash.update(currData);
      } else if (currData.type == Types.PROJECT_REMOVAL) {
        dash.remove(currData);
      }
    }

    /**
     * handleNewDashboard handles creating a new dashboard based on data
     * received from the server
     */
    function handleNewDashboard(currData) {
      let dash = new orch.dashboard.ProjectDashboard(currData.project);
      // Bind the socket to the dashboard so it knows about it
      dash.socket(orch.globals.socket);

      // Now register it with the core
      registerDashboard(dash);
      $("#dashboard").append(dash.render());
    }

    /**
     * processMessage processes incoming socket messages for this dashboard
     * @param {SocketMessage} socketMessage the incoming message from the socket
     */
    function processMessage(socketMessage) {
      let message = JSON.parse(socketMessage.data),
        data = message.data;

      if (message.type == Types.PROJECT_LIST) {
        handleProjectList(data);
      } else {
        for (let i=0; i < data.length; ++i) {
          let currData = data[i];

          if (currData.project_id) {
            let dash = dashboards[currData.project_id];

            // Do we have a matching dashboard? Or are we dealing
            // with something new maybe
            if (dash != null) {
              handleDashboardCRUD(currData, dash);
            } else {
              if (currData.type == Types.PROJECT_UPDATE) {
                // This is an update so we need to create a new
                // dashboard then send the message to it
                handleNewDashboard(currData);
              }
            }
          }
        }
      }
    }

    /**
     * registerDashboard registers a new dashboard given a specific
     * ID value
     */
    function registerDashboard(dash) {
      if (dash.project().id == null) {
        console.error("Can't register ID-less dashboard :(");
      } else {
        dashboards[dash.project().id] = dash;

        let button = buildProjectToggleButton(dash);
        navbarButtons.append(button);
      }
    }

    function Stub() {
      throw "function is not implemented";
    }

    ///////////////////////////////////
    // PUBLIC
    ///////////////////////////////////
    self.getDashboard = getDashboard;
    self.getDashboards = getDashboards;
    self.globals = {};
    self.processMessage = processMessage;
    self.registerDashboard = registerDashboard;
    self.Stub = Stub;
  }

  window.orch = new OrchestraCore();
  window.orch.message_types = Types;
})()
