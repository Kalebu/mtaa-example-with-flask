(function () {
    "use strict";

    const fields = [
        document.getElementById("regions"),
        document.getElementById("districts"),
        document.getElementById("wards"),
        document.getElementById("streets"),
        document.getElementById("neighborhood")
    ];
    const placeholders = [
        "Choose a region",
        "Choose a district",
        "Choose a ward",
        "Choose a street",
        "Choose a place"
    ];
    const helpers = [
        "Start with a region.",
        "Choose a region first.",
        "Choose a district first.",
        "Choose a ward first.",
        "Choose a street first."
    ];
    const helperIds = [
        "region-help",
        "district-help",
        "ward-help",
        "street-help",
        "place-help"
    ];
    const fieldNames = ["region", "district", "ward", "street", "place"];
    const breadcrumb = document.getElementById("location-breadcrumb");
    const browseFeedback = document.getElementById("browse-feedback");
    const selectionSummary = document.getElementById("selection-summary");
    const selectedPlace = document.getElementById("selected-place");
    const selectedPath = document.getElementById("selected-path");
    const selectedPostcode = document.getElementById("selected-postcode");
    const downloadTree = document.getElementById("download-tree");
    const searchLevel = document.getElementById("search-level");
    const downloadDirectory = document.getElementById("download-directory");
    const previousResults = document.getElementById("previous-results");
    const nextResults = document.getElementById("next-results");
    const copyFeedback = document.getElementById("copy-feedback");
    const searchInput = document.getElementById("location-search");
    const searchFeedback = document.getElementById("search-feedback");
    const searchResults = document.getElementById("search-results");
    const searchResultList = document.getElementById("search-result-list");
    const explorer = document.getElementById("explorer");
    const activeRequests = new Map();
    let searchController = null;
    let searchTimer = null;
    let matchingLocations = [];
    let detailsController = null;
    let currentPostcode = "";
    let searchOffset = 0;

    function setFieldOptions(index, values, selectedValue) {
        const field = fields[index];
        field.replaceChildren(new Option(placeholders[index], ""));
        values.forEach(function (value) {
            field.add(new Option(value, value));
        });
        field.value = selectedValue || "";
        field.disabled = values.length === 0;
        field.closest(".location-field").hidden = values.length === 0;
    }

    function resetField(index) {
        const pending = activeRequests.get(index);
        if (pending) {
            pending.abort();
            activeRequests.delete(index);
        }
        fields[index].replaceChildren(new Option(placeholders[index], ""));
        fields[index].disabled = true;
        fields[index].closest(".location-field").hidden = true;
        document.getElementById(helperIds[index]).textContent = helpers[index];
    }

    function resetAfter(index) {
        for (let i = index + 1; i < fields.length; i += 1) {
            resetField(i);
        }
        selectionSummary.hidden = true;
        copyFeedback.textContent = "";
        updateBreadcrumb();
    }

    function updateBreadcrumb() {
        const parts = ["Tanzania"];
        fields.forEach(function (field) {
            if (field.value) {
                parts.push(field.value);
            }
        });
        breadcrumb.textContent = parts.join(" / ");
        updateSelectionDetails();
    }

    async function updateSelectionDetails() {
        if (detailsController) detailsController.abort();
        const path = fields.map(function (field) { return field.value; }).filter(Boolean);
        selectionSummary.hidden = path.length === 0;
        selectedPostcode.textContent = "";
        currentPostcode = "";
        copyFeedback.textContent = "";
        if (!path.length) return;
        selectedPlace.textContent = path[path.length - 1];
        selectedPath.textContent = ["Tanzania"].concat(path).join(" / ");
        const query = "?path=" + encodeURIComponent(path.join("/"));
        downloadTree.href = "/api/tree" + query;
        const controller = new AbortController();
        detailsController = controller;
        try {
            const response = await fetch("/api/details" + query, { signal: controller.signal });
            if (!response.ok) throw new Error("Details unavailable.");
            const details = await response.json();
            if (detailsController !== controller) return;
            currentPostcode = details.post_code || "";
            const label = path.length < 3 ? "Postal prefix" : "Ward postcode";
            selectedPostcode.textContent = currentPostcode ? label + ": " + currentPostcode : "Postcode not listed in the dataset.";
        } catch (error) {
            if (error.name !== "AbortError" && detailsController === controller) {
                selectedPostcode.textContent = "Postcode could not be loaded.";
            }
        }
    }

    function setBrowseMessage(message) {
        browseFeedback.textContent = message;
    }

    function markSelected(index) {
        document.getElementById(helperIds[index]).textContent = "Selected " + fields[index].value + ".";
    }

    function parentPath(index) {
        const parts = fields.slice(0, index).map(function (field) {
            return encodeURIComponent(field.value);
        });
        return "/" + parts.join("/");
    }

    async function loadChildren(index) {
        if (index < 1 || fields.slice(0, index).some(function (field) {
            return !field.value;
        })) {
            return [];
        }

        const previous = activeRequests.get(index);
        if (previous) {
            previous.abort();
        }

        const controller = new AbortController();
        activeRequests.set(index, controller);
        const help = document.getElementById(helperIds[index]);
        fields[index].replaceChildren(new Option("Loading locations...", ""));
        fields[index].disabled = true;
        help.textContent = "Loading " + fieldNames[index] + "s.";
        setBrowseMessage("Loading " + fieldNames[index] + "s.");

        try {
            const response = await fetch(parentPath(index), {
                headers: { Accept: "application/json" },
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error("Location request failed.");
            }
            const responseValues = await response.json();
            if (!Array.isArray(responseValues)) {
                throw new Error("The location response was not a list.");
            }
            const values = responseValues.filter(function (value) {
                return typeof value === "string" && value.trim().length > 0;
            });
            if (activeRequests.get(index) !== controller) {
                return [];
            }

            setFieldOptions(index, values);
            help.textContent = values.length
                ? "Choose a " + fieldNames[index] + " to continue."
                : "No " + fieldNames[index] + "s are listed here.";
            setBrowseMessage(values.length
                ? values.length + " " + fieldNames[index] + (values.length === 1 ? " is" : "s are") + " ready to choose."
                : "No " + fieldNames[index] + "s are listed for this area.");
            return values;
        } catch (error) {
            if (error.name === "AbortError") {
                return [];
            }
            if (activeRequests.get(index) === controller) {
                setFieldOptions(index, []);
                help.textContent = "Could not load locations. Change the selection above to try again.";
                setBrowseMessage("Could not load " + fieldNames[index] + "s. Change the selection above to try again.");
            }
            return [];
        } finally {
            if (activeRequests.get(index) === controller) {
                activeRequests.delete(index);
            }
        }
    }

    function locationPath(location, includePlace) {
        const depthByLevel = {
            Region: 0,
            District: 1,
            Ward: 2,
            Street: 3,
            Place: 4
        };
        const depth = includePlace ? 4 : (depthByLevel[location.level] || 0);
        const parts = ["Tanzania"].concat([
            location.region,
            location.district,
            location.ward,
            location.street
        ].filter(Boolean).slice(0, depth));
        if (includePlace && location.name) {
            parts.push(location.name);
        }
        return parts.join(" / ");
    }

    function showSelection() {
        updateBreadcrumb();
        if (fields[4].value) {
            markSelected(4);
            setBrowseMessage("Place selected. Its full location path is shown below.");
        }
    }

    function renderSearchResults(locations) {
        matchingLocations = locations;
        searchResultList.replaceChildren();
        locations.forEach(function (location, index) {
            const item = document.createElement("li");
            const button = document.createElement("button");
            const title = document.createElement("span");
            const name = document.createElement("span");
            const type = document.createElement("span");
            const path = document.createElement("span");

            button.type = "button";
            button.className = "search-hit";
            button.dataset.index = String(index);
            title.className = "search-hit-title";
            name.textContent = location.name;
            type.className = "search-hit-type";
            type.textContent = location.level;
            path.className = "search-hit-path";
            path.textContent = locationPath(location, false) + (location.post_code ? " · " + (location.level === "Region" || location.level === "District" ? "Postal prefix " : "Postcode ") + location.post_code : "");
            title.append(name, type);
            button.append(title, path);
            item.append(button);
            searchResultList.append(item);
        });
        searchResults.hidden = locations.length === 0;
    }

    async function searchLocations(query, offset = 0) {
        const normalizedQuery = query.trim();
        if (normalizedQuery.length < 2 && !searchLevel.value) {
            renderSearchResults([]);
            searchFeedback.textContent = "";
            return;
        }

        if (searchController) {
            searchController.abort();
        }
        searchController = new AbortController();
        const controller = searchController;
        searchFeedback.textContent = "Searching locations...";

        try {
            const response = await fetch("/api/search?q=" + encodeURIComponent(normalizedQuery) + "&level=" + encodeURIComponent(searchLevel.value) + "&offset=" + offset + "&limit=9", {
                headers: { Accept: "application/json" },
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error("Search request failed.");
            }
            const locations = await response.json();
            if (controller !== searchController) {
                return;
            }
            searchOffset = offset;
            renderSearchResults(locations.slice(0, 8));
            previousResults.hidden = offset === 0;
            nextResults.hidden = locations.length < 9;
            searchFeedback.textContent = locations.length
                ? ""
                : "No locations match that name. Check the spelling or try another search.";
        } catch (error) {
            if (error.name !== "AbortError" && controller === searchController) {
                renderSearchResults([]);
                searchFeedback.textContent = "Search is unavailable. Please try again.";
            }
        }
    }

    async function openLocation(location) {
        const depthByLevel = {
            Region: 0,
            District: 1,
            Ward: 2,
            Street: 3,
            Place: 4
        };
        const depth = depthByLevel[location.level];
        if (depth === undefined) {
            return;
        }

        explorer.hidden = false;
        resetAfter(0);
        fields[0].value = location.region;
        markSelected(0);
        updateBreadcrumb();

        const valuesByField = [
            location.region,
            location.district,
            location.ward,
            location.street,
            location.name
        ];

        try {
            for (let index = 1; index <= Math.min(depth, 3); index += 1) {
                const options = await loadChildren(index);
                if (!options.includes(valuesByField[index])) {
                    throw new Error("The location is no longer available.");
                }
                fields[index].value = valuesByField[index];
                markSelected(index);
                updateBreadcrumb();
            }

            if (depth >= 3) {
                const places = await loadChildren(4);
                if (depth === 4) {
                    if (!places.includes(location.name)) {
                        throw new Error("The place is no longer available.");
                    }
                    fields[4].value = location.name;
                    showSelection();
                }
            } else {
                await loadChildren(depth + 1);
            }

            setBrowseMessage(location.level + " selected. Continue through the location fields below.");
            if (depth === 4) {
                showSelection();
            }
            document.getElementById("explorer").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            const nextField = fields[Math.min(depth + 1, 4)];
            (nextField.disabled ? fields[depth] : nextField).focus();
        } catch (error) {
            setBrowseMessage("Could not open this location. Choose an area below to continue.");
        }
    }

    fields[0].addEventListener("change", async function () {
        resetAfter(0);
        if (this.value) {
            markSelected(0);
            updateBreadcrumb();
            await loadChildren(1);
        } else {
            setBrowseMessage("Choose a region to begin.");
        }
    });

    fields[1].addEventListener("change", async function () {
        resetAfter(1);
        if (this.value) {
            markSelected(1);
            updateBreadcrumb();
            await loadChildren(2);
        } else {
            setBrowseMessage("Choose a district to continue.");
        }
    });

    fields[2].addEventListener("change", async function () {
        resetAfter(2);
        if (this.value) {
            markSelected(2);
            updateBreadcrumb();
            await loadChildren(3);
        } else {
            setBrowseMessage("Choose a ward to continue.");
        }
    });

    fields[3].addEventListener("change", async function () {
        resetAfter(3);
        if (this.value) {
            markSelected(3);
            updateBreadcrumb();
            await loadChildren(4);
        } else {
            setBrowseMessage("Choose a street to see its places.");
        }
    });

    fields[4].addEventListener("change", showSelection);

    document.getElementById("search-form").addEventListener("submit", function (event) {
        event.preventDefault();
        window.clearTimeout(searchTimer);
        searchLocations(searchInput.value);
    });

    searchInput.addEventListener("input", function () {
        window.clearTimeout(searchTimer);
        if (this.value.trim().length < 2 && !searchLevel.value) {
            renderSearchResults([]);
            searchFeedback.textContent = "";
            if (searchController) {
                searchController.abort();
            }
            return;
        }
        searchTimer = window.setTimeout(function () {
            searchLocations(searchInput.value);
        }, 220);
    });

    searchLevel.addEventListener("change", function () {
        window.clearTimeout(searchTimer);
        downloadDirectory.href = "/api/grouped?level=" + encodeURIComponent(this.value);
        searchLocations(searchInput.value);
    });

    previousResults.addEventListener("click", function () {
        searchLocations(searchInput.value, Math.max(0, searchOffset - 8));
    });
    nextResults.addEventListener("click", function () {
        searchLocations(searchInput.value, searchOffset + 8);
    });

    searchResultList.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-index]");
        if (!button) {
            return;
        }
        const location = matchingLocations[Number(button.dataset.index)];
        if (location) {
            searchResults.hidden = true;
            searchFeedback.textContent = "";
            openLocation(location);
        }
    });

    document.getElementById("copy-address").addEventListener("click", async function () {
        const address = selectedPath.textContent + (currentPostcode ? " / " + selectedPostcode.textContent : "");
        try {
            await navigator.clipboard.writeText(address);
            copyFeedback.textContent = "Address copied.";
        } catch (error) {
            copyFeedback.textContent = "Copy was unavailable. You can select the address above.";
        }
    });
})();
