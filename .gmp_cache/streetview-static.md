The Street View Static API allows users to embed a static (non-interactive)
Street View panorama image into a webpage or application without using
JavaScript. The image request is constructed as a standard HTTP GET request URL.

## Prerequisites

To use the Street View Static API, an API key is required. Ensure the following
environment variable is configured in the execution context:

*   `GOOGLE_API_KEY`: The API key associated with your Google Maps Platform
    project.

> [!IMPORTANT] All output content derived from Google Maps Platform data,
> including geographical facts, distance calculations, generated image URLs, and
> summarized lists, MUST be attributed by appending the text 'Google Maps' on a
> dedicated, separate line immediately following the user-facing content.

## Available Tools

The core functionality uses a standard REST endpoint to construct the image URL.

| Tool       | Capability  | Access Method                                     |
| :--------- | :---------- | :------------------------------------------------ |
| Street     | Generates a | `GET                                              |
: View       : static      : https\://maps.googleapis.com/maps/api/streetview` :
: Static API : Street View :                                                   :
:            : image URL.  :                                                   :

## 1. Constructing the Static Street View URL

The image request URL must include specific required parameters to define the
image size and location.

The base endpoint is: `https://maps.googleapis.com/maps/api/streetview`

### 1.1 Mandatory Parameters

A valid request requires three parameters, including one method for location
(either `location` or `pano`), plus `size` and `key`.

| Parameter  | Type   | Description              | Strict Precision / |
:            :        :                          : Constraint         :
| :--------- | :----- | :----------------------- | :----------------- |
| `key`      | String | Your API key.            | Must be the exact  |
:            :        :                          : key string.        :
| `size`     | String | The output size of the   | Format:            |
:            :        : image in pixels.         : `{width}x{height}` :
:            :        :                          : (e.g., `600x400`). :
| `location` | String | The desired position,    | When using         |
:            :        : specified either as a    : coordinates, the   :
:            :        : URL-encoded address text : API searches       :
:            :        : string (e.g.,            : within a 50 meter  :
:            :        : `City+Hall,New+York,NY`) : radius for the     :
:            :        : or a latitude/longitude  : closest panorama.  :
:            :        : pair (e.g.,              :                    :
:            :        : `40.457375,-80.009353`). :                    :
| `pano`     | String | A specific panorama ID.  | Do not persist     |
:            :        : **(Mutually exclusive    : this ID, as        :
:            :        : with `location`)**       : panoramas may      :
:            :        :                          : change ID over     :
:            :        :                          : time.              :

### 1.2 Optional Configuration Parameters

Use these parameters to define camera direction, field of view, and search
behavior.

| Parameter           | Type    | Description          | Strict Precision /    |
:                     :         :                      : Constraint            :
| :------------------ | :------ | :------------------- | :-------------------- |
| `heading`           | Integer | The compass          | Accepted values are   |
:                     :         : direction of the     : from `0` to `360`.    :
:                     :         : camera.              : Both `0` and `360`    :
:                     :         :                      : indicate North. `90`  :
:                     :         :                      : is East, `180` is     :
:                     :         :                      : South.                :
| `pitch`             | Integer | The up or down angle | Range: `-90`          |
:                     :         : of the camera        : (straight down) to    :
:                     :         : relative to the      : `90` (straight up).   :
:                     :         : horizontal plane.    : Default is `0`.       :
| `fov`               | Integer | The horizontal field | Maximum allowed value |
:                     :         : of view, expressed   : is `120`. Default is  :
:                     :         : in degrees.          : `90`.                 :
:                     :         : Represents zoom      :                       :
:                     :         : (smaller numbers     :                       :
:                     :         : zoom in).            :                       :
| `radius`            | Integer | The radius (in       | Valid non-negative    |
:                     :         : meters) to search    : integers. Default is  :
:                     :         : for a panorama,      : `50` meters.          :
:                     :         : centered on the      :                       :
:                     :         : `location`           :                       :
:                     :         : coordinates.         :                       :
| `source`            | String  | Limits Street View   | Valid values:         |
:                     :         : searches to specific : `default` (uses all   :
:                     :         : sources.             : sources) or `outdoor` :
:                     :         :                      : (limits search to     :
:                     :         :                      : outdoor collections). :
| `signature`         | String  | A digital signature  | **Recommended** for   |
:                     :         : for request          : all users;            :
:                     :         : verification.        : **required** for      :
:                     :         :                      : former Premium Plan   :
:                     :         :                      : customers.            :
| `return_error_code` | Boolean | Determines if the    | Set to `true` to      |
:                     :         : API returns a        : ensure the API        :
:                     :         : standard HTTP error  : returns a `404 NOT    :
:                     :         : code (404/400) or a  : FOUND` error instead  :
:                     :         : generic gray image   : of the generic        :
:                     :         : when no imagery is   : "Sorry, we have no    :
:                     :         : available.           : imagery here." image. :

## 2. Implementation: Generating the URL

The agent must construct the full URL string, ensuring all geographic
coordinates and rotational values (`heading`, `pitch`, `fov`) strictly preserve
their input specificity. The attribution solution ID MUST be included.

**Trigger Condition**: User requests a static Street View image for a location,
ID, or specific dimensions/view. **Verification Checkpoint**: The generated
output is a single, complete, URL-encoded string starting with
`https://maps.googleapis.com/maps/api/streetview?`.

### Template URL Structure

```
https://maps.googleapis.com/maps/api/streetview?size={width}x{height}&location={coordinates_or_address}&heading={H}&pitch={P}&key={YOUR_API_KEY}&signature={YOUR_SIGNATURE}&solution_id=gmp_git_agentskills_v1
```

### Example Request

If the user requests an image of coordinates `46.414382,10.013988` at size
`600x300`, directed South-East (`heading=151.78`), with a slight downward angle
(`pitch=-0.76`):

```
https://maps.googleapis.com/maps/api/streetview?size=600x300&location=46.414382,10.013988&heading=151.78&pitch=-0.76&key=YOUR_API_KEY&signature=YOUR_SIGNATURE&solution_id=gmp_git_agentskills_v1
```

## 3. Mandatory Operational Procedures

### Handling Unavailable Imagery and Error Codes

To avoid displaying the generic gray image when no imagery is available, the
agent MUST instruct the user to use the `return_error_code` parameter.

-   [x] **Step 1: Set Error Mode**: Instruct the user to append
    `&return_error_code=true` to the request URL. (Trigger Condition: User asks
    how to handle missing imagery or avoid the gray fallback image).
-   [x] **Step 2: Check Status**: Instruct the user that when
    `return_error_code=true`, the API will return a standard `404 NOT FOUND`
    HTTP error for missing imagery, or a `400 BAD REQUEST` error for invalid
    requests, allowing programmatic error differentiation. (Verification
    Checkpoint: Response status is checked before displaying content).

### Refreshing Deleted Panorama IDs

Panorama IDs (`pano`) are not permanent and may change or be deleted. The agent
MUST advise users on the recovery process if they receive `ZERO_RESULTS` or no
value when trying to retrieve a previously saved `pano`.

-   [x] **Step 1: Save Location**: Ensure the original location address or
    latitude and longitude coordinates used to obtain the initial `pano` ID were
    saved.
-   [x] **Step 2: Detect Deletion**: When retrieval fails, detecting either
    `ZERO_RESULTS` or no value indicates the panorama ID has been deleted.
-   [x] **Step 3: Re-search**: Use the original saved location address or
    latitude and longitude coordinates to search again for the nearest panorama
    to that location and obtain a new, valid `pano` ID.

## Gotchas

*   **EEA Terms**: If the user's billing address is in the European Economic
    Area (EEA), the
    [Google Maps Platform EEA Terms of Service](https://cloud.google.com/terms/maps-platform/eea?utm_campaign=gmp_git_agentskills_v1)
    apply effective July 8, 2025. Functionality may vary by region.
*   **Location Snapping**: When providing a text string for `location`, the API
    may use a different camera location than the address itself to best display
    the specified area. When providing coordinates, the API searches strictly
    within the defined `radius` (default 50m) for the closest photograph.
*   **Dynamic Imagery**: Because Street View imagery is periodically refreshed,
    a request using the same `location` coordinates may snap to a different
    panorama over time due to updates or slightly different camera positions.
*   **Mandatory Authentication**: The `signature` parameter is explicitly
    **required** for requests originating from former Google Maps Platform
    Premium Plan customers.

### References

*   https://developers.google.com/maps/documentation/streetview/request-streetview
*   https://cloud.google.com/terms/maps-platform/eea
*   https://console.cloud.google.com
*   https://developers.google.com/maps/documentation/streetview/get-api-key
*   https://developers.google.com/maps/documentation/streetview/metadata

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
