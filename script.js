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

// Made-up text for now. It is only put on the page when the timer finishes.
const PAINTING = { name: "Evening by the Water", artist: "Anna Example", year: "1887" };

let state = "idle"; // idle, running, paused or finished
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

// Picks a random painting that has a photo. Only the small image link is kept,
// so no painting details are ever on the page before the timer finishes.
async function loadPainting() {
  const thisLoad = ++latestLoad;
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
    showArtwork("painting");
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

function showFinished() {
  const details = document.createElement("div");
  details.className = "details";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = PAINTING.name;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = PAINTING.artist + ", " + PAINTING.year;
  details.append(name, meta);
  detailsSlot.replaceChildren(details);

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
