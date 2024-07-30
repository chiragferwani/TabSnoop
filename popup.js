document.addEventListener('DOMContentLoaded', function() {
  const reportDiv = document.getElementById('report');
  const resetButton = document.getElementById('reset');
  const focusButton = document.getElementById('focus');
  const timerDiv = document.getElementById('timer');
  const streakDiv = document.getElementById('streak');
  const modeToggle = document.getElementById('modeToggle');
  const body = document.body;

  // Load stored mode preference
  chrome.storage.local.get(['mode', 'timeData', 'streak'], function(result) {
    if (result.mode === 'dark') {
      body.classList.add('dark-mode');
      modeToggle.checked = true;
    } else {
      body.classList.add('light-mode');
    }

    if (result.timeData) {
      updateReport(result.timeData);
    } else {
      reportDiv.innerHTML = '<p style="text-align: center;">No data recorded yet.</p>';
    }

    if (result.streak !== undefined) {
      streakDiv.innerHTML = `Streak: <img src="icons/fire.png" height="6%" width="6%" alt="fireimg">${result.streak}`;
    } else {
      streakDiv.innerHTML = 'Streak: <img src="icons/fire.png" height="6%" width="6%" alt="fireimg">0';
    }
  });

  // Toggle between light and dark mode
  modeToggle.addEventListener('change', function() {
    if (modeToggle.checked) {
      body.classList.remove('light-mode');
      body.classList.add('dark-mode');
      chrome.storage.local.set({ mode: 'dark' });
    } else {
      body.classList.remove('dark-mode');
      body.classList.add('light-mode');
      chrome.storage.local.set({ mode: 'light' });
    }
  });

  // Reset data button
  resetButton.addEventListener('click', function() {
    chrome.storage.local.set({ timeData: {}, streak: 0 }, function() {
      reportDiv.innerHTML = '<p style="text-align: center;">Data Reset.</p>';
      streakDiv.innerHTML = 'Streak: 0';
    });
  });

  // Focus mode button
  focusButton.addEventListener('click', function() {
    chrome.storage.local.get(['focusEndTime'], function(result) {
      const endTime = result.focusEndTime;
      if (endTime && endTime > Date.now()) {
        stopFocusMode();
      } else {
        startFocusMode();
      }
    });
  });

  // Function to update the report display
  function updateReport(timeData) {
    let totalMinutes = 0;
    let visitedWebsites = Object.keys(timeData);

    for (const time of Object.values(timeData)) {
      totalMinutes += Math.round(time / 1000 / 60);
    }

    let reportHtml = `<p style="text-align: center;">Total time spent: ${totalMinutes} minutes</p>`;
    reportHtml += '<ul>';
    for (const domain of visitedWebsites) {
      reportHtml += `<li>${domain}</li>`;
    }
    reportHtml += '</ul>';

    if (visitedWebsites.length === 0) {
      reportDiv.innerHTML = '<p style="text-align: center;">No data recorded yet.</p>';
    } else {
      reportDiv.innerHTML = reportHtml;
    }
  }

  // Function to start focus mode
  function startFocusMode() {
    const focusTime = 30 * 60 * 1000; // 30 minutes in milliseconds
    const endTime = Date.now() + focusTime;
    chrome.storage.local.set({ focusEndTime: endTime }, function() {
      chrome.runtime.sendMessage({ action: "startFocusMode", endTime: endTime });
      focusButton.textContent = "Stop Focus";
    });
  }

  // Function to stop focus mode
  function stopFocusMode() {
    chrome.storage.local.remove('focusEndTime', function() {
      chrome.runtime.sendMessage({ action: "stopFocusMode" });
      focusButton.textContent = "Start Focus Mode (30 mins)";
      timerDiv.textContent = '';
    });
  }

  // Update timer display based on messages from the background script
  chrome.runtime.onMessage.addListener(function(message) {
    if (message.action === "updateTimer") {
      const remainingTime = message.remainingTime;
      let minutes = Math.floor(remainingTime / 1000 / 60);
      let seconds = Math.floor((remainingTime / 1000) % 60);
      timerDiv.textContent = `Focus mode: ${minutes}m ${seconds}s remaining`;
    } else if (message.action === "focusModeEnded") {
      timerDiv.textContent = 'Focus mode ended.';
      focusButton.textContent = "Start Focus Mode (30 mins)";
    } else if (message.action === "incrementStreak") {
      streakDiv.innerHTML = `Streak: ${message.streak}`;
    }
  });

  // Check if focus mode is already active and update the timer display
  chrome.storage.local.get(['focusEndTime'], function(result) {
    const endTime = result.focusEndTime;
    if (endTime && endTime > Date.now()) {
      chrome.runtime.sendMessage({ action: "getFocusModeStatus" });
      focusButton.textContent = "Stop Focus";
    } else {
      focusButton.textContent = "Start Focus Mode (30 mins)";
    }
  });
});
