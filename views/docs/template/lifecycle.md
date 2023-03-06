### States and life cycle of templates

The following diagram shows the state transition of a template and a released template.

<figure align="center">
<img src="../images/template-life.png" alt="template life cycle">
<figcaption>
States and life cycle of templates
</figcaption>
</figure>

There are two groups of templates: draft and released. A traveler can be created
from only a released template. The traveler application support the review and
approval process of templates.

A template is editable after created. When a draft template is not needed any
more, the owner can archive it. The owner can clone an archived template to
generate a new draft template if some work needs to pick up later.

When a draft template is ready for review, its owner can request one or more
reviewers to check of the template is good to release. A reviewer can either
approve or request for change. When changes are requested, the form becomes
editable and the review process ends. All the reviewers must approve before a
templated can be released. 

When a user release a template after a successful review process, a new released
template is created. The user can choose to archive previously released
templates from the same draft template maybe different versions. If the draft
template is a normal template, the user can choose to attach a released
discrepancy template with it. 

A released template can be archived so that no new travelers can be created from
it any more. This happens when the process is obsoleted or a new process is
available. 
