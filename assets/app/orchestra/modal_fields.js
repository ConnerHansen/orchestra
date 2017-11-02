"use strict";

(function() {
  /**
   * LabelledField the function for storing the base modal
   * field functionality
   * @constructor
   */
  function LabelledField(bindingName, label, domValue) {
    let self = this,
      isEnabled = true,
      domLabel = $("<label>" + label + "</label>"),
      domError = $("<label class='label-error' />"),
      domElement = $("<div class='form-group'/>"),
      errorMessage;
    domElement.append(domLabel, domError, domValue);

    /**
     * binding returns or sets the binding name for this field
     */
    function binding(name) {
      if (arguments.length > 0)
        bindingName = name;

      return bindingName;
    }

    /**
     * enabled returns or sets the current enabled state
     */
    function enabled(state) {
      if (arguments.length > 0)
        isEnabled = state;

      return isEnabled;
    }

    /**
     * error either marks or unmarks the current field's error state
     */
    function error(activate) {
      if (activate) {
        // if (arguments.length > 1)
        //   domError.text(message);
        domElement.addClass("error");
      } else
        domElement.removeClass("error");
    }

    /**
     * errorMessageFunc gets or sets the current error message text
     */
    function errorMessageFunc(message) {
      if (arguments.length > 0) {
        errorMessage = message;
        domError.text(errorMessage);
      }

      return errorMessage;
    }

    /**
     * render returns the current dom element
     */
    function render() {
      return domElement;
    }

    /**
     * Get/set the text for the label
     */
    function text() {
      if (arguments.length > 0) {
        label = arguments[0];
        domLabel.text(label);
      }

      return label;
    }

    /**
     * Get the current value for the dom element
     */
    function value() {
      return domValue.val();
    }

    /**
     * validate performs a validation check on the current field
     */
    function validate() {
      return true;
    }

    // Public scope
    self.binding = binding;
    self.field = function(){return domValue};
    self.enabled = enabled;
    self.error = error;
    self.errorMessage = errorMessageFunc;
    self.label = function(){return domLabel};
    self.render = render;
    self.text = text;
    self.value = value;
    self.validate = validate;
  }

  /**
   * CodeField the function for generating a new code field
   * @constructor
   */
  function CodeField(bindingName, label, fieldValue) {
    fieldValue = (fieldValue) ? fieldValue : "";

    let self = this,
      currMode = "ace/mode/sh",
      currTheme = "ace/theme/monokai",
      editor,
      contentDiv = $("<div class='form-control'></div>");

    contentDiv.text(fieldValue);
    editor = ace.edit(contentDiv[0]);

    // Super invocation
    orch.ui.LabelledField.call(this, bindingName, label, contentDiv);

    mode(currMode);
    theme(currTheme);
    // Limit the height of the editor
    // TODO: make this configurable
    editor.setOptions({
      maxLines: 30,
      autoScrollEditorIntoView: false
    });

    // Now add some padding to the editor
    editor.renderer.setScrollMargin(10, 10);

    /**
     * theme gets or sets the current theme for the editor
     */
    function theme(newTheme) {
      if (arguments.length > 0) {
        currTheme = newTheme;
        editor.setTheme(currTheme);
      }

      return currTheme;
    }

    /**
     * mode gets or sets the current mode of the editor
     */
    function mode(newMode) {
      if (arguments.length > 0) {
        currMode = newMode;
        editor.getSession().setMode(currMode);
      }

      return editor.getSession().getMode();
    }

    /**
     * text returns the raw text of the editor
     */
    function text() {
      return editor.getValue();
    }

    /**
     * value returns the value of the current editor, split up by line
     */
    function value() {
      return text().split("\n");
    }

    self.editor = function(){return editor};
    self.mode = mode;
    self.text = text;
    // Override
    self.value = value;
  }

  /**
   * RegexField the function for defining a new regex field
   * @constructor
   */
  function RegexField(bindingName, label, fieldValue, placeholder) {
    placeholder = (placeholder) ? "placeholder=\'" + placeholder + "\'" : "";

    let self = this,
      group = $("<div class='input-group'>"),
      fieldText = (fieldValue) ? "value='" + fieldValue + "'" : "",
      leftSlash = $("<span class='input-group-addon'>/</span>"),
      input = $("<input class='form-control' " + placeholder + " " + fieldText + ">"),
      rightSlash = $("<span class='input-group-addon'>/</span></div>");

    group.append(leftSlash, input, rightSlash);

    orch.ui.LabelledField.call(self, bindingName, label, group);

    // Override
    self.value = function() {
      return input.val();
    }
  }

  /**
   * SelectField is the function for defining new dropdown fields. This isn't
   * actually a select, rather it's a formatted button with a dropdown menu, but
   * that's so we can apply styling etc
   * @constructor
   */
  function SelectField(bindingName, label, options, selectedIndex) {
    let self = this,
      contentDiv = $("<div class='btn-group select-group' />"),
      selectButton = $("<button type='button' class='btn btn-default dropdown-toggle' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>" +
          "<span class='caret'></span>" +
        "</button>"),
      dropdown = $("<ul class='dropdown-menu'></ul>"),
      opts = [],
      currOption;

    // Extend LabelledField
    orch.ui.LabelledField.call(self, bindingName, label, contentDiv);

    // Now setup the select button options
    contentDiv.append([selectButton, dropdown]);
    for (let i in options) {
      let opt = options[i],
        newOpt = addOption(opt);

      if (i == selectedIndex)
        select(newOpt);
    }

    /**
     * addOption adds a new option to the dropdown
     * @param {string} text the string for the text value to add
     */
    function addOption(text, val) {
      // If no value is passed, assume it's the same as the text
      if (arguments.length < 2)
        val = text;

      let newOpt = $("<li><a href='javascript:;'>" + text + "</a></li>");
      newOpt.click(function() {
        select(newOpt);
      });

      opts.push({text: text, value: val});

      dropdown.append(newOpt);
      return newOpt;
    }

    /**
     * select sets the currently active options
     * @param  {domElement} entry the JQuery dom element to select
     */
    function select(entry) {
      if (currOption)
        currOption.removeClass("active");

      currOption = entry;
      currOption.addClass("active");
      setText(currOption.text());
    }

    /**
     * setText sets the current text of the dropdown while also
     * preserving the carat
     */
    function setText(text) {
      selectButton.html(text + "<span class='caret'></span>");
    }

    self.addOption = addOption;
    self.setText = setText;

    // Override
    self.value = function() {
      // TODO: this retrieves the text of the cell -- not the actual
      // value of the entry
      if (currOption)
        return currOption.text();

      return null;
    };
  }

  // /**
  //  * NumberField the function for defining a new number input field
  //  * @constructor
  //  */
  // function NumberField(bindingName, label, fieldValue, placeholder) {
  //   fieldValue = (fieldValue) ? fieldValue : "";
  //   placeholder = (placeholder) ? "placeholder=\'" + placeholder + "\'" : "";
  //
  //   let self = this,
  //     contentDiv = $("<input type='text' class='form-control' value='" +
  //       fieldValue + "' " + placeholder + "></input>");
  //
  //   // Extend LabelledField
  //   orch.ui.LabelledField.call(this, bindingName, label, contentDiv);
  //
  //   let shadowValue = self.value;
  //   self.value = function() {
  //     return parseInt(shadowValue());
  //   }
  // }

  /**
   * TextField the function for defining a new text input field
   * @constructor
   */
  function TextField(bindingName, label, fieldValue, placeholder) {
    fieldValue = (fieldValue) ? fieldValue : "";
    placeholder = (placeholder) ? "placeholder=\'" + placeholder + "\'" : "";

    let self = this,
      contentDiv = $("<input type='text' class='form-control' value='" +
        fieldValue + "' " + placeholder + "></input>");

    // Extend LabelledField
    orch.ui.LabelledField.call(this, bindingName, label, contentDiv);
  }

  /**
   * TextBlock the function for defining a new text block, which does not allow
   * for values to be returned
   * @constructor
   */
  function TextBlock(text) {
    let self = this;

    // Extend LabelledField
    orch.ui.LabelledField.call(this, null, text);

    // Override -- noop
    self.value = function() {return null};
  }

  orch.ui = orch.ui || {};
  orch.ui.CodeField = CodeField;
  orch.ui.LabelledField = LabelledField;
  orch.ui.RegexField = RegexField;
  orch.ui.SelectField = SelectField;
  orch.ui.TextField = TextField;
  orch.ui.TextBlock = TextBlock;
})()
