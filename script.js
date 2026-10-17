const TOTAL_MS = 30 * 1000;

const timerEl = document.getElementById("timer");
const mainButton = document.getElementById("main-button");
const resetButton = document.getElementById("reset-button");
const artEl = document.getElementById("art");
const detailsSlot = document.getElementById("details-slot");

// Made-up text for now. It is only put on the page when the timer finishes.
const PAINTING = { name: "Evening by the Water", artist: "Anna Example", year: "1887" };

let state = "idle"; // idle, running, paused or finished
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;

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
  }
});

resetButton.addEventListener("click", reset);

document.addEventListener("visibilitychange", function () {
  if (state === "running") tick();
});
