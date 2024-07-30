let focusTimer;
let activeTabId = null;
let activeDomain = null;
let timeData = {};
let lastActiveTime = Date.now();

// Track active tab changes
chrome.tabs.onActivated.addListener(updateActiveTab);
chrome.windows.onFocusChanged.addListener(updateActiveTab);
chrome.tabs.onUpdated.addListener(updateActiveTab);

function updateActiveTab() {
  const currentTime = Date.now();

  if (activeDomain !== null) {
    if (!timeData[activeDomain]) {
      timeData[activeDomain] = 0;
    }
    timeData[activeDomain] += currentTime - lastActiveTime;
  }

  lastActiveTime = currentTime;

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length > 0) {
      activeTabId = tabs[0].id;
      const url = new URL(tabs[0].url);
      activeDomain = url.hostname;
    } else {
      activeTabId = null;
      activeDomain = null;
    }
  });

  chrome.storage.local.set({ timeData: timeData });
}

// Save time data periodically
setInterval(() => {
  const currentTime = Date.now();

  if (activeDomain !== null) {
    if (!timeData[activeDomain]) {
      timeData[activeDomain] = 0;
    }
    timeData[activeDomain] += currentTime - lastActiveTime;
    lastActiveTime = currentTime;
    chrome.storage.local.set({ timeData: timeData });
  }
}, 1000);

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "startFocusMode") {
    const endTime = message.endTime;
    startFocusMode(endTime);
  } else if (message.action === "getFocusModeStatus") {
    if (focusTimer) {
      const remainingTime = focusTimer.endTime - Date.now();
      if (remainingTime > 0) {
        chrome.runtime.sendMessage({ action: "updateTimer", remainingTime: remainingTime });
      } else {
        clearInterval(focusTimer.intervalId);
        chrome.runtime.sendMessage({ action: "focusModeEnded" });
      }
    }
  } else if (message.action === "stopFocusMode") {
    stopFocusMode();
  }
});

function startFocusMode(endTime) {
  clearInterval(focusTimer);

  focusTimer = {
    endTime: endTime,
    intervalId: setInterval(function() {
      const remainingTime = endTime - Date.now();
      if (remainingTime <= 0) {
        clearInterval(focusTimer.intervalId);
        chrome.runtime.sendMessage({ action: "focusModeEnded" });
        chrome.storage.local.remove("focusEndTime");
        incrementStreak();
      } else {
        chrome.runtime.sendMessage({ action: "updateTimer", remainingTime: remainingTime });
      }
    }, 1000)
  };
}

function stopFocusMode() {
  clearInterval(focusTimer.intervalId);
  focusTimer = null;
  chrome.runtime.sendMessage({ action: "focusModeEnded" });
}

function incrementStreak() {
  chrome.storage.local.get(['streak'], function(result) {
    let streak = result.streak || 0;
    streak += 1;
    chrome.storage.local.set({ streak: streak }, function() {
      chrome.runtime.sendMessage({ action: "incrementStreak", streak: streak });
    });
  });
}
