### View a traveler

**Audience: traveler users**

The user can directly load the traveler in the browser with a traveler's URL. If
the user has only read permission of the traveler, the browser will redirect to
a read-only view. On the travelers page, click on the
<a data-toggle="tooltip" title="go to the traveler"><i class="fa fa-edit fa-lg"></i></a>
icon in order to the traveler page.

In a traveler page, the top line is the traveler's title. Below the title is the
traveler status, and progress. The progress tells the number of inputs updated
out of the total inputs. The numbers represent only rough progress
**estimation** of the traveler. A traveler can be complete when some inputs have
not be updated.

The <button class="btn btn-info collapsed">Details</button> button shows/hides
some detailed information of the traveler including the description, creation
user/time and last update user/time. The details information is hidden by
default.

The
<span data-toggle="buttons-radio" class="btn-group"><button id="show-validation" class="btn btn-info">Show
validation</button><button id="hide-validation" class="btn btn-info active">Hide
validation</button></span> buttons show/hide the validation information for the
traveler inputs. The validation information include a summary section shown
under the buttons, and a validation message under each input. The
[validation rules](#builder) are defined in the form that is used as the active
form.

The
<span data-toggle="buttons-radio" class="btn-group"><button id="show-notes" class="btn btn-info">Show
notes</button><button id="hide-notes" class="btn btn-info active">Hide
notes</button></span> buttons show/hide the notes under each input. The
<span class="badge badge-info">n</span> icon shows the number of notes.

The value displayed in an input is the latest value saved on the server. The
history of changes is shown under each input including the submitted value,
submitter id and submission time.

When a traveler has several sections, a side navigation menu is created on the
right side. When scrolling up and down the page, the section corresponding to
the content in the current view is highlighted in the navigation menu.
