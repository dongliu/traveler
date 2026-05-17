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
  {
    "title": "test77 update",
    "status": 0,
    "createdBy": "liud",
    "createdOn": "2014-03-31T15:34:27.947Z",
    "totalInput": 34,
    "finishedInput": 0,
    "_id": "53398b03951887482f000002",
    "sharedWith": [],
    "devices": []
  },
  ...
]
```

The response will be a JSON array containing the list of travelers. Each traveler in the list is represented by a JSON object with traveler id, title, status, devices, createdBy, clonedBy, createdOn, deadline, updatedBy, updatedOn, sharedWith, finishedInput, and totalInput information. The traveler id can be used to retrieve more details of a traveler, https://hostname:port/apis/travelers/:id/ for the JSON representation and http://hostname:port/travelers/:id/ for the HTML representation.

The travler list can also be retrieved by a device name.

- URL: https://hostname:port/apis/travelers/?device=:devicename
  where :devicename is the name of device that was assigned to the travelers.
  section#traveler
