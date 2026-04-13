(function() {
  "use strict";

  if (typeof document === "undefined") return;

  var params = new URLSearchParams(window.location.search);
  var requestedMode = params.get("mode");
  var storedFocus = localStorage.getItem("lux_pos_focus");
  if (requestedMode !== "pos" && storedFocus !== "1") {
    localStorage.removeItem("lux_pos_focus");
    return;
  }

  localStorage.setItem("lux_pos_focus", "1");

  function applyFocusMode() {
    document.body.classList.add("maestro-pos-focus");

    ["home", "admin", "staff"].forEach(function(page) {
      var tab = document.querySelector('.t-tab[data-page="' + page + '"]');
      if (tab) tab.style.display = "none";
    });

    var posTab = document.querySelector('.t-tab[data-page="pos"]');
    if (posTab) posTab.classList.add("active");

    if (typeof window.showPage === "function") {
      window.showPage("pos");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFocusMode);
  } else {
    applyFocusMode();
  }

  var observer = new MutationObserver(function() {
    applyFocusMode();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
