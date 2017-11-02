"use strict";

(function() {
  function defaultConfiguration() {
    return {
      name: "New Mock Configuration",
      active: true,
      rules: [defaultRule()]
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

  function MockeryMatchConditionForm(rule) {
    let self = this,
      ruleHolder = $("<div class='mocks-rule' />"),
      style = "service-dashboard mockery-dashboard stopped",
      title = "Match Condition",
      contentType = new orch.ui.TextField("content_type", "Content Type", rule.content_type, "application/json"),
      body = new orch.ui.CodeField("body", "Response Body", rule.body),
      regex = new orch.ui.RegexField("regex", "URL Regex", rule.regex, "*"),
      statusCode = new orch.ui.TextField("status_code", "Status Code", rule.status_code, "200");

    function init() {
      orch.modal.ModalForm.call(self, style, title);
      self.addFields(regex, statusCode, contentType, body);

      // We expect just a straight up JSON blob here, so override the default
      // value getter just for this field
      body.value = function() {
        return body.text();
      }

      self.append(ruleHolder);
      setupFields();
    }
    init();

    function setupFields() {
      // setup validation on regex -- maybe try parsing it too?
      regex.errorMessage("The regex you entered isn't valid");
      regex.validate = function() {
        return regex.value().trim().length > 0;
      }

      // this is more complicated. We need to return an int here instead
      // of just the default string, so shadow the original value then
      // force it to attempt to parse
      statusCode.errorMessage("The status code you entered isn't an integer");
      statusCode.validate = function() {
        return !isNaN(statusCode.value()) && statusCode.value() > 0;
      }
      // TODO: create NumericField
      let _statusValue = statusCode.value;
      statusCode.value = function() {
        return parseInt(_statusValue());
      }
    }
  }

  function MockeryConfigurationForm(service, configuration, isRoot) {
    let self = this,
      title = configuration.name || defaultConfiguration().name,
      style = (isRoot) ? "" : "service-dashboard mockery-dashboard stopped",
      nameField = new orch.ui.TextField("name", "Name", configuration.name),
      addMockeryService = new orch.ui.Button("Add New Match Condition", function(){}, "modal-btn-right add-mockery-btn"),
      rulePanel = $("<div />"),
      rules = [];

    // isolate the initialization logic
    function init() {
      // extend ModalForm
      orch.modal.ModalForm.call(self, style, title, isRoot);

      // Add the fields to the current form
      self.addFields(nameField);

      // Setup validators and error messages
      nameField.errorMessage("The name you entered isn't valid");
      nameField.validate = function() {
        return nameField.value().trim().length > 0;
      }

      self.append(rulePanel);
      self.append(addMockeryService.render());
      addMockeryService.click(function(){appendRuleToPanel(null, true)});

      // Now setup the rules we already know about
      if (configuration.rules != null)
        for (let i=0; i<configuration.rules.length; ++i) {
          appendRuleToPanel(configuration.rules[i]);
        }
      else {
        appendRuleToPanel();
      }
    }
    init();

    /**
     * appendRuleToPanel adds a new mockery match condition rule to the form
     */
    function appendRuleToPanel(rule, slideDown) {
      let newRulePanel = new MockeryMatchConditionForm(rule || defaultRule());

      rulePanel.append(newRulePanel.render());
      rules.push(newRulePanel);
    }

    /**
     * Override
     */
    let _validate = self.validate;
    function validate() {
      let isValid = _validate();

      for (let i in rules)
        isValid = isValid && rules[i].validate();

      return isValid;
    }

    /**
     * Override
     */
    function value() {
      let data = {};

      data.name = nameField.value();
      data.active = configuration.active;
      data.rules = [];

      for (let i in rules) {
        if (rules[i].enabled())
          data.rules.push(rules[i].value());
          // data.rules.push({
          //   body: rules[i].body.text(),
          //   content_type: rules[i].contentType.value(),
          //   regex: rules[i].regex.value(),
          //   status_code: parseInt(rules[i].statusCode.value()) || 200,
          // });
      }

      return data;
    }

    self.validate = validate;
    self.value = value;
  }

  mockery.modal = mockery.modal || {};
  mockery.modal.MockeryConfigurationForm = MockeryConfigurationForm;
})();
