---
name: street-view-static-api-web-api
description: Use this skill when a developer needs to generate a URL that returns a high-quality, non-interactive static image of a Street View panorama, controlling parameters like location, size, and camera orientation (heading, pitch, and field of view).
license: Apache-2.0
metadata:
  version: 1.0.53
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

This skill guides the developer in using the Street View Static API to construct
valid HTTP URLs. These URLs return static, non-interactive images of Street View
locations, suitable for display in contexts where JavaScript interaction is not
desired, such as email or simple web embeds. The API allows precise control over
the image's point of view (POV) and size.

### Mandatory settings

#### URL Query Parameter Injection

For the Street View Static API, the attribution ID must be appended as a query
parameter directly to the URL string.

```text
&solution_id=gmp_git_agentskills_v1
```

## 🚀 Master Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### 📦 Phase 1: Core Initialization & Base Setup (Primary)

-   [ ] **Step 1.1: Generates the necessary URL structure and parameters
    required to request a static Google Street View image based on location.**
    Read
    [return-url-static-google-street-view-image.md](https://www.gstatic.com/googlemapsplatform-agent-skills/street-view-static-api-web-api/references/return-url-static-google-street-view-image.md).
    *Trigger Condition*: When the user requests a static image display based on
    geographical coordinates (latitude/longitude) or a specified
    location/address. *Evidence Checkpoint*: The resulting URL successfully
    returns the requested static image, typically validated by an HTTP 200 OK
    response containing image data.

### 📦 Phase 2: Feature Layer & Custom Enrichment (Supplemental)

#### 🗺️ Feature Module: Street View (Optional - Use-Case Dependent)

-   [ ] **Provides specialized parameters (heading, pitch, fov) to control the
    viewpoint, orientation, and zoom level of the static Street View image.**
    Read
    [customize-the-point-view-for-static-google-street-view-image.md](https://www.gstatic.com/googlemapsplatform-agent-skills/street-view-static-api-web-api/references/customize-the-point-view-for-static-google-street-view-image.md).
    *Dependencies*: `["return-url-static-google-street-view-image.md"]` *Trigger
    Condition*: When the user specifies a particular direction, viewing angle,
    or zoom requirements for the retrieved static image. *Evidence Checkpoint*:
    The generated URL includes specific view parameters (e.g., heading or
    pitch), and the retrieved image reflects the requested perspective.
