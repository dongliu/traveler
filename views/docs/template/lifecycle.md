### States and life cycle of templates

The following diagram shows the states of templates and how a template can
transfer from one state to the other.

<figure align="center">
<img src="../images/template-life.png" alt="template life cycle">
<figcaption>
States and life cycle of templates
</figcaption>
</figure>

Overall, there are two different templates, draft and released. A traveler can
be created from only a released template, not from a draft template. This allow
a manager or lead engineer to enforce a template approval process so that a
draft must be approved before it can be used in the field.

When a new template is created, it is a draft. Updating will not change its
draft status. When there is no need to continue working on a draft template, it
can be archived. This will help keep a clean work space. Archiving is like soft
deletion. However, one can also clone from an archived template to generate a
new draft template.

When one think a template is ready to be used in the field, s/he can submit the
template for approval. A user with manager or admin role can review the
submitted template, and approve or reject it. When a draft template is approved,
a released template will be created with version. The draft template still
exists so that its owner can continue to improve it. When a submission is
rejected, the template becomes a draft. After a draft template is submitted for
approval, and before the decision is made, no one can update the content of the
template.

No one can update the content of a released template, so that all the travelers
created from the same released template for a specific version share the same
look. A released traveler can be archived as well. When it becomes archived, no
traveler can be created from it.

When a template needs to be improved, a manager can release a new version of
template, and archive an old version of template.
