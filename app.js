"use strict";

const ANIMALS_URL =
  "https://raw.githubusercontent.com/jeevanmathewk/animalapp-data/main/animals.json";
const FAV_KEY = "jw_favourites_v1";

const $ = (id) => document.getElementById(id);

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function getPageName() {
  return document.body?.dataset?.page || "";
}

function getQueryParam(name) {
  try {
    return new URL(window.location.href).searchParams.get(name);
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isHttpOrigin() {
  const p = window.location.protocol;
  return p === "http:" || p === "https:";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!isHttpOrigin()) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function initInstallButton() {
  const btn = $("installBtn");
  if (!btn) return;

  btn.hidden = true;

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  if (isStandalone) return;
  if (!isHttpOrigin()) return;

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    btn.hidden = true;
    deferredPrompt = null;
  });

 btn.addEventListener("click", async () => {
  const status = document.getElementById("installStatus");

  if (!deferredPrompt) {
    if (status) {
      status.textContent =
        "Install is not available right now. Please use Chrome and make sure the app is not already installed.";
    }
    return;
  }

  if (status) status.textContent = "";

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;

  deferredPrompt = null;
  btn.hidden = true;

  if (status) {
    status.textContent =
      choice.outcome === "accepted"
        ? "Installing… check your home screen."
        : "Install cancelled.";
  }
});

}

function initNetworkStatus() {
  function update() {
    setText("netStatus", navigator.onLine ? "Online ✅" : "Offline ❌ (some data may not load)");
  }
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function initOrientationStatus() {
  function update() {
    const isLandscape = window.matchMedia?.("(orientation: landscape)")?.matches;
    setText("orientStatus", isLandscape ? "Landscape ↔️" : "Portrait ↕️");
  }
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  update();
}

async function initBatteryStatus() {
  if (!("getBattery" in navigator)) {
    setText("batteryStatus", "Not supported on this browser");
    return;
  }
  try {
    const battery = await navigator.getBattery();
    const update = () => {
      const pct = Math.round(battery.level * 100);
      const charging = battery.charging ? " (charging ⚡)" : "";
      setText("batteryStatus", `${pct}%${charging}`);
    };
    battery.addEventListener("levelchange", update);
    battery.addEventListener("chargingchange", update);
    update();
  } catch {
    setText("batteryStatus", "Battery info blocked/unavailable");
  }
}

function loadFavourites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function saveFavourites(ids) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}

function isFavourite(id) {
  return loadFavourites().includes(id);
}

function toggleFavourite(id) {
  const favs = loadFavourites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  saveFavourites(favs);
}

async function fetchAnimals() {
  const res = await fetch(ANIMALS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load animals data (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Animals JSON must be an array");
  return data;
}

function filterAnimals(allAnimals, query) {
  if (!query) return allAnimals;
  const q = query.toLowerCase();
  return allAnimals.filter((a) => {
    const name = String(a.name || "").toLowerCase();
    const sci = String(a.scientificName || "").toLowerCase();
    const zone = String(a.zone || "").toLowerCase();
    return name.includes(q) || sci.includes(q) || zone.includes(q);
  });
}

function buildAnimalCard(animal) {
  const fav = isFavourite(animal.id);

  const idEnc = encodeURIComponent(animal.id);
  const idRaw = escapeHtml(animal.id);
  const name = escapeHtml(animal.name);
  const sci = escapeHtml(animal.scientificName);
  const summary = escapeHtml(animal.summary);
  const zone = escapeHtml(animal.zone);
  const img = escapeHtml(animal.imageUrl);

  const card = document.createElement("article");
  card.className = "animal-card";
  card.innerHTML = `
    <a class="link" href="animal.html?id=${idEnc}">
      <img class="animal-img" src="${img}" alt="${name}" loading="lazy" decoding="async" />
    </a>
    <div class="animal-body">
      <div class="animal-title">
        <h2>${name}</h2>
        <button class="icon-btn" type="button" data-fav="${idRaw}" aria-label="Toggle favourite">
          ${fav ? "⭐" : "☆"}
        </button>
      </div>
      <div class="small"><em>${sci}</em></div>
      <div class="small">${summary}</div>
      <div class="row">
        <span class="pill">${zone}</span>
        <a class="button button-secondary" href="animal.html?id=${idEnc}">View details</a>
      </div>
    </div>
  `;
  return card;
}

function renderAnimalCards(targetEl, animals, allAnimalsForRefilter, searchInputId, statusEl) {
  targetEl.innerHTML = "";

  animals.forEach((a) => targetEl.appendChild(buildAnimalCard(a)));

  targetEl.querySelectorAll("button[data-fav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-fav");
      if (!id) return;

      toggleFavourite(id);

      const q = ($(searchInputId)?.value || "").trim();
      const filtered = filterAnimals(allAnimalsForRefilter, q);
      renderAnimalCards(targetEl, filtered, allAnimalsForRefilter, searchInputId, statusEl);
      if (statusEl) statusEl.textContent = `${filtered.length} shown (of ${allAnimalsForRefilter.length}).`;
    });
  });
}

async function initAnimalsPage() {
  const status = $("animalsStatus");
  const listEl = $("animalsList");
  const search = $("animalSearch");
  if (!listEl) return;

  try {
    if (status) status.textContent = "Loading animals…";
    const animals = await fetchAnimals();
    if (status) status.textContent = `${animals.length} animals loaded.`;
    renderAnimalCards(listEl, animals, animals, "animalSearch", status);

    if (search) {
      search.addEventListener("input", () => {
        const q = search.value.trim();
        const filtered = filterAnimals(animals, q);
        renderAnimalCards(listEl, filtered, animals, "animalSearch", status);
        if (status) status.textContent = `${filtered.length} shown (of ${animals.length}).`;
      });
    }
  } catch (err) {
    if (status) status.textContent = "Could not load animals. Check your internet / data link.";
    console.error(err);
  }
}

async function initFavouritesPage() {
  const status = $("favStatus");
  const listEl = $("favList");
  if (!listEl) return;

  try {
    if (status) status.textContent = "Loading favourites…";
    listEl.innerHTML = "";

    const favIds = loadFavourites();
    if (favIds.length === 0) {
      if (status) status.textContent = "No favourites yet. Go to Animals and tap ☆ to save some.";
      return;
    }

    const animals = await fetchAnimals();
    const favAnimals = animals.filter((a) => favIds.includes(a.id));

    if (favAnimals.length === 0) {
      if (status) status.textContent = "No matching favourites found in the latest animal data.";
      return;
    }

    if (status) status.textContent = `${favAnimals.length} favourite(s) shown.`;
    renderAnimalCards(listEl, favAnimals, animals, "animalSearch", status);
  } catch (err) {
    if (status) status.textContent = "Could not load favourites. Check your internet / data link.";
    console.error(err);
  }
}

function renderAnimalDetail(animal) {
  const wrap = $("animalDetail");
  if (!wrap) return;

  const fav = isFavourite(animal.id);

  const name = escapeHtml(animal.name);
  const sci = escapeHtml(animal.scientificName);
  const summary = escapeHtml(animal.summary);
  const habitat = escapeHtml(animal.habitat);
  const diet = escapeHtml(animal.diet);
  const zone = escapeHtml(animal.zone);
  const img = escapeHtml(animal.imageUrl);

  wrap.innerHTML = `
    <article class="detail-hero">
      <img class="detail-img" src="${img}" alt="${name}" loading="lazy" decoding="async" />
      <div class="detail-body">
        <div class="detail-head">
          <div>
            <h1>${name}</h1>
            <div class="small"><em>${sci}</em></div>
          </div>
          <button id="favBtn" class="icon-btn" type="button" aria-label="Toggle favourite">
            ${fav ? "⭐" : "☆"}
          </button>
        </div>
        <p class="small">${summary}</p>
        <div class="row">
          <span class="pill">${zone}</span>
        </div>
        <div class="kv" aria-label="Animal information">
          <div class="kv-row">
            <div class="kv-label">Habitat</div>
            <div class="kv-value">${habitat}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Diet</div>
            <div class="kv-value">${diet}</div>
          </div>
        </div>
      </div>
    </article>
  `;

  const favBtn = $("favBtn");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleFavourite(animal.id);
      renderAnimalDetail(animal);
    });
  }
}

async function initAnimalDetailPage() {
  const status = $("detailStatus");

  try {
    if (status) status.textContent = "Loading animal details…";

    const id = getQueryParam("id");
    if (!id) {
      if (status) status.textContent = "No animal selected. Go back and choose an animal.";
      return;
    }

    const animals = await fetchAnimals();
    const animal = animals.find((a) => a.id === id);

    if (!animal) {
      if (status) status.textContent = "Animal not found. Please go back and try again.";
      return;
    }

    if (status) status.textContent = "";
    renderAnimalDetail(animal);
  } catch (err) {
    if (status) status.textContent = "Could not load details. Check your internet / data link.";
    console.error(err);
  }
}

function getAnimalEmoji(animalId) {
  switch (animalId) {
    case "red-fox":
      return "🦊";
    case "barn-owl":
      return "🦉";
    case "hedgehog":
      return "🦔";
    case "otter":
      return "🦦";
    case "common-frog":
      return "🐸";
    case "roe-deer":
      return "🦌";
    default:
      return "🐾";
  }
}

async function initMapPage() {
  const status = $("mapStatus");
  const mapEl = $("map");
  if (!mapEl || typeof L === "undefined") {
    if (status) status.textContent = "Map is unavailable.";
    return;
  }

  const map = L.map("map").setView([53.483, -2.237], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  let userMarker = null;
  let userLatLng = null;
  const markersById = new Map();

  let animals = [];
  try {
    animals = await fetchAnimals();
    if (status) status.textContent = `Map ready. Loaded ${animals.length} animals.`;
  } catch (e) {
    if (status) status.textContent = "Map ready, but could not load animal data.";
    console.error(e);
    return;
  }

  const sel = $("animalSelect");
  if (sel) {
    sel.innerHTML = `<option value="">Select an animal…</option>`;
    animals.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      sel.appendChild(opt);
    });
  }

  animals.forEach((a) => {
    const lat = Number(a.lat);
    const lng = Number(a.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const emojiIcon = L.divIcon({
      className: "emoji-marker",
      html: `<div style="font-size: 28px;">${getAnimalEmoji(a.id)}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    const popupHtml = `
      <strong>${escapeHtml(a.name)}</strong><br>
      ${escapeHtml(a.zone)}<br>
      <a href="animal.html?id=${encodeURIComponent(a.id)}">View details</a>
    `;

    const marker = L.marker([lat, lng], { icon: emojiIcon }).addTo(map).bindPopup(popupHtml);
    markersById.set(a.id, { marker, latlng: [lat, lng] });
  });

  function flyTo(latlng, zoom = 16) {
    map.flyTo(latlng, zoom, { animate: true, duration: 0.9 });
  }

  function showAllAnimals() {
    const points = Array.from(markersById.values()).map((x) => x.latlng);
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
  }

  if (!navigator.geolocation) {
    if (status) status.textContent = "Geolocation is not supported on this device.";
  } else {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLatLng = [pos.coords.latitude, pos.coords.longitude];

        if (userMarker) userMarker.setLatLng(userLatLng);
        else userMarker = L.marker(userLatLng).addTo(map).bindPopup("📍 You are here");

        if (status) status.textContent = `Location found. Loaded ${animals.length} animals.`;

        flyTo(userLatLng, 15);
        userMarker.openPopup();
      },
      () => {
        if (status) status.textContent =
          `Location not available (permission denied). Loaded ${animals.length} animals.`;
      }
    );
  }

  const btnMe = $("btnLocateMe");
  if (btnMe) {
    btnMe.addEventListener("click", () => {
      if (!userLatLng) {
        if (status) status.textContent = "Please allow location access to locate you.";
        return;
      }
      flyTo(userLatLng, 15);
      userMarker?.openPopup();
    });
  }

  const btnAll = $("btnShowAll");
  if (btnAll) btnAll.addEventListener("click", showAllAnimals);

  const btnAnimal = $("btnLocateAnimal");
  if (btnAnimal) {
    btnAnimal.addEventListener("click", () => {
      const id = sel ? sel.value : "";
      if (!id) {
        if (status) status.textContent = "Choose an animal from the list first.";
        return;
      }
      const item = markersById.get(id);
      if (!item) {
        if (status) status.textContent = "Could not find that animal marker.";
        return;
      }
      flyTo(item.latlng, 16);
      item.marker.openPopup();
    });
  }
}

registerServiceWorker();

document.addEventListener("DOMContentLoaded", () => {
  initNetworkStatus();
  initOrientationStatus();
  initBatteryStatus();
  initInstallButton();

  const page = getPageName();
  if (page === "animals") initAnimalsPage();
  if (page === "animal-detail") initAnimalDetailPage();
  if (page === "favourites") initFavouritesPage();
  if (page === "map") initMapPage();
});
