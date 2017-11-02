"use strict";

(function() {
  /**
   * OrchestraUtilities defines the base utility class
   * for orchestra
   * @constructor
   */
  function OrchestraUtilities() {
    let self = this;

    /**
     * getHost returns the full host path, respecting the original protocol and
     * port of the initial request
     */
    function getHost() {
      return window.location.protocol + "//" + window.location.hostname + ":" + window.location.port;
    }

    /**
     * onAnimationEnd sets the callback for when the CSS animation
     * on the provided element is finished
     */
    function onAnimationEnd(elem, callback) {
      let endEvent = whichTransitionEvent(elem);
      endEvent && elem && elem[0].addEventListener(endEvent, callback);
    }

    /**
     * whichTransitionEvent determines which tranisition end event
     * we should bind to
     */
    function whichTransitionEvent(elem) {
      let transition,
        transitions = {
          "transition": "transitionend",
          "OTransition": "oTransitionEnd",
          "MozTransition": "transitionend",
          "WebkitTransition": "webkitTransitionEnd"
        };

      // Try to find the matching transition end event
      for (let type in transitions) {
        if (elem[0].style[type] !== undefined)
          return transitions[type];
      }

      // We can't detect the animation end event
      return null;
    }

    self.getHost = getHost;
    self.onAnimationEnd = onAnimationEnd;
    self.whichTransitionEvent = whichTransitionEvent;
  }

  orch.utilities = new OrchestraUtilities();
})();
