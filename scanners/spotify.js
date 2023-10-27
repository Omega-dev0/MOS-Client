let extensionState;
let extensionSettings;
let extensionScannerState;
let interval;

let allowed = false;
let TAB_ID;

let snapshot;


const platform = "spotify"




//UTILITY
function getTimeFromTimeString(str, divider) {
  let split = str.split(divider);
  if (split.length == 1) {
    return parseInt(str);
  } else if (split.length == 2) {
    return parseInt(split[0]) * 60 + parseInt(split[1]);
  } else if (split.length == 3) {
    return parseInt(split[0]) * 3600 + parseInt(split[1]) * 60 + parseInt(split[2]);
  }
}

function sendMessage(msg){
  chrome.runtime.sendMessage(msg)
}

//GETS DATA FROM STORAGE
async function onLaunch() {
  extensionState = (await chrome.storage.local.get("extension-state"))["extension-state"];
  extensionSettings = (await chrome.storage.local.get("extension-settings"))["extension-settings"];

  //GET TAB
  let res = await chrome.runtime.sendMessage({ key: "listener-register", data: { platform: platform, title: document.title } });
  TAB_ID = res.tabId;
  if (extensionState.selectedScanner != TAB_ID || TAB_ID != undefined) {
    return;
  }
  allowed = true;
}

new MutationObserver(function (mutations) {
  //Tab title changed
  sendMessage({ key: "listener-update", data: { platform: platform, title: document.title } });
}).observe(document.querySelector("title"), { subtree: true, characterData: true, childList: true });

//UPDATE
let data = null;
function update(forceUpdate) {
  if (allowed != true) {
    return;
  }
  data = getData();
  if (JSON.stringify(data) == JSON.stringify(snapshot) && forceUpdate != true) {
    return; // ALREADY UPDATED
  }

  chrome.storage.local.set({
    "extension-scanner-state": {
      paused: data.paused,
      title: data.title,
      subtitle: data.subtitle,
      currentTime: getTimeFromTimeString(data.progress, ":"),
      currentLength: getTimeFromTimeString(data.duration, ":"),
      url: data.url,
      cover: data.cover,
    },
  });
  if (!snapshot) {
    sendMessage({ key: "sync-server" });
  } else {
    if (JSON.stringify(snapshot) != JSON.stringify(data)) {
      sendMessage({ key: "sync-server" });
    }
  }
  snapshot = data;
}

//GETS DATA FROM PAGE
function getData() {
  return {
    url: document.querySelector(`a[data-testid="context-item-link"]`).href,
    subtitle: (document.querySelector(`a[data-testid="context-item-info-artist"]`) ||  document.querySelector(`a[data-testid="context-item-info-show"]`)).innerHTML,
    title: document.querySelector(`a[data-testid="context-item-link"]`).innerHTML,
    cover: document.querySelector(`img[data-testid="cover-art-image"]`).src.replace("4851","1e02"),
    progress: document.querySelector(`div[data-testid="playback-position"]`).innerHTML,
    duration: document.querySelector(`div[data-testid="playback-duration"]`).innerHTML,
    paused: !(document.querySelector(`button[data-testid="control-button-playpause"]`).ariaLabel == "Pause"),
  };
}

//MAKES SURE DATA FROM DB IS UP TO DATE
chrome.storage.onChanged.addListener(async (object, areaName) => {
  if (areaName != "local") {
    return;
  }
  if (object["extension-state"] != undefined) {
    extensionState = object["extension-state"].newValue;
    if (extensionState.selectedScanner == TAB_ID && TAB_ID != undefined && extensionState.stopped == false) {
      allowed = true;
      update(true);
    } else {
      allowed = false;
    }
  }
  if (object["extension-settings"] != undefined) {
    extensionSettings = object["extension-settings"].newValue;
  }
  if (object["extension-scanner-state"] != undefined) {
    extensionScannerState = object["extension-scanner-state"].newValue;
  }
});

console.log(`MOS - ${platform} Scanner ready`);
onLaunch();

setInterval(update, 1000);
