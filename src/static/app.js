document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const radiusInput = document.getElementById("radius-km");
  const useCurrentLocationButton = document.getElementById("use-current-location");
  const findNearbyButton = document.getElementById("find-nearby");
  const showAllButton = document.getElementById("show-all");
  const mapContainer = document.getElementById("map");

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function getCurrentFilters() {
    const latitude = parseFloat(latitudeInput.value);
    const longitude = parseFloat(longitudeInput.value);
    const radius_km = parseFloat(radiusInput.value) || 10;

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude, radius_km };
    }

    return {};
  }

  function renderMap(activities, filters = {}) {
    const points = Object.entries(activities).map(([name, details]) => ({
      name,
      latitude: details.latitude,
      longitude: details.longitude,
      type: "event",
    }));

    if (
      Number.isFinite(filters.latitude) &&
      Number.isFinite(filters.longitude)
    ) {
      points.push({
        name: "Selected location",
        latitude: filters.latitude,
        longitude: filters.longitude,
        type: "selected",
      });
    }

    mapContainer.innerHTML = "";

    if (points.length === 0) {
      mapContainer.innerHTML =
        "<p class=\"map-placeholder\" aria-live=\"polite\">No map points to display.</p>";
      return;
    }

    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    let minLat = Math.min(...latitudes);
    let maxLat = Math.max(...latitudes);
    let minLon = Math.min(...longitudes);
    let maxLon = Math.max(...longitudes);

    if (minLat === maxLat) {
      minLat -= 0.01;
      maxLat += 0.01;
    }
    if (minLon === maxLon) {
      minLon -= 0.01;
      maxLon += 0.01;
    }

    const svgNamespace = "http://www.w3.org/2000/svg";
    const width = 640;
    const height = 320;
    const padding = 30;
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "map-svg");

    const background = document.createElementNS(svgNamespace, "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", `${width}`);
    background.setAttribute("height", `${height}`);
    background.setAttribute("class", "map-background");
    svg.appendChild(background);

    const projectPoint = (latitude, longitude) => ({
      x:
        padding +
        ((longitude - minLon) / (maxLon - minLon)) * (width - padding * 2),
      y:
        height -
        padding -
        ((latitude - minLat) / (maxLat - minLat)) * (height - padding * 2),
    });

    points.forEach((point) => {
      const projected = projectPoint(point.latitude, point.longitude);
      const marker = document.createElementNS(svgNamespace, "circle");
      marker.setAttribute("cx", `${projected.x}`);
      marker.setAttribute("cy", `${projected.y}`);
      marker.setAttribute("r", point.type === "selected" ? "6" : "5");
      marker.setAttribute(
        "class",
        point.type === "selected" ? "map-marker-selected" : "map-marker-event"
      );
      svg.appendChild(marker);

      const label = document.createElementNS(svgNamespace, "text");
      label.setAttribute("x", `${projected.x + 8}`);
      label.setAttribute("y", `${projected.y - 8}`);
      label.setAttribute("class", "map-label");
      label.textContent = point.name;
      svg.appendChild(label);
    });

    mapContainer.appendChild(svg);
  }

  async function fetchActivities(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (Number.isFinite(filters.latitude)) {
        params.set("latitude", filters.latitude);
      }
      if (Number.isFinite(filters.longitude)) {
        params.set("longitude", filters.longitude);
      }
      if (Number.isFinite(filters.radius_km)) {
        params.set("radius_km", filters.radius_km);
      }

      const queryString = params.toString();
      const response = await fetch(
        queryString ? `/activities?${queryString}` : "/activities"
      );
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      const activityEntries = Object.entries(activities);

      if (activityEntries.length === 0) {
        activitiesList.innerHTML =
          "<p>No events found near this location. Try a larger radius.</p>";
      }

      activityEntries.forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      renderMap(activities, filters);

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
      showMessage("Failed to load activities. Please try again later.", "error");
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities(getCurrentFilters());
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities(getCurrentFilters());
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  findNearbyButton.addEventListener("click", async () => {
    const latitude = parseFloat(latitudeInput.value);
    const longitude = parseFloat(longitudeInput.value);
    const radius_km = parseFloat(radiusInput.value);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      showMessage("Enter both latitude and longitude.", "error");
      return;
    }

    if (!Number.isFinite(radius_km) || radius_km <= 0) {
      showMessage("Enter a valid radius greater than 0.", "error");
      return;
    }

    await fetchActivities({ latitude, longitude, radius_km });
  });

  useCurrentLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showMessage("Geolocation is not supported by this browser.", "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        latitudeInput.value = position.coords.latitude.toFixed(6);
        longitudeInput.value = position.coords.longitude.toFixed(6);
        if (!radiusInput.value) {
          radiusInput.value = "10";
        }
        await fetchActivities(getCurrentFilters());
      },
      (error) => {
        let geolocationError = "Unable to get your current location. Enter coordinates manually.";
        if (error.code === error.PERMISSION_DENIED) {
          geolocationError = "Location access was denied. Enter coordinates manually.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          geolocationError = "Location data is unavailable. Enter coordinates manually.";
        } else if (error.code === error.TIMEOUT) {
          geolocationError = "Location request timed out. Enter coordinates manually.";
        }
        showMessage(geolocationError, "error");
      }
    );
  });

  showAllButton.addEventListener("click", async () => {
    latitudeInput.value = "";
    longitudeInput.value = "";
    await fetchActivities();
  });

  fetchActivities();
});
