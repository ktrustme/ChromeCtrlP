var R = require('ramda');

var allTabs = [];

var currentTabIndex = 0;

/**
 * {
 *   currentWindowId: windowId1,
 *   windowId1: {
 *      currentTabId: 1234,
 *      lastTabId: 12345,
 *      prevViewedTabs: [1234, 135, 892...]
 *      futureViewdTabs: [],
 *      jumpMode: true
 *   }
 * }
 */
var tabStorage = {};

function getCurrentTabIndex(){
    return currentTabIndex;
}

function updateCurrentTab(windowId, tabId){
    tabStorage.currentWindowId = windowId;
    if (tabStorage[windowId] == null) {
        initTabStorage(windowId, tabId);
    }
    // update tab jump list
    if (tabStorage[windowId].currentTabId != tabId) {
        if (tabStorage[windowId].jumpMode) {
            tabStorage[windowId].jumpMode = false;
        } else if(tabStorage[windowId].currentTabId != getLastElementInList(tabStorage[windowId])) {
            tabStorage[windowId].prevViewedTabs.push(tabStorage[windowId].currentTabId);
        }
        tabStorage[windowId].lastTabId = tabStorage[windowId].currentTabId
        tabStorage[windowId].currentTabId = tabId;
    }

    chrome.tabs.getSelected((tab) => {
        currentTabIndex = tab.index;
    });
}

function getLastElementInList(l) {
    return getLastNthElementInList(l, 1)
}

function getLastNthElementInList(l, n) {
    return l[l.length-n]
}

function getAllTabs() {
    return allTabs;
}

function getAllTabsOfCurrentWindow(callback) {
    getAllTabsOfWindow(chrome.windows.WINDOW_ID_CURRENT, callback);
}

function getAllTabsOfWindow(windowId, callback) {
    chrome.tabs.query({windowId: windowId}, function(Tabs) {
        callback(Tabs);
    });
}

function updateAllTabs() {
    getAllTabsOfCurrentWindow(function(tabs){
        allTabs = tabs;
    });
}

function initTabStorage(windowId, tabId) {
    tabStorage.currentWindowId = windowId;
    if (tabStorage[windowId] == null) {
        tabStorage[windowId] = {};
        tabStorage[windowId].currentTabId = tabId;
        tabStorage[windowId].lastTabId = tabId;
        tabStorage[windowId].prevViewedTabs = [];
        tabStorage[windowId].futureViewedTabs = [];
    }
}

function getCurrentTab(tabCallback) {
    chrome.tabs.query(
        { currentWindow: true, active: true },
        function (tabArray) { tabCallback(tabArray[0]); }
    );
}

// Initialization
getCurrentTab((currentTab) => {
    initTabStorage(currentTab.windowId, currentTab.id);
    updateAllTabs();
});

document.addEventListener('DOMContentLoaded', function(){
    // tabs event listener
    chrome.tabs.onCreated.addListener((tab) => {
        // destroy future viewed tab list
        tabStorage[tabStorage.currentWindowId].futureViewedTabs = [];
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
        // remove this tab id from jump list
        tabStorage[tabStorage.currentWindowId].prevViewedTabs = R.filter(
            (e) => e != tabId, tabStorage[tabStorage.currentWindowId].prevViewedTabs);
        tabStorage[tabStorage.currentWindowId].futureViewedTabs = R.filter(
            (e) => e != tabId, tabStorage[tabStorage.currentWindowId].futureViewedTabs);
        tabStorage[tabStorage.currentWindowId].jumpMode = true;
        updateAllTabs();
    });

    chrome.tabs.onUpdated.addListener(updateAllTabs);

    chrome.tabs.onMoved.addListener(updateAllTabs);

    chrome.tabs.onActivated.addListener((activeInfo) => {
        updateCurrentTab(activeInfo.windowId, activeInfo.tabId)});

    chrome.windows.onFocusChanged.addListener(updateAllTabs);

    chrome.windows.onRemoved.addListener((windowId) => delete tabStorage[windowId])

    // toggle between current tab and previous viewed tabs
    chrome.commands.onCommand.addListener(function(command) {
        if (command === "goto-last-viewed-tab") {
            var lastViewedTabId = tabStorage[tabStorage.currentWindowId].prevViewedTabs.pop();
            if (lastViewedTabId === undefined)
                return;
            tabStorage[tabStorage.currentWindowId].futureViewedTabs.push(
                tabStorage[tabStorage.currentWindowId].currentTabId);
            tabStorage[tabStorage.currentWindowId].jumpMode = true;
            chrome.tabs.update(lastViewedTabId , {active: true, highlighted:true});
        } else if (command === "goto-next-viewed-tab") {
            var nextViewedTabId = tabStorage[tabStorage.currentWindowId].futureViewedTabs.pop();
            if (nextViewedTabId === undefined)
                return;
            tabStorage[tabStorage.currentWindowId].prevViewedTabs.push(
                tabStorage[tabStorage.currentWindowId].currentTabId);
            tabStorage[tabStorage.currentWindowId].jumpMode = true;
            chrome.tabs.update(nextViewedTabId, {active: true, highlighted:true});
        } else {
            tabStorage[tabStorage.currentWindowId].jumpMode = true;
            chrome.tabs.update(tabStorage[tabStorage.currentWindowId].lastTabId, {active: true, highlighted:true});
        }
    });

    if (!window.getAllTabs){
        window.getAllTabs= getAllTabs;
    }
    if (!window.getAllTabsOfCurrentWindow){
        window.getAllTabsOfCurrentWindow = getAllTabsOfCurrentWindow;
    }
    if (!window.getCurrentTabIndex){
        window.getCurrentTabIndex= getCurrentTabIndex;
    }
});
