document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
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

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
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
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
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
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();

  // ---- Events Map ----
  const map = L.map("map").setView([37.7749, -122.4194], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const eventMarkers = {};

  // Load existing events and add to map
  async function fetchEvents() {
    try {
      const response = await fetch("/events");
      const eventsData = await response.json();
      eventsData.forEach((ev) => {
        addEventPin(ev);
      });
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  }

  function addEventPin(ev) {
    if (ev.lat == null || ev.lon == null) return;
    const marker = L.marker([ev.lat, ev.lon]).addTo(map);
    marker.bindPopup(
      `<strong>${ev.name}</strong><br/>` +
      `<em>${ev.type}</em><br/>` +
      `Host: ${ev.host}<br/>` +
      `Date: ${ev.date} at ${ev.time}<br/>` +
      `Location: ${ev.location}<br/>` +
      `${ev.description}`
    );
    eventMarkers[ev.name + "||" + ev.date] = marker;
  }

  fetchEvents();

  // Location autocomplete using Nominatim
  const locationInput = document.getElementById("event-location");
  const suggestionsBox = document.getElementById("location-suggestions");
  let selectedLat = null;
  let selectedLon = null;
  let debounceTimer = null;

  locationInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = locationInput.value.trim();
    if (query.length < 3) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.classList.add("hidden");
      selectedLat = null;
      selectedLon = null;
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&limit=5`,
          {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "MergingtonHighSchool/1.0 (school activities app)",
            },
          }
        );
        const results = await res.json();
        suggestionsBox.innerHTML = "";
        if (results.length === 0) {
          suggestionsBox.classList.add("hidden");
          return;
        }
        results.forEach((place) => {
          const li = document.createElement("li");
          li.textContent = place.display_name;
          li.addEventListener("click", () => {
            locationInput.value = place.display_name;
            selectedLat = parseFloat(place.lat);
            selectedLon = parseFloat(place.lon);
            suggestionsBox.innerHTML = "";
            suggestionsBox.classList.add("hidden");
          });
          suggestionsBox.appendChild(li);
        });
        suggestionsBox.classList.remove("hidden");
      } catch (err) {
        console.error("Geocoding error:", err);
      }
    }, 400);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".location-group")) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.classList.add("hidden");
    }
  });

  // Event form submission
  const eventForm = document.getElementById("event-form");
  const eventMessageDiv = document.getElementById("event-message");

  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("event-name").value;
    const host = document.getElementById("event-host").value;
    const date = document.getElementById("event-date").value;
    const time = document.getElementById("event-time").value;
    const location = locationInput.value;
    const type = document.getElementById("event-type").value;
    const description = document.getElementById("event-description").value;

    if (!selectedLat || !selectedLon) {
      eventMessageDiv.textContent =
        "Please select a location from the autocomplete suggestions.";
      eventMessageDiv.className = "error";
      eventMessageDiv.classList.remove("hidden");
      setTimeout(() => eventMessageDiv.classList.add("hidden"), 5000);
      return;
    }

    const payload = {
      name,
      host,
      date,
      time,
      location,
      type,
      description,
      lat: selectedLat,
      lon: selectedLon,
    };

    try {
      const response = await fetch("/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        eventMessageDiv.textContent = result.message;
        eventMessageDiv.className = "success";
        addEventPin(result.event);
        map.setView([selectedLat, selectedLon], 14);
        eventForm.reset();
        selectedLat = null;
        selectedLon = null;
      } else {
        eventMessageDiv.textContent =
          result.detail || "Failed to create event.";
        eventMessageDiv.className = "error";
      }

      eventMessageDiv.classList.remove("hidden");
      setTimeout(() => eventMessageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      eventMessageDiv.textContent = "Failed to create event. Please try again.";
      eventMessageDiv.className = "error";
      eventMessageDiv.classList.remove("hidden");
      console.error("Error creating event:", error);
    }
  });
});
