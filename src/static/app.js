document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const locationSearch = document.getElementById("location-search");
  const locationSuggestions = document.getElementById("location-suggestions");

  // Store all activities for filtering
  let allActivities = {};

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();
      allActivities = activities;

      renderActivities(activities);
      populateLocationAutocomplete(activities);
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Render activities list and populate dropdown
  function renderActivities(activities) {
    // Clear loading message and dropdown options
    activitiesList.innerHTML = "";
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

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

      const locationHTML = details.location
        ? `<p><strong>Location:</strong> ${details.location}</p>`
        : "";

      activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          ${locationHTML}
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
  }

  // Build unique location list and wire up autocomplete
  function populateLocationAutocomplete(activities) {
    const locationSet = new Set();
    Object.values(activities).forEach((details) => {
      if (details.location) {
        locationSet.add(details.location);
      }
    });
    const locations = Array.from(locationSet).sort();

    locationSearch.addEventListener("input", () => {
      const query = locationSearch.value.trim().toLowerCase();
      locationSuggestions.innerHTML = "";

      if (!query) {
        locationSuggestions.classList.add("hidden");
        renderActivities(allActivities);
        return;
      }

      const matches = locations.filter((loc) =>
        loc.toLowerCase().includes(query)
      );

      if (matches.length === 0) {
        locationSuggestions.classList.add("hidden");
      } else {
        matches.forEach((loc) => {
          const li = document.createElement("li");
          li.textContent = loc;
          li.addEventListener("click", () => {
            locationSearch.value = loc;
            locationSuggestions.classList.add("hidden");
            filterByLocation(loc);
          });
          locationSuggestions.appendChild(li);
        });
        locationSuggestions.classList.remove("hidden");
      }

      // Filter activities as the user types
      filterByLocation(locationSearch.value.trim());
    });

    // Hide suggestions when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".autocomplete-wrapper")) {
        locationSuggestions.classList.add("hidden");
      }
    });

    // Allow keyboard navigation and selection with Enter
    locationSearch.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        locationSuggestions.classList.add("hidden");
      }
    });
  }

  // Filter activities by location string
  function filterByLocation(query) {
    if (!query) {
      renderActivities(allActivities);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = Object.fromEntries(
      Object.entries(allActivities).filter(([, details]) => {
        const loc = details.location?.toLowerCase();
        return loc && loc.includes(lowerQuery);
      })
    );
    renderActivities(filtered);
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
});
