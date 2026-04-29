### Generate a report from travelers

**Audience: traveler owner, traveler users with read permission**

#### User defined keys in a template

Each input in a template can be assigned a **user defined key** in the template
builder. The key does not appear in the rendered traveler form, but it serves as
a pre-defined stable identifier for that input when exporting data or calling
the API.

Rules for user defined keys:

- Must be unique within the template. If not, the template change will not be
  saved.
- Only letters, numbers, and underscores (`_`) are allowed, e.g : `veri_out`.
- Once a template with user defined keys is released and travelers are created
  from it, those keys can be used for reporting.

To set a user defined key, open the template in the builder and click the
<a data-toggle="tooltip" title="edit" class="btn btn-info"><i class="fa fa-edit fa-lg"></i></a>
button on the input component. Enter the key in the **User defined key** field
and click <button class="btn btn-primary">Done</button>. Save the template after
all keys are set.

<img src="../images/user-key.png" alt="input with user defined key">

Not every input needs a user defined key. Only assign keys to inputs whose
values should appear as named columns in a report.

#### Generate a report from a group of travelers

**Audience: traveler owner**

A report collects the values of inputs that share the same user defined keys
across a group of travelers. Each traveler becomes one row in the report, and
each user defined key becomes one column.

To generate a report:

1. Navigate to the <a href="/travelers/">Travelers</a> list page, or a Binder
   page.
2. Filter or search the travelers you want to include in the report. You can
   filter by tags, status, or travelers with the same user defined keys to
   narrow the list to a relevant group.

   <img src="../images/search-by-key.png" alt="filter by user defined key">

3. Click the
   <button data-toggle="tooltip" title="generate report for selected travelers" class="btn btn-primary"><i class="fa fa-table fa-large"></i>&nbsp;Generate
   report</button> button at the top of the travelers list.
4. The report table is displayed on the page. Each row is one traveler. The
   columns are system defined keys including the traveler title, status,
   devices, and user defined keys. All the keys can be selected or deselected in
   the top control panel to be shown or hide from the reporting table.
5. Click <button class="btn">CSV</button> or <button class="btn">Excel</button>
   to export the report as a comma-separated values file or an Excel file.

   <img src="../images/report.png" alt="report table and control">

When a traveler has no value recorded for a key, that cell is left blank in the
report. When the same template is used for all selected travelers, every row
will have the same set of columns. When travelers come from different templates,
all the possible keys of all selected travelers will appear.
