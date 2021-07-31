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
  // XXX Copy/paste from renderjs
  function ajax(url) {
    var xhr;
    function resolver(resolve, reject) {
      function handler() {
        try {
          if (xhr.readyState === 0) {
            // UNSENT
            reject(xhr);
          } else if (xhr.readyState === 4) {
            // DONE
            if ((xhr.status < 200) || (xhr.status >= 300) ||
                (!/^text\/html[;]?/.test(
                  xhr.getResponseHeader("Content-Type") || ""
                ))) {
              reject(xhr);
            } else {
              resolve(xhr);
            }
          }
        } catch (e) {
          reject(e);
        }
      }

      xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.onreadystatechange = handler;
      xhr.setRequestHeader('Accept', 'text/html');
      xhr.withCredentials = true;
      xhr.send();
    }
    function canceller() {
      if ((xhr !== undefined) && (xhr.readyState !== xhr.DONE)) {
        xhr.abort();
      }
    }
    return new RSVP.Promise(resolver, canceller);
  }

  function removeHash(url) {
    var index = url.indexOf('#');
    if (index > 0) {
      url = url.substring(0, index);
    }
    return url;
  }

  function scrollToHash(hash) {
    var scroll_element = null;

    if (hash) {
      hash = hash.split('#', 2)[1];
      if (hash === undefined) {
        hash = "";
      }
      if (hash) {
        scroll_element = document.querySelector(hash);
      }
    }

    if (scroll_element === null) {
      window.scrollTo(0, 0);
    } else {
      scroll_element.scrollIntoView(true);
    }

  }

  function parseLanguageElement(language_element) {
    var language_list = [],
      li_list = language_element.querySelectorAll('a'),
      i;
    for (i = 0; i < li_list.length; i += 1) {
      language_list.push({
        href: li_list[i].href,
        text: li_list[i].hreflang
      });
    }
    return language_list;
  }

  function parseSitemapElement(sitemap_element) {
    var a = sitemap_element.querySelector('a'),
      sitemap = {
        href: a.href,
        text: a.textContent,
        child_list: []
      },
      ul = a.nextElementSibling,
      li_list,
      i;

    if (ul === null) {
      li_list = [];
    } else {
      li_list = ul.children;
    }
    for (i = 0; i < li_list.length; i += 1) {
      sitemap.child_list.push(parseSitemapElement(li_list[i]));
    }
    return sitemap;
  }

  function parseDocumentListElement(document_list_element) {
    var document_list = [],
      li_list,
      i;
    if (document_list_element === null) {
      return document_list;
    }

    li_list = document_list_element.querySelectorAll('a');
    for (i = 0; i < li_list.length; i += 1) {
      document_list.push({
        href: li_list[i].href,
        text: li_list[i].textContent
      });
    }
    return document_list;
  }

  function parseFormElement(form_element) {
    if (form_element !== null) {
      return form_element.outerHTML;
    }
    return;
  }

  function parseStatusMessage(status_element, information_element) {
    var result = "";
    if (status_element !== null) {
      result = status_element.textContent;
    }
    if (information_element !== null) {
      result = information_element.textContent;
    }
    return result;
  }

  function parsePageContent(body_element, base_uri) {
    var i,
      element,
      element_list,
      j,
      url_attribute_list = ['src', 'href', 'srcset', 'action'],
      url_attribute,
      url_attribute_value;

    if (base_uri !== undefined) {
      // Rewrite relative url (copied from renderjs)
      for (j = 0; j < url_attribute_list.length; j += 1) {
        url_attribute = url_attribute_list[j];
        element_list = body_element.querySelectorAll(
          '[' + url_attribute + ']'
        );
        for (i = 0; i < element_list.length; i += 1) {
          element = element_list[i];
          url_attribute_value = element.getAttribute(url_attribute);
          if (url_attribute_value.charAt(0) !== "#") {
            element.setAttribute(url_attribute, new URL(
              url_attribute_value,
              base_uri
            ).href);
          }
        }
      }

    }

    return {
      original_content: body_element.innerHTML,
      html_content: body_element.querySelector('.page-content').innerHTML,
      //language_list: parseLanguageElement(
      //  body_element.querySelector('nav#language')
      //),
      //sitemap: parseSitemapElement(
      //  body_element.querySelector('nav#sitemap')
      //),
      document_list: parseDocumentListElement(
        body_element.querySelector('aside#document_list')
      ),
      form_html_content: parseFormElement(
        body_element.querySelector('form#main_form')
      ),
      portal_status_message: parseStatusMessage(
        body_element.querySelector('p#portal_status_message'),
        body_element.querySelector('p#information_area')
      )
    };
  }

  function renderPage(gadget, page_url, hash) {
    return new RSVP.Queue(RSVP.hash({
      xhr: ajax(page_url)
      //xhr: ajax(page_url),
      //style_gadget: gadget.getDeclaredGadget('renderer')
    }))
      .push(function (result_dict) {
        var dom_parser = (new DOMParser()).parseFromString(
          result_dict.xhr.responseText,
          'text/html'
        ),
          page_content,
          parsed_content;
        //if (gadget.style_gadget_url !== new URL(
        //    dom_parser.body
        //              .getAttribute("data-nostyle-gadget-url"),
        //    dom_parser.baseURI
        //  ).href
        //    ) {
        //  // If the HTML is not supposed to be rendered
        //  // with the same js style gadget,
        //  // consider this must be reloaded
        //  throw new Error('Trigger an error to force reload');
        //}
        page_content = gadget.element.querySelector(".page-content");
        parsed_content = parsePageContent(dom_parser.body, dom_parser.baseURI);
        gadget.parsed_content = parsed_content;
        parsed_content.page_title = dom_parser.title;
        page_content.innerHTML = parsed_content.html_content;
        window.componentHandler.upgradeDom();
        return gadget.fetchTranslationAndUpdateDom(gadget.state.locale);
        //return result_dict.style_gadget.render(parsed_content.html_content,
        //                                       parsed_content);
      })
      .push(function () {
        return scrollToHash(hash);
      });
  }

  function listenURLChange() {
    var gadget = this;

    // prevent automatic page location restoration
    if (history.scrollRestoration) {
      history.scrollRestoration = 'manual';
    }

    function handlePopState() {
      return renderPage(gadget, window.location.href, window.location.hash);
    }

    function handleClick(evt) {
      var target_element = evt.target.closest('a'),
        base_uri = document.baseURI,
        link_url;

      if (!target_element) {
        // Only handle link
        return;
      }
      if (target_element.target === "_blank") {
        // Open in a new tab
        return;
      }
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return;
      }
      link_url = new URL(target_element.href, base_uri);

      if (base_uri.indexOf(link_url.origin) !== 0) {
        // No need to query from another domain
        return;
      }

      if (link_url.hash) {
        // If new link has an hash, check if the path/query parts are identical
        // if so, do not refresh the content and
        // let browser scroll to the correct element
        if (removeHash(link_url.href) === removeHash(window.location.href)) {
          return;
        }
      }

      evt.preventDefault();
      return renderPage(gadget, target_element.href, link_url.hash)
        .push(function () {
          // Important: pushState must be called AFTER the page rendering
          // to ensure popstate listener is correctly working
          // when the user will click on back/forward browser buttons
          history.pushState(null, null, target_element.href);
        }, function (error) {
          console.warn('Cant render the page', error);
          // Implement support for managed error
          // (like URL is not an HTML document parsable)
          // and redirect in such case
          window.location = target_element.href;
        });
    }

    return RSVP.all([
      loopEventListener(window, 'popstate', false, handlePopState, false),
      loopEventListener(gadget.element, 'click', false, handleClick,
                        true)
    ]);
  }
  
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
    .allowPublicAcquisition("reportServiceError", function () {
      this.element.hidden = false;
      throw rJS.AcquisitionError();
    })

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
    .declareJob("listenURLChange", listenURLChange)

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

    .declareService(function () {
      var gadget = this,
        style_gadget,
        body = gadget.element,
        style_gadget_url = body.getAttribute("data-nostyle-gadget-url"),
        style_css_url = body.getAttribute("data-nostyle-css-url"),
        parsed_content;

      if (!style_gadget_url) {
        // No style configured, use backend only rendering
        // return rJS.declareCSS(style_css_url, document.head);
        // Hijack
        return new RSVP.Queue()
          .push(function () {
            gadget.listenURLChange();
            gadget.element.hidden = false;
            scrollToHash(window.location.hash);
          }, function (error) {
            gadget.element.hidden = false;
            throw error;
          });
      }

      parsed_content = parsePageContent(gadget.element);
      gadget.parsed_content = parsed_content;
      parsed_content.page_title = document.title;
      gadget.style_gadget_url =
        new URL(style_gadget_url, document.baseURI).href;
      // Clear the DOM
      while (body.firstChild) {
        body.firstChild.remove();
      }
      return gadget.declareGadget(style_gadget_url, {scope: 'renderer'})
        .push(function (result) {
          style_gadget = result;
          return style_gadget.render(parsed_content.html_content,
                                     parsed_content)
            .push(function () {
              // Trigger URL handling
              gadget.listenURLChange();

              body.appendChild(style_gadget.element);
              gadget.element.hidden = false;
              scrollToHash(window.location.hash);
            }, function (error) {
              gadget.element.hidden = false;
              throw error;
            });
        }, function (error) {
          console.warn('Cant load the style gadget', error);
          return new RSVP.Queue(rJS.declareCSS(style_css_url, document.head))
            .push(function () {
              // Set again the page content after the css is loaded
              // to prevent ugly rendering
              gadget.element.innerHTML = parsed_content.original_content;
            });
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