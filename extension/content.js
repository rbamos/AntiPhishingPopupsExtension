(() => {

  var popUp = null;
  var shadow = null;

  // Fetch configuration and initialize listeners
  async function fetchConfigAndInitialize() {
    console.log("Fetching config.json...");
    const configURL = chrome.runtime.getURL("config.json");
    try {
      const response = await fetch(configURL);
      const config = await response.json();
      console.log("Config loaded:", config);

      // Convert config to a usable format
      const urlPatterns = Object.keys(config).map(pattern => ({
        regex: new RegExp(pattern),
        selector: config[pattern]
      }));
      console.log("URL patterns processed:", urlPatterns);

      // Attach listeners based on config
      initAntiPhishing(urlPatterns);
    } catch (error) {
      console.error("Failed to fetch or parse config.json:", error);
    }
  }


  // Create and style the pop-up element
  function createPopUp(linkElement) {
    console.log("Creating pop-up for link:", linkElement.href);

    if(shadow == null) {
      popupContainer = document.createElement("div");
      popupContainer.style.maxWidth = "100%";
      document.body.appendChild(popupContainer);
      shadow = popupContainer.attachShadow({ mode: "open" });
    }

    const href = linkElement.href;

    // Create the pop-up container
    popUp = document.createElement("div");
    popUp.style.position = "fixed";
    popUp.style.top = "50%";
    popUp.style.left = "50%";
    popUp.style.transform = "translate(-50%, -50%)";
    popUp.style.zIndex = "10000";
    popUp.style.background = "white";
    popUp.style.border = "1px solid black";
    popUp.style.padding = "10px";
    popUp.style.boxShadow = "0px 0px 10px rgba(0, 0, 0, 0.5)";
    popUp.style.textAlign = "center";
    popUp.style.maxWidth = "70%";

    // Copy attributes from the original link
    const clonedLink = document.createElement("a");
    for (const attr of linkElement.attributes) {
      clonedLink.setAttribute(attr.name, attr.value);
    }
    clonedLink.textContent = href;

    popUp.innerHTML = `
      <p>Do you want to visit this link?</p>
      <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
        <div id="linkdiv" class="antiphishing-popup" style="max-width: 60%; overflow-y: auto; ">${href}</div>
      </div>
      <p/>
      <button id="cancelBtn">Cancel</button>
    `;

    shadow.appendChild(popUp);

    const cancelButton = popUp.querySelector("#cancelBtn");

    cancelButton.style.all = 'initial';
    cancelButton.style.display = 'inline-block';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.border = '1px solid #ccc';
    cancelButton.style.backgroundColor = '#f0f0f0';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.textAlign = 'center';
    cancelButton.style.textDecoration = 'none';
    cancelButton.style.color = '#000';
    cancelButton.style.fontFamily = 'inherit';
    cancelButton.style.fontSize = 'inherit';


    linkdiv = popUp.querySelector("#linkdiv")

    // Enable link after 2 seconds
    setTimeout(() => {
      linkdiv.innerHTML = clonedLink.outerHTML;
    }, 2000);

    popUp.querySelector("#cancelBtn").addEventListener("click", () => {
      popUp.remove();
      popUp = null;
    });

    console.log("Pop-up created:", popUp);
  }

  // Initialize click listeners based on URL patterns and selectors
  function initAntiPhishing(urlPatterns) {
    const currentPageURL = window.location.href;
    console.log("Current page URL:", currentPageURL);

    // if the page is a configuration page, do not apply the link intercept
    configuration_pages = ["about:", "chrome://"];
    for (const page of configuration_pages) {
      if (currentPageURL.startsWith(page)) {
        console.log("Skipping link intercept for configuration page.");
        return;
      }
    }

    // Find the matching config for the current page
    const matchedPattern = urlPatterns.find((pattern) => pattern.regex.test(currentPageURL));

    if (!matchedPattern) {
      console.log("No matching pattern for this page.");
      // return;
    }

    console.log("Matched pattern:", matchedPattern);

    if (matchedPattern === undefined) {
      // Fall back to all links if we don't have a pattern defined
      selector = ":root";
    } else {
      selector = matchedPattern.selector;
    }

    selector = ":root";

    // Select elements based on the selector from the config
    const matchingElements = document.querySelectorAll(selector);
    console.log("Matching elements:", matchingElements);

    matchingElements.forEach(apply_link_intercept);

    // Whenever a <a> tag is added to the page, apply the link intercept
    // Also apply it whenever the href attribute of a <a> tag is changed
    const observer = new MutationObserver(mutationHandler);
    const observerOptions = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"]
    };

    matchingElements.forEach((element) => {
      observer.observe(element, observerOptions);
    }
    );


    // Also apply observer to all shadow roots
    // https://github.com/whatwg/dom/issues/1287
    let originalAttachShadow = HTMLElement.prototype.attachShadow;
    HTMLElement.prototype.attachShadow = function (...args) {
      let node = originalAttachShadow.call(this, ...args);
      observer.observe(node, observerOptions);
      return node;
    }

    
    // Close the pop-up if the user clicks outside of it or presses escape
    // document.addEventListener("click", (event) => {
    //   if (popUp != null && !popUp.contains(event.target)) {
    //     popUp.remove();
    //     popUp = null;
    //   }
    // });
    document.addEventListener("keydown", (event) => {
      if (popUp != null && event.key === "Escape") {
        popUp.remove();
        popUp = null;
      }
    });

  }

  function mutationHandler(mutations) {
    mutations.forEach(mutation => {
      if (mutation.type === "attributes" && mutation.attributeName === "href") {
        apply_link_intercept(mutation.target);
      } else if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === "A" && !node.closest(".antiphishing-popup")) {
            apply_link_intercept(node);
          }
        });
      } else {
        console.log("Unhandled mutation type:", mutation);
      }
    });
  }

  function apply_link_intercept(element) {
    const links = element.querySelectorAll("a"); // Find all <a> tags within the matching element
    console.log("Links found:", links);

    // Don't apply the link intercept to the pop-up itself
    if (popUp != null && !popUp.contains(element)) {
      console.log("Skipping self application");
      return;
    }

    links.forEach(link => {
      // Don't apply the link intercept to the pop-up itself
      // We do this check twice in case the parent isn't part of the pop-up
      // but the child is; this seems unlikely though
      if (popUp != null && popUp.contains(link)) {
        console.log("Skipping self application");
        return;
      }

      // If the link applies to the current page with a fragment identifier, don't apply the link intercept
      var location = link.href.split("#")[0];
      if (location == window.location.href || location == '') {
        console.log("Skipping fragment identifier link");
        return;
      }

      console.log("Adding event listener to link: ", link.href, link);
      link.addEventListener("click", event => {
        event.preventDefault();
        if (popUp != null) {
          popUp.remove();
          popUp = null;
        }
        createPopUp(link);
      });
    });
  }

  // Fetch the configuration and start the script
  fetchConfigAndInitialize();

})();