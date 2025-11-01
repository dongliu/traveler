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
