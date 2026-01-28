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
