### Update the data and notes in a traveler

**Audience: traveler users with write permission**

To update traveler data and notes might be the most important feature of the traveler application. It is also the most popular feature used by the users. In order to be able to update the data and notes of a traveler, you have to have the write permission of the traveler, which means you are the owner of the traveler, or the owner shared with you or your group with write permission.

A traveler's data can be updated only when it is in the [active status](#traveler-status). When the traveler is in other statuses, you will see all the inputs are disabled when you load the `/travelers/longstringid/` page. Note that `/travelers/longstringid/view` is dedicated for view only access, so that you cannot update data or notes on that page even if you have write permission.

In order to update the value of an input element, a user need to click on the input, and type the new value. When the new value is different from the old value, two buttons will appear on the right side of the input element. Click the <button value="save" class="btn btn-primary">Save</button> button to submit the change to the traveler server. Or click the <button value="reset" class="btn">Reset</button> button to reset to the old value. Before you click either button, the rest of the traveler is disabled. That means you cannot make other change before submitting the current change or resetting it. If the change is saved on the server, there will be a

<div class="alert alert-success"><button class="close">x</button>Success</div>
message on the top of the page. If something is wrong, then an 
<div class="alert alert-error"><button class="close">x</button>Error</div>
message will appear.

In order to add a new note, click the <a class="new-note" data-toggle="tooltip" title="new note"><i class="fa fa-file-o fa-lg"></i></a> icon. Click the <span class="badge badge-info">n</span> icon to show/hide the notes.
