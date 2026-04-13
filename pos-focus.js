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

  function applyPageState(page) {
    document.querySelectorAll(".page").forEach(function(node) {
      node.classList.toggle("active", node.id === "p-" + page);
    });
    document.querySelectorAll(".t-tab").forEach(function(tab) {
      tab.classList.toggle("active", tab.getAttribute("data-page") === page);
    });
  }

  function applyFocusMode() {
    document.body.classList.add("maestro-pos-focus");

    ["home", "admin", "staff", "site"].forEach(function(page) {
      var tab = document.querySelector('.t-tab[data-page="' + page + '"]');
      if (tab) tab.style.display = "none";
    });

    var posTab = document.querySelector('.t-tab[data-page="pos"]');
    if (posTab) posTab.classList.add("active");

    if (typeof window.forcePosPage === "function") {
      window.forcePosPage();
      return;
    }

    if (typeof window.showPage === "function") {
      window.showPage("pos");
      return;
    }

    applyPageState("pos");
  }

  function runFocusPasses() {
    applyFocusMode();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(applyFocusMode);
    }
    window.setTimeout(applyFocusMode, 120);
    window.setTimeout(applyFocusMode, 360);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runFocusPasses);
  } else {
    runFocusPasses();
  }
})();
