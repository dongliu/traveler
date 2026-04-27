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
    "53e39121d48af61751d91396",
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
