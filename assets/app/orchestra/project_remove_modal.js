"use strict";

(function() {

  function ProjectRemoveModal(project) {
    let self = this,
      textBlock = new orch.ui.TextBlock(`You are about to remove ${project.name}. ` +
        "Are you sure you would like to continue?");

    // extend ModalForm
    orch.modal.ModalForm.call(self, "project-remove", `Remove ${project.name}?`);

    self.render().html(textBlock.render());

    self.save = function(callback) {
      let success = orch.globals.socket.write({
        data: [{
          data: [],
          project_id: project.id,
          type: "remove_project"
        }]
      });

      if (!success) {
        orch.MessageFeed.warn("Could not update configuration");
        callback(false);
      } else {
        callback(true);
      }
    }

    self.value = function() {
      let data = {};

      return data;
    }
  }

  orch.modal = orch.modal || {};
    orch.modal.ProjectRemoveModal = ProjectRemoveModal;
})();
