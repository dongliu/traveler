### View a traveler

**Audience: traveler users**

If you know the traveler's URL, you can directly load the traveler in browser. A traveler's URL is like `/travelers/longstringid/`. If you have only read permission of the traveler, the browser will redirect to `/travelers/longstringid/view` automatically.

You can also locate the traveler in your tabs, and then click on the <a data-toggle="tooltip" title="go to the traveler"><i class="fa fa-edit fa-lg"></i></a> icon to go to the traveler page.

In a traveler page, the top line is the traveler's title. Below the title is the traveler status, and progress. The progress tells the number of inputs updated out of the total inputs. The numbers represent only rough progress **estimation** of the traveler. A traveler can be complete when some inputs have not be updated.

The <button class="btn btn-info collapsed">Details</button> button shows/hides some detailed information of the traveler including the description, creation user/time and last update user/time. The details information is hidden by default.

The <span data-toggle="buttons-radio" class="btn-group"><button id="show-validation" class="btn btn-info">Show validation</button><button id="hide-validation" class="btn btn-info active">Hide validation</button></span> buttons show/hide the validation information for the traveler inputs. The validation information include a summary section shown under the buttons, and a validation message under each input. The [validation rules](#builder) are defined in the form that is used as the active form.

The <span data-toggle="buttons-radio" class="btn-group"><button id="show-notes" class="btn btn-info">Show notes</button><button id="hide-notes" class="btn btn-info active">Hide notes</button></span> buttons show/hide the notes under each input. The <span class="badge badge-info">n</span> icon shows the number of notes.

The value displayed in an input is the latest value submitted to the server. The history of the input value changes is shown including the submitted value, submitter id and submission time.

When a traveler is composed of several sections, you will see a side navigation menu on the right side. The side navigation is affixed, so that you can use it to jump to any section when you want. The section corresponding to the content in the view is automatically highlighted in the navigation menu.
