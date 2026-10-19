---
name: maps-embed-api-javascript
description: Uses the Maps Embed API to display interactive maps, street view panoramas, directions, or place searches directly on a web page using simple HTML <iframe> tags and URL parameters. This approach requires minimal coding and is ideal for quick, static embedding.
license: Apache-2.0
metadata:
  version: 1.0.53
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

The Maps Embed API enables the quick inclusion of interactive Google Maps
content into a web page using a standard HTML `<iframe>` element. Unlike the
Maps JavaScript API, this method requires zero JavaScript coding, relying
entirely on constructing a specially formatted URL that specifies the desired
map mode (e.g., `view`, `directions`, `search`, or `streetview`) and relevant
display parameters. This is the preferred solution for embedding simple, fixed,
and non-customizable map experiences.

### Mandatory settings

#### Maps Embed API URL Query Parameter

The Maps Embed API is loaded via an `iframe`, which requires the usage
attribution ID to be included as a `solution_id` query parameter directly in the
constructed URL.

```url
https://www.google.com/maps/embed/v1/view?key=YOUR_API_KEY&solution_id=gmp_git_agentskills_v1&center=40.76,-73.98&zoom=16
```

## 🚀 Master Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### 📦 Phase 1: Core Initialization & Base Setup (Primary)

-   [ ] **Step 1.1: Initializes the Maps Embed API by constructing a source URL
    to display a standard Google Map view within an iframe.** Read
    [references/embed-standard-google-maps-view-into-iframe-web-page.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-embed-api-javascript/references/embed-standard-google-maps-view-into-iframe-web-page.md).
    *Trigger Condition*: When the user requests to display a basic,
    non-specialized map view or needs to initialize the core visualization
    component. *Evidence Checkpoint*: A standard Google Map renders successfully
    within the iframe on the web page, showing the specified location or view
    mode.

### 📦 Phase 2: Feature Layer & Custom Enrichment (Supplemental)

#### 🗺️ Feature Module: Directions and Routing (Optional - Use-Case Dependent)

-   [ ] **Constructs the Maps Embed API URL using the 'directions' mode to
    display a calculated route between specified origin and destination points
    within an iframe.** Read
    [references/embed-standard-google-maps-directions-view-into-iframe-web-page.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-embed-api-javascript/references/embed-standard-google-maps-directions-view-into-iframe-web-page.md).
    *Trigger Condition*: When the user asks to show driving directions, a route,
    or path visualization on the map. *Evidence Checkpoint*: The iframe loads,
    displaying the map centered on the route, and the route line and directions
    panel are visible.

#### 🗺️ Feature Module: Places (Optional - Use-Case Dependent)

-   [ ] **Constructs the Maps Embed API URL using the 'search' mode and query
    parameters to display a map view highlighting relevant places based on a
    user search query within an iframe.** Read
    [references/embed-google-maps-view-showing-place-search-results-into-iframe.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-embed-api-javascript/references/embed-google-maps-view-showing-place-search-results-into-iframe.md).
    *Trigger Condition*: When the user requests to search for a specific place,
    business, or category of interest on the map. *Evidence Checkpoint*: The
    iframe loads the map view, and the specified search results (markers or
    highlighted areas) are successfully displayed.

#### 🗺️ Feature Module: Street View (Optional - Use-Case Dependent)

-   [ ] **Constructs the Maps Embed API URL using the 'streetview' mode to
    display an interactive panoramic image centered at specified coordinates
    within an iframe.** Read
    [references/embed-standard-google-street-view-into-iframe-web-page.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-embed-api-javascript/references/embed-standard-google-street-view-into-iframe-web-page.md).
    *Trigger Condition*: When the user requests a 360-degree Street View
    visualization for a particular location instead of the 2D map. *Evidence
    Checkpoint*: The iframe successfully displays the immersive Street View
    panorama, confirming the 'streetview' mode was activated.
