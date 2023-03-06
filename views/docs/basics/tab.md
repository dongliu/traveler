### Tabs and tables

The forms, travelers, and binders pages use tabs for different list of entities.
In each tab, the entities are listed in a table. There are two places that a
button can be placed on a tabbed page. On each list page, when a button is
located on top of the tabs, the button's action is applicable to all the tabs
and tables inside the tabs. When a button is location **inside** a tab, then the
button's action only is applicable to that tab and table.

A typical table has 6 areas each of which either hold optional tools or display
information.

| area | location     | content                                                             |
| ---- | ------------ | ------------------------------------------------------------------- |
| 1    | top left     | a select input to change the number of records shown per table page |
| 2    | top middle   | show a message when the data inside the table is in processing      |
| 3    | top right    | a text input to filter all the columns in the table                 |
| 4    | bottom row   | text inputs to filter the corresponding table column                |
| 5    | bottom left  | the numbers of entries out of the total number shown in the view    |
| 6    | bottom right | pagination controls                                                 |

</br>
<img src="../images/data-tables.png" alt="the areas of a data table">

Some tables have extra tools that allow a user to copy, export, or print the table. The traveler application uses [the datatables js library](https://datatables.net/) for the tables in web UI. Many pages in the application are still on an older version of the library, and the tools are not supported by browsers due to the dependency on the flash technology. We are in the process of updating those pages to use the latest version of datatables library.   

</br>
<img src="../images/data-table-tools.png" alt="data table tools" style="width:25%">