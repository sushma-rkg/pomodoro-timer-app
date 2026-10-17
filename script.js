const TOTAL_MS = 30 * 1000;

const timerEl = document.getElementById("timer");
const mainButton = document.getElementById("main-button");
const resetButton = document.getElementById("reset-button");
const artEl = document.getElementById("art");
const detailsSlot = document.getElementById("details-slot");
const loadingEl = document.getElementById("loading");
const paintingEl = document.getElementById("painting");

const MET_API = "https://collectionapi.metmuseum.org/public/collection/";
const SEARCH_URL = MET_API + "v1.1/search?hasImages=true&departmentId=11&isHighlight=true&q=painting";
const OBJECT_URL = MET_API + "v1/objects/";

let state = "idle"; // idle, running, paused or finished
let paintingDetails = null; // name, artist and year of the painting on the page
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;
let latestLoad = 0;

// Shows one of: "placeholder", "loading" or "painting".
function showArtwork(which) {
  artEl.hidden = which !== "placeholder";
  loadingEl.hidden = which !== "loading";
  paintingEl.hidden = which !== "painting";
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

function preloadImage(url) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
}

// Picks a random painting that has a photo. The details come from the same
// answer as the image, so they always belong together. They are kept out of
// the page until the timer finishes.
async function loadPainting() {
  const thisLoad = ++latestLoad;
  paintingDetails = null;
  showArtwork("loading");
  try {
    const search = await getJson(SEARCH_URL);
    const ids = search.objectIDs;
    const id = ids[Math.floor(Math.random() * ids.length)];
    const painting = await getJson(OBJECT_URL + id);
    const imageUrl = painting.primaryImageSmall;
    if (!imageUrl) throw new Error("No image");
    await preloadImage(imageUrl);
    if (thisLoad !== latestLoad) return;
    paintingEl.src = imageUrl;
    paintingDetails = {
      name: painting.title,
      artist: painting.artistDisplayName,
      year: painting.objectDate,
      link: painting.objectURL,
    };
    showArtwork("painting");
    if (state === "finished") showDetails();
  } catch (error) {
    if (thisLoad === latestLoad) showArtwork("placeholder");
  }
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
  artEl.classList.remove("blurred");
  resetButton.hidden = true;
  mainButton.textContent = "Restart session";
}

function start() {
  endTime = Date.now() + remainingMs;
  state = "running";
  intervalId = setInterval(tick, 250);
  artEl.classList.add("running");
  mainButton.textContent = "Pause";
}

function pause() {
  tick();
  if (state !== "running") return;
  clearInterval(intervalId);
  state = "paused";
  mainButton.textContent = "Resume";
}

function reset() {
  clearInterval(intervalId);
  remainingMs = TOTAL_MS;
  state = "idle";
  render();
  artEl.classList.remove("running");
  artEl.classList.add("blurred");
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
