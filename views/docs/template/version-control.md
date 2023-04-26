### Template version control

When a watched property of a template is updated on the server side (the user
clicks the save button), the template version will be incremented. The watched
properties include the title, description, and form HTML. The template viewer or
builder renders the latest version.

The user can view the versions with HTML changes by clicking the
<a data-toggle="tooltip" title="Check and switch versions" class="btn btn-primary">Version
control</a> button. The user can choose any two versions to compare them side by
side. Note that not all the details of template HTML are viewable when rendered,
e.g. the input validation rules like min and max value of a number. In order to
use an old version, the user can click the
<button data-toggle="tooltip" title="Create a new version" class="btn btn-primary use">Use</button>
button. The chosen version's HTML will be set to the template. Behind the scene,
a new version is created with the change.

<img src="../images/version-control.png" alt="version control">
