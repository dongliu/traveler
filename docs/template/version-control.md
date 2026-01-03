### Template version control

When a watched property of a template is updated on the server (the user clicks
the save button), the template version will be incremented. The watched
properties include the title, description, and HTML. The template viewer or
builder always renders the latest version when refreshed.

The user can view the versions with HTML changes by clicking the
<a data-toggle="tooltip" title="Check and switch versions" class="btn btn-primary">Version
control</a> button. The user can choose any two versions to compare them side by
side. Note that not all the details of template HTML are viewable when rendered,
e.g. the input validation rules like min and max value of a number. The user can
"revert" the template to an old version by clicking the
<button data-toggle="tooltip" title="Create a new version" class="btn btn-primary use">Use</button>
button. In order to record the change, a new version is created for the
template.

<img src="{{ "/assets/img/version-control.png" | relative_url }}" alt="version control">
