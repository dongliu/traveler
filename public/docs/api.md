## Application programming interface

**Audience: developers**

The traveler application provides a limited API (application programming
interface) besides the Web interface. The API is designed in a
[RESTful](https://en.wikipedia.org/wiki/Representational_state_transfer) style.
Currently, other applications can read the information of travelers through the
API.

### API authentication

The API's are protected by basic authentication. If a client gets 401 response with "api" realm challenge, then the client either did not present the credential in the request or the presented credential was not right. Please contact the application operator for available credentials.

### The list of travelers

- Method: GET
- URL: https://hostname:port/apis/travelers/
- Sample response:

```json
[
  {
    "_id": "52f3f98a87d4808008000002",
    "createdBy": "liud",
    "createdOn": "2014-02-06T21:07:22.730Z",
    "devices": [],
    "sharedWith": [],
    "status": 0,
    "title": "update me"
  },
  {
    "_id": "52f8ed88f029d24d2b000002",
    "createdBy": "liud",
    "createdOn": "2014-02-10T15:17:28.849Z",
    "deadline": "2014-02-28T05:00:00.000Z",
    "devices": [],
    "finishedInput": 4,
    "sharedWith": [],
    "status": 1.5,
    "title": "a long traveler",
    "totalInput": 36,
    "updatedBy": "liud",
    "updatedOn": "2014-03-18T19:12:25.739Z"
  },
  ...
]
```

The response will be a JSON array containing the list of travelers. Each traveler in the list is represented by a JSON object with traveler id, title, status, devices, createdBy, clonedBy, createdOn, deadline, updatedBy, updatedOn, sharedWith, finishedInput, and totalInput information. The traveler id can be used to retrieve more details of a traveler, https://hostname:port/apis/travelers/:id/ for the JSON representation and http://hostname:port/travelers/:id/ for the HTML representation.

The traveler list can also be retrieved by a device name.

- URL: https://hostname:port/apis/travelers/?device=:devicename
  where :devicename is the name of device that was assigned to the travelers.

### The details of a traveler

- Method: GET
- URL: https://hostname:port/apis/travelers/:id/
  where :id is the id of the traveler to be retrieved
- Sample response:

```json
{
  "__v": 26,
  "_id": "53bbf46e2ace2f7f111d76c8",
  "createdBy": "liud",
  "createdOn": "2014-07-08T13:38:54.529Z",
  "description": "",
  "finishedInput": 2,
  "referenceForm": "5283aa947185189f61000001",
  "status": 1,
  "title": "test validation",
  "totalInput": 7,
  "updatedBy": "liud",
  "updatedOn": "2014-08-12T13:56:02.090Z",
  "archived": false,
  "notes": [
    "53e2380cd48af61751d91394",
    "53e38b47d48af61751d91395",
    ...
  ],
  "data": [
    "53bbf6b52ace2f7f111d76ca",
    "53bbf6cd2ace2f7f111d76cb",
    ...
  ],
  "activeForm": 0,
  "forms": [
    {
      "html": "...",
      "_id": "53bbf46e2ace2f7f111d76c9"
    }
  ],
  "sharedWith": [],
  "devices": []
}
```

The traveler details JSON object contains more information than the object in a traveler list. The "forms" property contains a list of the forms that were used in this traveler. Currently, only one form is allowed for a traveler. The "data" property contains the data id's that were collected in the traveler. The "notes" property holds the note id's that were inputed in the traveler.

### Data collected in a traveler

- Method: GET
- URL: https://hostname:port/apis/travelers/:id/data/
  where :id is the id of the traveler whose data is retrieved
- Sample response:

```json
[
  {
    "name": "2f067ecd",
    "value": true,
    "inputType": "checkbox",
    "inputBy": "liud",
    "inputOn": "2014-07-08T13:48:37.972Z",
    "_id": "53bbf6b52ace2f7f111d76ca"
  },
  {
    "name": "d134f3cd",
    "value": "something",
    "inputType": "textarea",
    "inputBy": "liud",
    "inputOn": "2014-07-08T13:49:01.784Z",
    "_id": "53bbf6cd2ace2f7f111d76cb"
  },
  ...
]
```

Each data item in the list contains the input name in the form, the input type and the value. Besides, it also records who input the value at what time, by which the input history can be generated. For file input, the value is the file's original name when it was uploaded. In order to retrieve the content of the file, the following file API can be used.

#### File uploaded in a traveler

Files are special data collected, and they can be retrieved by

- Method: GET
- URL: https://hostname:port/apis/data/:id/
  where :id is the id of the data whose type is file.

### Notes in a traveler

- Method: GET
- URL: https://hostname:port/apis/travelers/:id/notes/
  where :id is the id of the traveler whose notes are retrieved
- Sample response:

```json
[
  {
    "name": "2f067ecd",
    "value": "first notes",
    "inputBy": "liud",
    "inputOn": "2014-08-06T14:13:32.233Z",
    "_id": "53e2380cd48af61751d91394"
  },
  {
    "name": "2f067ecd",
    "value": "live stamp",
    "inputBy": "liud",
    "inputOn": "2014-08-07T14:20:55.944Z",
    "_id": "53e38b47d48af61751d91395"
  },
  ...
]
```

Similar to the data API, each note item in the list contains the input name in the form and the note text. Besides, it also records who input the note at what time, by which the note history can be generated.
