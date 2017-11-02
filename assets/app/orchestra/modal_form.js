"use strict";

(function() {

  /**
   * ModalForm the constructor for modal forms that need to be wrapped in a
   * header, be closable, etc
   * @param       {string} className the class to apply to the form
   * @param       {string} titleText the title to apply to the header
   * @constructor
   */
  function ModalForm(className, titleText, isRoot) {
    let self = this,
      fields = [],
      isEnabled = true,
      baseClasses = (isRoot) ? `panel modal-root ${className}` : `panel modal-service ${className}`,
      div = $(`<div class='${baseClasses}'/>`),
      body = $("<div class='panel-body' />"),
      headerClasses = (isRoot) ? 'service-dashboard-header hidden' : 'service-dashboard-header',
      headerContainer = $(`<div class='${headerClasses}'><div class='btn-container' /></div>`),
      btnContainer = headerContainer.find(".btn-container"),
      header = $(`<h3 class='panel-title'>${titleText}</h3>`),
      defaultCloseHtml = "<button type='button' class='close service-close' aria-label='Remove'>" +
          "<span aria-hidden='true'>×</span>" +
        "</button>",
      minimizeButton = $("<button type='button' class='close service-close minimize' aria-label='Remove'>" +
          "<span class='glyphicon glyphicon-chevron-down' aria-hidden='true'></span>" +
        "</button>"),
      closeButton = $(defaultCloseHtml),
      onClose = defaultOnClose,
      isAnimating = false,
      lastHeight = 0;

    /**
     * init is the constructor
     */
    function init() {
      // Setup the callback for when animations are finished running
      // on the body element. This may cause some weird issues if we
      // start doing other animations than just the expand/collapse stuff
      orch.utilities.onAnimationEnd(body, function() {
        isAnimating = false;

        if (!div.hasClass("minimized"))
          body.css("height", "initial");
      });

      closeButton.click(close);

      // Add the event listeners for collapsing the panels
      headerContainer.dblclick(toggleMinimize);
      minimizeButton.click(toggleMinimize);

      // Assemble the components
      btnContainer.append(minimizeButton, closeButton);
      headerContainer.append(header);
      div.append(headerContainer, body);
    }
    init();

    /**
     * addField adds a new field to the current form
     */
    function addField(field) {
      fields.push(field);
      body.append(field.render());
    }

    /**
     * addFields is a convenience function for adding an array of new
     * fields to the current form
     */
    function addFields(newFields) {
      if (Array.isArray(newFields))
        for (let i in newFields) {
          addField(newFields[i]);
        }
      else {
        for (let i in arguments) {
          addField(arguments[i]);
        }
      }
    }

    /**
     * append will attempt to render or otherwise simply append the given element
     * onto the body of the form
     */
    function append(elem) {
      if (elem.render)
        body.append(elem.render());
      else
        body.append(elem);
    }

    /**
     * close is the function for forcing a close event or setting the callback
     * for the close event
     * @param  {Function} callback the callback to use on a close event
     */
    function close(callback) {
      if (arguments.length > 0 && typeof callback == "function") {
        onClose = callback;
      } else
        onClose();
    }

    /**
     * defaultOnClose provides the normal close behavior for the current form
     */
    function defaultOnClose() {
      self.enabled(false);
      div.css("height", div.outerHeight() + "px");
      div.removeClass("flexible");

      // TODO refactor this to use the onAnimationEnd callback
      setTimeout(function() {
        div.addClass("collapsed");
      }, 50);
    }

    /**
     * enabled gets or sets whether the form is enabled
     */
    function enabled() {
      if (arguments.length > 0)
        isEnabled = arguments[0];

      return isEnabled;
    }

    /**
     * expand will uncollapse the current modal form if it is collapsed
     */
    function expand() {
      // Already minimized, handle expansion
      isAnimating = true;
      div.removeClass("minimized");
    }

    /**
     * getHeight returns the current height of the body of this form
     */
    function getHeight() {
      return body.outerHeight();
    }

    /**
     * minimize will collapse the current modal form if it is not already
     * collapsed down
     */
    function minimize() {
      // Already expanded, handle minimization
      isAnimating = true;
      body.css("height", body.outerHeight() + "px");

      // Make sure the height setting takes, otherwise the
      // minimized css applies too rapidly and we don't
      // get a clean minimization
      // TODO: refactor this to use the appropriate CSS callback
      setTimeout(function() {
        div.addClass("minimized");
      }, 50);
    }

    /**
     * toggleMinimize toggles the minimized state of the form
     */
    function toggleMinimize() {
      if (!isAnimating) {
        if (div.hasClass("minimized")) {
          expand();
        } else {
          minimize();
        }
      }
    }

    /**
     * title gets or sets the current title of the form
     */
    function title(text) {
      if (arguments.length > 0) {
        titleText = text;
        header.html(text);
      }

      return titleText;
    }

    /**
     * validate performs the default form validation check
     */
    function validate() {
      let valid = true;

      // Make sure the form is currently enabled, otherwise don't run
      // the validation checks
      if (enabled)
        for (let i in fields) {
          let field = fields[i];

          if (field.enabled())
            if (!field.validate()) {
              valid = false;
              field.error(true);
            } else {
              field.error(false);
            }
        }

      return valid;
    }

    /**
     * value gets the current JSON value of the form
     */
    function value() {
      let val = {};

      for (let i=0; i<fields.length; ++i) {
        let field = fields[i];

        if (field.enabled() && field.binding() != null) {
          val[field.binding()] = field.value();
        }
      }

      return val;
    }

    self.addField = addField;
    self.addFields = addFields;
    self.append = append;
    self.body = function(){return body};
    self.close = close;
    self.closeButton = function(){return closeButton};
    self.enabled = enabled;
    self.expand = expand;
    self.getHeight = getHeight;
    self.header = function(){return headerContainer};
    self.minimize = minimize;
    self.render = function(){return div};
    self.save = orch.Stub;
    self.title = title;
    self.value = value;
    self.validate = validate;
  }

  orch.modal = orch.modal || {};
  orch.modal.ModalForm = ModalForm;
})();
