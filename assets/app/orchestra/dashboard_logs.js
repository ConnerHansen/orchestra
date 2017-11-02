"use strict";

(function() {

  function LogLineScrubber(key, color, replace) {
    if (typeof(key) == "string")
      key = new RegExp(key);

    if (color == null)
      color = "";

    if (replace == null)
      replace = true;

    this.key = key;
    this.color = color;
    this.replace = replace;
  }

  function LogLine(entry) {
    let self = this,
      colorClass = "",
      domElement,
      scrubs = [];

    scrubs.push(new LogLineScrubber(/^.{0,1}((\[){0,1}..m){0,1}(.){0,1}\[36m/, "cyan", true));
    scrubs.push(new LogLineScrubber(/^.{0,1}((\[){0,1}..m){0,1}(.){0,1}\[34m/, "cyan", true));
    scrubs.push(new LogLineScrubber(/^.{0,1}((\[){0,1}..m){0,1}(.){0,1}\[33m/, "yellow", true));
    scrubs.push(new LogLineScrubber(/^.{0,1}((\[){0,1}..m){0,1}(.){0,1}\[32m/, "green", true));
    scrubs.push(new LogLineScrubber(/^.{0,1}((\[){0,1}..m){0,1}(.){0,1}\[31m/, "red", true));
    scrubs.push(new LogLineScrubber(/^.{0,1}((\[){0,1}..m){0,1}(.){0,1}\[39m/, "", true));
    scrubs.push(new LogLineScrubber(/^.{0,1}((\[){0,1}..m){0,1}(.){0,1}\[22m/, "", true));
    scrubs.push(new LogLineScrubber(/^.\[0m.\[22m/, "", true));

    scrubs.push(new LogLineScrubber(/^[\d-_ \:,\[a-zA-Z]+\] WARN/, "yellow", false));
    scrubs.push(new LogLineScrubber(/^[\d-_ \:,\[a-zA-Z]+\] ERROR/, "red", false));
    scrubs.push(new LogLineScrubber(/^[\d-_ \:,\[a-zA-Z]+\] DEBUG/, "cyan", false));

    function removeNonDisplayableChars(str) {
      // let line = "";
      //
      // for(let i=0; i<str.length; ++i) {
      //   // Allow all displayable characters or new lines or tabs
      //   if (str.charCodeAt(i) >= 32 && str.charCodeAt(i) <= 255 || str.charCodeAt(i) == 9 || str.charCodeAt(i) == 10) {
      //     line += str.charAt(i);
      //   }
      // }
      //
      // return line
      return str
    }

    function scrubEntry() {
      // let keys = Object.keys(entryMap);
      let match = false;
      colorClass = "";
      entry = removeNonDisplayableChars(entry.replace(/^\[2K\[1G\[\?25h/, ""));

      for (let i=0; i<scrubs.length && !match; ++i) {
        // let key = new RegExp(keys[i]);
        let scrub = scrubs[i];

        if (entry.match(scrub.key)) {
          match = true;
          if (scrub.replace) {
            entry = entry.replace(scrub.key, "");
          }

          // entry = entry.replace(key, "");
          colorClass = scrub.color;
        }
      }

      // Now cleanup the line and scrub off any hidden chars we might have missed
      // This is mainly needed because GO will enject a billion of these codes
      // in the middle of lines, and we can't handle that right now
      entry = entry.replace(new RegExp(/\[[\d]{1,2}m/g), "");

      return colorClass;
    }

    /**
     * Renders the log line
     * @return {DomElement} the dom element for this line
     */
    self.render = function() {
      if (domElement == null) {
        scrubEntry();
        domElement = $("<pre class='log-line " + colorClass + "'>" + entry + "</pre>");
      }

      return domElement;
    }
  }

  orch.dashboard = orch.dashboard || {};
  orch.dashboard.LogLine = LogLine;
  orch.dashboard.LogLineScrubber = LogLineScrubber;
})()
