const TOTAL_MS = 30 * 1000;

const timerEl = document.getElementById("timer");
const mainButton = document.getElementById("main-button");
const resetButton = document.getElementById("reset-button");
const artEl = document.getElementById("art");
const artWrapEl = document.querySelector(".art-wrap");
const detailsSlot = document.getElementById("details-slot");
const messageSlot = document.getElementById("message-slot");
const loadingEl = document.getElementById("loading");
const paintingEl = document.getElementById("painting");

const MET_API = "https://collectionapi.metmuseum.org/public/collection/";
const SEARCH_URL = MET_API + "v1.1/search?hasImages=true&departmentId=11&isHighlight=true&q=painting";
const OBJECT_URL = MET_API + "v1/objects/";

const MAX_TRIES = 5; // paintings to try before giving up
const WAIT_LIMIT_MS = 10 * 1000; // longest wait for the museum or a picture
const PAUSE_MS = 1000; // pause between tries, so the museum is not flooded
const BUSY_PAUSE_MS = 2000; // longer pause if the museum says "too many requests"

let state = "idle"; // idle, running, paused or finished
let paintingDetails = null; // name, artist and year of the painting on the page
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;
let frameId = null;
let latestLoad = 0;
let loadController = null; // cancels the tries that are running

// The blur is the share of time left: 1 (strong) at the start, 0 (sharp) at 00:00.
function blurFraction() {
  const ms = state === "running" ? Math.max(0, endTime - Date.now()) : remainingMs;
  return ms / TOTAL_MS;
}

function applyBlur() {
  artWrapEl.style.setProperty("--p", blurFraction());
}

// Clears the blur smoothly while the timer runs, working from the clock.
function animateBlur() {
  applyBlur();
  if (state === "running") frameId = requestAnimationFrame(animateBlur);
}

// Shows one of: "placeholder", "loading" or "painting".
function showArtwork(which) {
  artEl.hidden = which !== "placeholder";
  loadingEl.hidden = which !== "loading";
  paintingEl.hidden = which !== "painting";
}

// Asks the museum, giving up after WAIT_LIMIT_MS or when the tries are cancelled.
async function fetchJson(url, cancelSignal) {
  const request = new AbortController();
  const timer = setTimeout(function () { request.abort(); }, WAIT_LIMIT_MS);
  cancelSignal.addEventListener("abort", function () { request.abort(); }, { once: true });
  try {
    const response = await fetch(url, { signal: request.signal });
    if (!response.ok) {
      const error = new Error("Request failed");
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function preloadImage(url) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    const timer = setTimeout(function () {
      image.src = "";
      reject(new Error("Picture too slow"));
    }, WAIT_LIMIT_MS);
    image.onload = function () { clearTimeout(timer); resolve(); };
    image.onerror = function () { clearTimeout(timer); reject(new Error("Picture failed")); };
    image.src = url;
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// A usable result is a painting with a link to a photo.
function isUsablePainting(painting) {
  const kind = (painting.classification || "") + " " + (painting.objectName || "");
  return /paint/i.test(kind) && Boolean((painting.primaryImageSmall || "").trim());
}

function showMessage(visible) {
  if (!visible) {
    messageSlot.replaceChildren();
    return;
  }
  const box = document.createElement("div");
  box.className = "notice";
  const text = document.createElement("div");
  text.className = "message";
  text.textContent = "We couldn't load a painting this time.";
  const retry = document.createElement("button");
  retry.className = "pill soft retry";
  retry.type = "button";
  retry.textContent = "Try again";
  retry.addEventListener("click", loadPainting);
  box.append(text, retry);
  messageSlot.replaceChildren(box);
}

// Picks a random painting that has a photo, trying up to MAX_TRIES different
// paintings. The details come from the same answer as the picture, so they
// always belong together. They are kept out of the page until the timer finishes.
async function loadPainting() {
  const thisLoad = ++latestLoad;
  if (loadController) loadController.abort();
  const controller = new AbortController();
  loadController = controller;
  paintingDetails = null;
  showMessage(false);
  showArtwork("loading");

  let ids = [];
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    let wait = PAUSE_MS;
    try {
      if (ids.length === 0) {
        const search = await fetchJson(SEARCH_URL, controller.signal);
        ids = Array.isArray(search.objectIDs) ? search.objectIDs.slice() : [];
        if (ids.length === 0) throw new Error("Nothing found");
      }
      const id = ids.splice(Math.floor(Math.random() * ids.length), 1)[0];
      const painting = await fetchJson(OBJECT_URL + id, controller.signal);
      if (!isUsablePainting(painting)) throw new Error("Not a usable painting");
      const imageUrl = painting.primaryImageSmall.trim();
      await preloadImage(imageUrl);
      if (thisLoad !== latestLoad) return;
      paintingEl.src = imageUrl;
      paintingDetails = {
        name: painting.title,
        artist: painting.artistDisplayName,
        year: painting.objectDate,
        link: painting.objectURL,
      };
      applyBlur();
      showArtwork("painting");
      if (state === "finished") showDetails();
      return;
    } catch (error) {
      if (thisLoad !== latestLoad) return;
      if (error.status === 403 || error.status === 429) wait = BUSY_PAUSE_MS;
    }
    if (attempt < MAX_TRIES) {
      await sleep(wait);
      if (thisLoad !== latestLoad) return;
    }
  }
  showArtwork("placeholder");
  showMessage(true);
}

function render() {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  timerEl.textContent = minutes + ":" + seconds;
}

// Works out the time left from the clock, so it stays right
// even if the browser slows this page down in a background tab.
function tick() {
  remainingMs = Math.max(0, endTime - Date.now());
  render();
  if (remainingMs === 0) {
    clearInterval(intervalId);
    state = "finished";
    showFinished();
  }
  applyBlur();
}

// Only accepts a page on the Met's own website; anything else counts as blank.
function metPageUrl(value) {
  try {
    const url = new URL((value || "").trim());
    return url.origin === "https://www.metmuseum.org" ? url.href : "";
  } catch (error) {
    return "";
  }
}

function showDetails() {
  if (!paintingDetails) return;
  const name = (paintingDetails.name || "").trim();
  const artist = (paintingDetails.artist || "").trim() || "Unknown artist";
  const year = (paintingDetails.year || "").trim();

  const details = document.createElement("div");
  details.className = "details";
  if (name) {
    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = name;
    details.append(nameEl);
  }
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = year ? artist + ", " + year : artist;
  details.append(meta);
  const pageUrl = metPageUrl(paintingDetails.link);
  if (pageUrl) {
    const link = document.createElement("a");
    link.className = "met-link";
    link.href = pageUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on the Met website";
    details.append(link);
  }
  detailsSlot.replaceChildren(details);
}

function showFinished() {
  showDetails();
  resetButton.hidden = true;
  mainButton.textContent = "Restart session";
}

function start() {
  endTime = Date.now() + remainingMs;
  state = "running";
  intervalId = setInterval(tick, 250);
  cancelAnimationFrame(frameId);
  animateBlur();
  mainButton.textContent = "Pause";
}

function pause() {
  tick();
  if (state !== "running") return;
  clearInterval(intervalId);
  cancelAnimationFrame(frameId);
  state = "paused";
  applyBlur();
  mainButton.textContent = "Resume";
}

function reset() {
  clearInterval(intervalId);
  cancelAnimationFrame(frameId);
  remainingMs = TOTAL_MS;
  state = "idle";
  render();
  applyBlur();
  detailsSlot.replaceChildren();
  resetButton.hidden = false;
  mainButton.textContent = "Start";
}

mainButton.addEventListener("click", function () {
  if (state === "running") {
    pause();
  } else if (state === "idle" || state === "paused") {
    start();
  } else if (state === "finished") {
    reset();
    loadPainting();
  }
});

resetButton.addEventListener("click", reset);

document.addEventListener("visibilitychange", function () {
  if (state === "running") tick();
});

loadPainting();
