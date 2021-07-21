/*jslint nomen: true, indent: 2, maxlen: 80 */
/*global window, rJS, RSVP, Date, ics, XMLHttpRequest, DOMParser, URL,
  loopEventListener, history, console*/
(function (window, rJS, RSVP, Date, ics, XMLHttpRequest, DOMParser, URL,
  loopEventListener, history, console) {
    "use strict";

  /////////////////////////////
  // parameters
  /////////////////////////////
  var STR = "";
  var OPTION_DICT = {};
  var ACTIVE = "is-active";
  var KLASS = rJS(window);
  var CANVAS = "canvas";
  var ARR = [];
  var BLANK = "_blank";
  var NAME = "name";
  var LOCATION = window.location;
  var VSF = "vsf_jio";
  var LANG = "https://raw.githubusercontent.com/VoltEuropa/votesansfrontieres/master/lang/";
  var DOCUMENT = window.document;
  var DEADLINE = "09/05/2021 00:00:00 PM GMT+0100";
  var DAYS = ".days";
  var HOURS = ".hours";
  var MINS = ".minutes";
  var SECS = ".seconds";
  var ZERO = "0";
  var FILENAME = "Go_vote_reminder";
  var DEFAULT_REMINDER = "Reminder: 1 week left to register for elections";
  var DEFAULT_DATE = "08/29/2021 09:00:00 AM GMT+0100";

  /////////////////////////////
  // methods
  /////////////////////////////
  function launchCountdown(my_end_date, my_element) {
    var days;
    var hours;
    var minutes;
    var seconds;
    var end_date = new Date(my_end_date).getTime();

    if (isNaN(end_date)) {
      return;
    }

    function calculate() {
      var start_date = new Date().getTime();
      var time_remaining = parseInt((end_date - start_date) / 1000, 10);
      if (time_remaining >= 0) {
        days = parseInt(time_remaining / 86400, 10);
        time_remaining = (time_remaining % 86400);
        hours = parseInt(time_remaining / 3600, 10);
        time_remaining = (time_remaining % 3600);
        minutes = parseInt(time_remaining / 60, 10);
        time_remaining = (time_remaining % 60);
        seconds = parseInt(time_remaining, 10);
        if (getElem(my_element, DAYS)) {
          getElem(my_element, DAYS).textContent = parseInt(days, 10);
          getElem(my_element, HOURS).textContent = (ZERO + hours).slice(-2);
          getElem(my_element, MINS).textContent = (ZERO + minutes).slice(-2);
          getElem(my_element, SECS).textContent = (ZERO + seconds).slice(-2);
        }
      }
    }
    window.setInterval(calculate, 1000);
  }

  function getElem(my_element, my_selector) {
    return my_element.querySelector(my_selector);
  }

  function mergeDict(my_return_dict, my_new_dict) {
    return Object.keys(my_new_dict).reduce(function (pass_dict, key) {
      pass_dict[key] = my_new_dict[key];
      return pass_dict;
    }, my_return_dict);
  }

  // poor man's templates. thx, http://javascript.crockford.com/remedial.html
  if (!String.prototype.supplant) {
    String.prototype.supplant = function (o) {
      return this.replace(TEMPLATE_PARSER, function (a, b) {
        var r = o[b];
        return typeof r === "string" || typeof r === "number" ? r : a;
      });
    };
  }

  function getTemplate(my_klass, my_id) {
    return my_klass.__template_element.getElementById(my_id).innerHTML;
  }

  function purgeDom(my_node) {
    while (my_node.firstChild) {
      my_node.removeChild(my_node.firstChild);
    }
  }

  function setDom(my_node, my_string, my_purge) {
    var faux_element = DOCUMENT.createElement(CANVAS);
    if (my_purge) {
      purgeDom(my_node);
    }
    faux_element.innerHTML = my_string;
    ARR.slice.call(faux_element.children).forEach(function (element) {
      my_node.appendChild(element);
    });
  }

  function getLang(nav) {
    return (nav.languages ? nav.languages[0] : (nav.language || nav.userLanguage));
  }

  function getVsfConfig(my_language) {
    return {
      "type": "vsf_storage",
      "repo": "votesansfrontieres",
      "path": "lang/" + my_language,
      "__debug": "https://softinst103163.host.vifib.net/votesansfrontieres/lang/" + my_language + "/debug.json"
    };
  }

  function setQuery(my_key, my_val) {
    return new SimpleQuery({"key": my_key, "value": my_val, "type": "simple"});
  }

  function isString(x) {
    return Object.prototype.toString.call(x) === "[object String]";
  }

  KLASS

    /////////////////////////////
    // state
    /////////////////////////////
    .setState({
      "locale": getLang(window.navigator).substring(0, 2) || "en",
      "online": null,
      "sw_errors": 0,
    })

    /////////////////////////////
    // ready
    /////////////////////////////
    .ready(function (gadget) {
      var element = gadget.element;
      gadget.property_dict = {
        "layout": getElem(element, ".vote-layout"),
        "url_dict": {},
        "content_dict": {},
        "i18n_dict": {},
      };
    })

    /////////////////////////////
    // acquired methods
    /////////////////////////////

    /////////////////////////////
    // published methods
    /////////////////////////////

    /////////////////////////////
    // declared methods
    /////////////////////////////
    // ---------------------- JIO bridge ---------------------------------------
    .declareMethod("route", function (my_scope, my_call, my_p1, my_p2, my_p3) {
      return this.getDeclaredGadget(my_scope)
        .push(function (my_gadget) {
          return my_gadget[my_call](my_p1, my_p2, my_p3);
        });
    })

    .declareMethod("vsf_create", function (my_option_dict) {
      return this.route(VSF, "createJIO", my_option_dict);
    })
    .declareMethod("vsf_get", function (my_id) {
      return this.route(VSF, "get", my_id);
    })
    .declareMethod("vsf_allDocs", function () {
      return this.route(VSF, "allDocs");
    })

    .declareMethod("stateChange", function (delta) {
      var gadget = this;
      var state = gadget.state;

      if (delta.hasOwnProperty("locale")) {
        state.locale = delta.locale;
      }
      if (delta.hasOwnProperty("mode")) {
        state.mode = delta.mode;
      }
      if (delta.hasOwnProperty("online")) {
        state.online = delta.online;
        if (state.online) {
          gadget.element.classList.remove("vote-offline");
        } else {
          gadget.element.classList.add("vote-offline");
        }
      }
      //if (delta.hasOwnProperty("sw_errors")) {
      //  state.sw_errors = delta.sw_errors;
      //}
      return;
    })

    .declareMethod("translateDom", function (my_payload) {
      var gadget = this;
      var dict = gadget.property_dict;
      var i;
      var tag;
      var tag_list = gadget.element.querySelectorAll('[data-i18n]');
      var tag_len = tag_list.length;
      for (i = 0; i < tag_len; i += 1) {
        tag = tag_list[i];
        tag.textContent = my_payload[tag.getAttribute('data-i18n')];
      }
    })

    .declareMethod("createIcsFile", function (my_target) {
      var gadget = this;
      var cal = ics();
      var description = STR;
      var subject = my_target.vote_remind_title;
      var begin = my_target.vote_remind_date;
      var location = my_target.vote_remind_location;

      cal.addEvent(
        subject ? subject.value : DEFAULT_REMINDER,
        description,
        location && gadget.state.location ? gadget.state.location.replace("<br />", "") : STR,
        begin ? begin.value : DEFAULT_DATE,
        DEADLINE
      );
      cal.download(FILENAME);
    })

    .declareMethod("fetchTranslationAndUpdateDom", function (my_language) {
      var gadget = this;
      var dict = gadget.property_dict;
      var url_dict = dict.url_dict;
      return new RSVP.Queue()
        .push(function () {
          return gadget.vsf_get(url_dict.ui);
        })
        .push(function (data) {
          dict.i18n_dict = data;
          return gadget.translateDom(data);
        });
    })

    .declareMethod("updateStorage", function (my_language) {
      var gadget = this;
      if (my_language === gadget.state.locale) {
        return;
      }
      return new RSVP.Queue()
        .push(function () {
          return gadget.stateChange({"locale": my_language});
        })
        .push(function () {
          return gadget.vsf_create(getVsfConfig(my_language));
        })
        .push(function () {
          return gadget.buildVsfLookupDict();
        })
        .push(function () {
          return gadget.fetchTranslationAndUpdateDom();
        });
    })

    .declareMethod("buildVsfLookupDict", function () {
      var gadget = this;
      var dict = gadget.property_dict;
      return new RSVP.Queue()
        .push(function () {
          return gadget.vsf_allDocs();
        })
        .push(function (my_file_list) {
          if (my_file_list.data.total_rows === 0) {
            return gadget.updateStorage("en");
          }
          my_file_list.data.rows.map(function (row) {
            dict.url_dict[row.id.split("/").pop().replace(".json", "")] = row.id;
          });
        })

        // we only need a language to build the dict, so in case of errors like
        // on OS X/Safari 9, which cannot handle Github APIv3 redirect, we just
        // build the damn thing by hand... and fail somewhere else
        .push(undefined, function(whatever) {
          var i;
          for (i = 1; i < 32; i += 1) {
            dict.url_dict[i] = LANG + gadget.state.locale + "/" + i + ".json";
          }
          dict.url_dict["ui"] = LANG + gadget.state.locale + "/ui.json";
        });
    })

    // -------------------.--- Render ------------------------------------------
    .declareMethod("render", function (my_option_dict) {
      var gadget = this;
      var dict = gadget.property_dict;

      window.componentHandler.upgradeDom();
      mergeDict(dict, my_option_dict);
      return new RSVP.Queue()
        .push(function () {
          return gadget.vsf_create(getVsfConfig(gadget.state.locale));
        })
        .push(function () {
          return gadget.buildVsfLookupDict();
        })
        .push(function () {
          return gadget.fetchTranslationAndUpdateDom(gadget.state.locale);
        });
    })

    .declareMethod("handleError", function (my_err, my_err_dict) {
      var gadget = this;
      var code;
      var err = my_err.target ? JSON.parse(my_err.target.response).error : my_err;

      for (code in my_err_dict) {
        if (my_err_dict.hasOwnProperty(code)) {
          if ((err.status_code + STR) === code) {
            return my_err_dict[code];
          }
        }
      }
      throw err;
    })

    /////////////////////////////
    // declared jobs
    /////////////////////////////

    /////////////////////////////
    // declared service
    /////////////////////////////
    .declareService(function () {
      var gadget = this;
      var body = DOCUMENT.body;
      body.classList.remove("vsf-splash");
      launchCountdown(DEADLINE, gadget.element);
    })

    .declareService(function () {
      var gadget = this;
      return gadget.render(OPTION_DICT)
        .push(null, function (my_error) {
          throw my_error;

          // poor man's error handling
          var fragment = window.document.createDocumentFragment();
          var p = window.document.createElement("p");
          var br = window.document.createElement("br");
          var a = window.document.createElement("a");
          var body = window.document.getElementsByTagName('body')[0];
          p.classList.add("vsf-error");
          p.textContent = "Sorry, we messed up or your browser does not seem to support this application :( ";
          a.classList.add("vsf-error-link");
          a.textContent = "XXX";
          a.setAttribute("href", "XXX");
          fragment.appendChild(p);
          fragment.appendChild(br);
          fragment.appendChild(a);
  
          while (body.firstChild) {
            body.removeChild(body.firstChild);
          }
          body.appendChild(fragment);
        });
    })

    /////////////////////////////
    // on Event
    /////////////////////////////
    .onEvent("submit", function (event) {
      switch (event.target.getAttribute(NAME)) {
        case "vsf-select-language":
          return this.updateStorage(event.target.vsf_language.value);
        case "vsf-reminder":
          return this.createIcsFile(event.target);
      }
    });


}(window, rJS, RSVP, Date, ics, XMLHttpRequest, DOMParser, URL,
  loopEventListener, history, console));