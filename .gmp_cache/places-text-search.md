## Places API: Text Search (New)

The Text Search (New) capability returns information about a set of places
matching a provided text string and optional geographical constraints. This
capability is exposed via a standard REST API endpoint and requires explicit
field selection (FieldMask).

### Prerequisites

To execute requests against the Places API (New), ensure you have:

1.  A valid Google Maps Platform API key.
2.  Set the global environment variable `GOOGLE_API_KEY` to your key, as it is
    required in the request headers.

### Available Tools

Tool Name           | Description                                                                         | Protocol  | Endpoint
:------------------ | :---------------------------------------------------------------------------------- | :-------- | :-------
`places:searchText` | Executes a text-based search for places, supporting filtering and location biasing. | HTTP POST | `https://places.googleapis.com/v1/places:searchText`

> [!IMPORTANT] When providing any answer derived from Google Maps Platform data
> (including lists of places, formatted addresses, locations, or ratings), the
> agent MUST append the attribution text `Google Maps` on a dedicated, separate
> line immediately following the user-facing content.

### Implementation Guide: Text Search (New)

Text Search (New) is performed using an HTTP POST request, passing all
configuration parameters in the JSON request body or specific headers.

#### Step 1: Define the Request Structure

The request body must contain the search query (`textQuery`) and the response
must include a mandatory FieldMask specified in the `X-Goog-FieldMask` HTTP
header.

| Parameter                 | Type   | Location    | Description               |
| :------------------------ | :----- | :---------- | :------------------------ |
| `textQuery`               | String | JSON Body   | The required text string  |
:                           :        :             : on which to search (e.g., :
:                           :        :             : "restaurant", "123 Main   :
:                           :        :             : Street").                 :
| `X-Goog-Api-Key`          | String | HTTP Header | Your API key.             |
| `X-Goog-Maps-Solution-ID` | String | HTTP Header | Mandatory attribution ID  |
:                           :        :             : for this agent's usage.   :
| `X-Goog-FieldMask`        | String | HTTP Header | **Required.** Specifies   |
:                           :        :             : the list of `Place`       :
:                           :        :             : fields to return,         :
:                           :        :             : determining the billing   :
:                           :        :             : SKU.                      :

**Example Request Template**

```bash
curl -X POST -d '{\n  "textQuery" : "QUERY_STRING"\n}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: API_KEY' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
-H 'X-Goog-FieldMask: FIELD_LIST' \
'https://places.googleapis.com/v1/places:searchText'
```

#### Step 2: Configure the FieldMask (Mandatory)

The `X-Goog-FieldMask` header is mandatory. Failure to include it results in an
error. The fields requested determine the billing SKU (Section: Required
parameters).

| SKU Triggered     | Example Fields                    | Description          |
| :---------------- | :-------------------------------- | :------------------- |
| **Text Search     | `places.id`, `places.name`,       | Retrieves basic      |
: Essentials ID     : `nextPageToken`                   : identifiers and      :
: Only SKU**        :                                   : pagination tokens.   :
:                   :                                   : Note\: `places.name` :
:                   :                                   : is the resource      :
:                   :                                   : name; use            :
:                   :                                   : `places.displayName` :
:                   :                                   : (Pro SKU) for the    :
:                   :                                   : text name.           :
| **Text Search Pro | `places.displayName`,             | Retrieves common     |
: SKU**             : `places.formattedAddress`,        : location and display :
:                   : `places.location`,                : data.                :
:                   : `places.priceLevel`               :                      :
| **Text Search     | `places.rating`,                  | Retrieves detailed   |
: Enterprise SKU**  : `places.websiteUri`,              : information like     :
:                   : `places.priceRange`,              : ratings and contact  :
:                   : `places.internationalPhoneNumber` : details.             :
| **Wildcard        | `*`                               | Returns all          |
: (Development      :                                   : available fields.    :
: Only)**           :                                   : **Discouraged** in   :
:                   :                                   : production due to    :
:                   :                                   : billing and large    :
:                   :                                   : data transfer size.  :

**Example FieldMask Header (Essentials + Pro)**: `X-Goog-FieldMask:
places.id,places.displayName,places.formattedAddress`

#### Step 3: Apply Filtering and Constraints

Use optional parameters in the JSON request body to refine the search results.

##### Location Constraints (`locationBias` vs `locationRestriction`)

Use either `locationBias` or `locationRestriction`, but not both. If both are
omitted, IP biasing is used by default.

| Parameter             | Type   | Usage                | Constraint           |
| :-------------------- | :----- | :------------------- | :------------------- |
| `locationBias`        | Object | Serves as a          | Define as a `circle` |
:                       :        : suggestion; results  : (center/radius up to :
:                       :        : *around* the         : 50000.0 meters) or a :
:                       :        : specified location   : `rectangle`          :
:                       :        : can be returned,     : (viewport defined by :
:                       :        : including results    : `low` (SW) and       :
:                       :        : outside the area.    : `high` (NE) points). :
| `locationRestriction` | Object | **Strictly limits**  | Must be defined as a |
:                       :        : results to be within : `rectangle`          :
:                       :        : the specified area.  : viewport.            :
:                       :        : Only applies to      :                      :
:                       :        : categorical queries  :                      :
:                       :        : (e.g.,               :                      :
:                       :        : "Restaurants").      :                      :

**Example: Bias to a 500m circle**

```json
"locationBias": {
  "circle": {
    "center": {
      "latitude": 37.7937,
      "longitude": -122.3965
    },
    "radius": 500.0
  }
}
```

##### Standard Filters

Parameter                        | Type             | Description
:------------------------------- | :--------------- | :----------
`includedType`                   | String           | Biases results to a single place type from [Table A](https://developers.google.com/maps/documentation/places/web-service/place-types?utm_campaign=gmp_git_agentskills_v1#table-a) (e.g., `"bar"`).
`strictTypeFiltering`            | Boolean          | Used with `includedType`. If `true`, only places matching the type are returned. Default is `false`.
`openNow`                        | Boolean          | If `true`, returns only places currently open for business. (Does not apply to hotel/geopolitical queries).
`minRating`                      | Float            | Restricts results to places with an average user rating >= this value. Must be between 0.0 and 5.0 in 0.5 increments (e.g., 0.0, 0.5, 1.0, ..., 5.0).
`priceLevels`                    | Array of Strings | Restricts search to specific price levels (e.g., `["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"]`). Cannot include `PRICE_LEVEL_FREE`.
`rankPreference`                 | String           | Specifies result sorting. For categorical queries, use `RELEVANCE` (default) or `DISTANCE`.
`includeFutureOpeningBusinesses` | Boolean          | If `true`, includes businesses expected to open in the future. Requires `places.businessStatus` and/or `places.openingDate` in the FieldMask.

#### Step 4: Handle Paging

The API returns a maximum of 20 results per page by default, though the total
results limit is 60 (Section: Text Search (New) responses).

-   [ ] Check if the desired number of results exceeds 20. If so, specify
    `pageSize` (1 to 20) in the request body.
-   [ ] After receiving the first response, check for the presence of a
    `nextPageToken` in the response JSON.
-   [ ] To retrieve the next page, issue a subsequent `searchText` POST request.
-   [ ] Include the `nextPageToken` value in the `pageToken` parameter in the
    new request body.
-   [ ] **Trigger Condition**: User asks for more than 20 results, or the
    initial response contains `nextPageToken`.
-   [ ] **Verification Checkpoint**: The `nextPageToken` is consumed in the
    subsequent request, and all request parameters (except `pageSize` and
    `pageToken`) are identical to the original request to avoid an
    `INVALID_ARGUMENT` error.

**Example Paging Request (Second Page)**:

```json
{
  "textQuery": "pizza in New York",
  "pageSize": 5,
  "pageToken": "AeCrKXsZWzNVbPzO-MRWPu52jWO_Xx8aKwOQ69_Je3DxRpfdjClq8Ekwh3UcF2h2Jn75kL6PtWLGV4ecQri-GEUKN_OFpJkdVc-JL4Q"
}
```

### Gotchas

*   **FieldMask is Mandatory**: You MUST include the `X-Goog-FieldMask` header
    specifying the desired fields (e.g.,
    `places.displayName,places.formattedAddress`). Omitting this header results
    in an error (Section: FieldMask).
*   **Paging Consistency**: When using `pageToken` for subsequent results, all
    request parameters other than `pageSize` and `pageToken` MUST remain
    unchanged from the initial request. Failure to maintain parameter
    consistency will result in an `INVALID_ARGUMENT` error.
*   **Location Constraints Conflict**: You cannot specify both `locationBias`
    and `locationRestriction` in the same request.
*   **Ambiguous Queries**: Text Search (New) is not intended for ambiguous
    queries like combining multiple concepts/cities ("Market Street San
    Francisco San Jose Airport") or using non-geospatial elements ("How many
    boats are in Ventura Harbor?") (Section: textQuery).

### References

*   Text Search (New) reference:
    `https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText`
*   Choosing Fields:
    `https://developers.google.com/maps/documentation/places/web-service/choose-fields`
*   Places API Place Types:
    `https://developers.google.com/maps/documentation/places/web-service/place-types`
*   Google Maps Platform EEA Terms of Service:
    `https://cloud.google.com/terms/maps-platform/eea`

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
