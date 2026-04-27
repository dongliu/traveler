### States and life cycle of a template

The following diagram shows the state transition of a template and a released
template.

<figure align="center">
<img src="../images/template-life.png" alt="template life cycle">
<figcaption>
States and life cycle of templates
</figcaption>
</figure>

There are two groups of templates: draft and released. Only a released template
can be used to create a traveler. The traveler application supports the review
and approval process of templates.

A template is a draft and editable when created. When a draft template is not
needed any more, the owner can archive it. The owner can clone an archived
template to generate a new draft template if some work needs to be picked up
later.

When a draft template is ready for review, its owner can request one or more
reviewers to check if the template is good to release. A reviewer can either
approve or request for change. When any reviewer requests a change, the review
process ends and the form becomes editable. All the reviewers must approve
before a template can be released.

When a user releases a template after a successful review process, a new
released template is created. The user can choose to archive previously released
templates from the same draft template of different versions. If the draft
template is a normal template, the user can choose to attach a released
discrepancy template with it.

A released template can be archived. Travelers can be created from an archived
released template. This happens when the process is obsoleted or a new process
is available.
