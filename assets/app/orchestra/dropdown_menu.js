"use strict";

(function() {
  /**
   * DropdownMenu is the class for creating dropdown menus
   * @param       {string} text the text to display alongside the
   *                            vertical button
   * @constructor
   */
  function DropdownMenu(text) {
    let self = this,
      domElement = $("<div class='btn-group'>" +
        "<div class='btn dropdown-toggle' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>" +
        "</div>" +
        "<ul class='dropdown-menu'></ul>" +
      "</div>"),
      verticalHtml = "<span class='glyphicon glyphicon-option-vertical' aria-hidden='true'></span>",
      btn = domElement.find(".btn"),
      menu = domElement.find(".dropdown-menu");

    domElement.append(menu);
    setText(text);

    function setText(newText) {
      if (arguments.length == 1) {
        text = newText;
        btn.html(text + verticalHtml);
      }
      return text;
    }

    self.addEntry = function(label, callback) {
      let menuItem = new DropdownMenuItem(label, callback);
      menu.append(menuItem.render());
    }

    self.render = function() {
      return domElement;
    }

    self.verticalButtonHtml = function(newHtml) {
      if (arguments.length == 1) {
        verticalHtml = newHtml;

        // Now update the button
        setText(text);
      }

      return verticalHtml;
    }

    self.text = setText;
  }

  /**
   * DropdownMenuItem is the class for handling dropdown
   * menu items
   * @param       {String} label   text to display
   * @param       {Function} onClick callback to call when clicked
   * @constructor
   */
  function DropdownMenuItem(label, onClick) {
    let self = this,
      domElement = $("<li><a href='javascript:;'>" + label + "</a></li>"),
      link = domElement.find("a");

    // If we have a callback, add it, otherwise add the default
    if (onClick)
      domElement.click(onClick);
    else
      domElement.click(defaultOnClick);

    /**
     * click sets or calls the click event handler on the dom element
     * @param  {Function} callback the callback to use if setting
     */
    self.click = function(callback) {
      if (arguments.length == 1) {
        onClick = callback;
        domElement.click(onClick);
      } else {
        domElement.click();
      }
    }

    /**
     * label sets or returns the current label
     * @param  {string} newLabel the value to update the label to
     */
    self.label = function(newLabel) {
      if (arguments.length > 0) {
        label = newLabel;
        link.text(label);
      }

      return label;
    }

    /**
     * render returns the rendered DOM element
     */
    self.render = function() {
      return domElement;
    }
  }

  orch.ui = orch.ui || {};
  orch.ui.DropdownMenu = DropdownMenu;
  orch.ui.DropdownMenuItem = DropdownMenuItem;
})();
