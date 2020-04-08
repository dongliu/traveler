### Manage templates in a traveler (deprecated)

This feature was **removed** after we implemented a template release process. The
rational is that we should not change the traveler specification (templates)
once it is executed in the field. If there is any change to the work, there
should be a new traveler based on a new versions of released templates.

**Audience: traveler owner**

When you want to change the procedure described in a traveler, you will need to
update the corresponding form of the traveler. Such a change can be to adjust
the sequence of the elements in the form or to add/remove elements. You can
always create a new traveler from the updated form, and start from there.
However, you might want to update an active traveler that already collected data
and notes. The traveler form management feature is designed for this purpose.
The owner of a traveler can use a new form in the traveler. S/he can also switch
back to a form previously used in the traveler when needed.

Click the <a id="manage" class="btn btn-primary">Manage forms</a> button to go
to the form manager page for the traveler. The left side of the form manager
page has three tables: the active form, the used forms, and the available forms.
The right side is a preview of the traveler with the selected form and the data
and notes already collected in the traveler. When the page first loaded, the
active form is highlighted. The active and used forms table contains form
aliases and their last activation date.

<img src="../images/form-manager.png" alt="form manager page">

The available forms table contains the same set of forms as in the "My forms"
tab on the main page of the traveler application. A form will be selected and
highlighted when you click the <a><i class="fa fa-eye fa-lg"></i></a> icon, and
the preview on the right side of the page will be refreshed. A <a><i class="fa
fa-edit fa-lg"></i></a> icon in the "Reference" column links to the form that
was originally based on. You might want to use an updated version of that form
to update the traveler. Note that a traveler contains only the snapshot copy of
the form when it is used.

#### Use an available form

First locate the form that you want to use in the available forms table. You can
filter the table by the title of the forms. Then you need to click the <a><i
class="fa fa-eye fa-lg"></i></a> icon of the wanted form, the right side
traveler preview will be updated, and the form row is highlighted. Click the
<button id="use" class="btn btn-primary"><i class="fa fa-eject fa-lg"></i>
<span>Use selected form</span></button> and confirm, and the form will be added
to be traveler and become active.

The new form will appear in the active form table, and the previously active
form will appear in the used forms table. The change will be seem by all users.

#### Switch back to a used form

Sometimes, you might find one of the previously used forms is better than the
current active one. You can easily switch by choosing the one you like in the
"Used forms" table, and click the <button id="use" class="btn btn-primary"><i
class="fa fa-eject fa-lg"></i> <span>Use selected form</span></button> button.

After switching, the active form and used forms table will be adjusted
accordingly. The traveler update will be seen when it is loaded or refreshed.

#### Set the alias of a form

Every form that has been used by the traveler has an alias. When a form was
first used by the traveler, the alias is the same as the form's title. You can
update it by selecting it and click the <button id="set-alias" class="btn
btn-warning"><i class="fa fa-edit fa-lg"></i> <span>Set alias</span></button>
button. The alias can help to distinguish forms.

#### The impact on the estimated traveler progress

The traveler progress is estimated by (number of finished inputs / total number
of inputs). When the traveler form is changed, the total number of inputs will
also be updated. However, the traveler updates the number of finished inputs
only when the traveler is loaded with the collected data after the change. It is
recommended that you load the traveler in a new browser window right after the
form change in order to verify the change and also update the progress
estimation.
