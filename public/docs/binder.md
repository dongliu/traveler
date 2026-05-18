## Binder

**Audience: all users**

A binder is a collection of works that a user puts together for easy management.
Works can be travelers or other binders (when enabled). A traveler can be
included in multiple binders, which can be about a certain device, or a certain
project, or all the works a certain user takes care of. When a traveler is
updated or completed, all the binders including the traveler will be updated.

### Create a new binder

**Audience: all users**

Navigate to the binder list page and click the
<button class="btn btn-primary"><i class="fa fa-paperclip fa-lg"></i>&nbsp;New
binder</button> button. Enter a title and an optional description, then submit
the form. The new binder will be created with `new` status and listed in the
`Binders` tab.

### Add works to a binder

**Audience: binder owner and users with write permission**

A work can be a traveler or another binder. To add a traveler to a binder,
navigate to the travelers page, use the search box to find travelers by the
searchable attributes. Select one or more travelers and click the
<button class="btn btn-primary"><i class="fa fa-briefcase fa-lg"></i>&nbsp;Add
to binder</button> button. A model will appear with the list of available
binders to add into. Select the target binder(s) and click on the
<button id="submit" class="btn btn-primary">Confirm</button> to finish adding.
The selected travelers will appear in the selected binders. If the target binder
already had the traveler, it will not be added again.

Note: a binder cannot be added to itself, and a binder that already contains
another binder cannot itself be added to a binder (no multi-level nesting of
binders within binders).

### Configure a binder

**Audience: binder owner**

The binder owner has permission to configure a binder. Click the
<a data-toggle="tooltip" title="config the binder"><i class="fa fa-gear fa-lg"></i></a>
icon on the binder list table to navigate to the configuration page.
Configuration options include:

- **Title and description** — click the
  <button class="btn btn-primary">Edit</button> button to update
- **Tags (part numbers)** — click the <button class="btn btn-primary">Add part
  numbers</button> button to add a part number; click the
  <button class="btn btn-small btn-warning"><i class="fa fa-trash-o fa-lg"></i></button>
  button next to a tag to remove an existing one
- **Status** — change the binder's lifecycle status
- **Work list** — view and remove works from the configuration page

Click the
<button class="btn btn-small btn-warning"><i class="fa fa-trash-o fa-lg"></i></button>
button on a row to remove the work from the binder.

#### Work properties

**Audience: binder owner and users with write permission**

Each work in a binder has the following properties that can be edited from the
binder page:

<!-- prettier-ignore -->
| Property | Description                                                         |
| -------- | ------------------------------------------------------------------- |
| Sequence | A number defining the order to perform the works                    |
| Color    | A status flag with a color code: green, yellow, red, blue, or black |

Input the new value of Sequence and Color of the work, and then click the
<button id="save" class="btn btn-primary"><i class="fa fa-save fa-lg"></i>&nbsp;Save
changes</button> to save the change.
