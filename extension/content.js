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
      document.addEventListener("DOMContentLoaded", () => init(urlPatterns));
    } catch (error) {
      console.error("Failed to fetch or parse config.json:", error);
    }
  }
  
  // Create and style the pop-up element
  function createPopUp(linkElement) {
    console.log("Creating pop-up for link:", linkElement.href);
  
    const href = linkElement.href;
  
    // Create the pop-up container
    const popUp = document.createElement("div");
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
        <div class="antiphishing-popup" id="blockedLink" tabindex="-1" disabled style="max-width: 60%; overflow-y: auto; pointer-events: none;">${clonedLink.outerHTML}</div>
      </div>
      <button id="confirmBtn" disabled>Confirm</button>
      <button id="cancelBtn">Cancel</button>
    `;
  
    document.body.appendChild(popUp);
  
    // Enable confirm button after 2 seconds
    const confirmBtn = popUp.querySelector("#confirmBtn");
    const blockedLink = popUp.querySelector("#blockedLink");
    setTimeout(() => {
      blockedLink.disabled = false;
      confirmBtn.disabled = false
    }, 2000);
  
    // Event listeners for confirm and cancel buttons
    confirmBtn.addEventListener("click", () => {
      window.open(href, "_blank");
      popUp.remove();
    });
  
    popUp.querySelector("#cancelBtn").addEventListener("click", () => {
      popUp.remove();
    });
  }
  
  // Initialize click listeners based on URL patterns and selectors
  function init(urlPatterns) {
    const currentPageURL = window.location.href;
    console.log("Current page URL:", currentPageURL);
  
    // Find the matching config for the current page
    const matchedPattern = urlPatterns.find((pattern) => pattern.regex.test(currentPageURL));
  
    if (!matchedPattern) {
      console.log("No matching pattern for this page.");
      // return;
    }
  
    console.log("Matched pattern:", matchedPattern);

    if(matchedPattern === undefined) {
      // Fall back to all links if we don't have a pattern defined
      selector = "body";
    } else {
      selector = matchedPattern.selector;
    }
  
    // Select elements based on the selector from the config
    const matchingElements = document.querySelectorAll(selector);
    console.log("Matching elements:", matchingElements);
  
    matchingElements.forEach(apply_link_intercept);

    // Whenever a <a> tag is added to the page, apply the link intercept
    // Also apply it whenever the href attribute of a <a> tag is changed
    const _observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === "attributes" && mutation.attributeName === "href") {
          apply_link_intercept(mutation.target);
        } else if (mutation.type === "childList") {
          mutation.addedNodes.forEach(node => {
            if (node.tagName === "A" && !node.closest(".antiphishing-popup")) {
              apply_link_intercept(node);
            }
          });
        }
      });
    });
  }

  function apply_link_intercept(element) {
    const links = element.querySelectorAll("a"); // Find all <a> tags within the matching element
    links.forEach(link => {
      console.log("Adding event listener to link:", link.href);
      link.addEventListener("click", event => {
        event.preventDefault();
        createPopUp(link);
      });
    });
  }
  
  // Fetch the configuration and start the script
  fetchConfigAndInitialize();
  