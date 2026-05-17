# Traveler User Manual

*Updated on 05/17/2026*

## How to Use

Each section starts with an audience statement. If you are not the target
audience, please feel free to skip that section. While going through the
document, please pay attention to the parts described as configurable. The
traveler application that you are using could have those features disabled.

## Basics

Travelers are electronic documents created from predefined templates. A traveler
lists the tasks in order to finish the work defined by the released work
template. The user records data and notes when performing the tasks. Travelers
can be grouped into working packages named binders. The traveler application
also provides an HTTP API for other applications to operate templates, travelers,
and binders.

[Read more →](basics.md)

## Draft Templates

Before creating travelers, a user needs to design a template and release it
after a review process. A traveler template mimics the paper traveler so that a
process owner defines the sequence of actions and specifies the data to be
collected in each step. There are two types of templates: normal and discrepancy.

[Read more →](template.md)

## Released Templates

When a template is released after the review process, a new released template is
created and listed in the released templates page. A released template can be in
an active or archived status. Released templates are versioned; the application
supports revision to update a released template through a new draft-and-review
cycle.

[Read more →](released-template.md)

## Travelers

A user can create new travelers from released templates. The traveler owner can
configure, share, and approve the completion of a traveler, and work with other
users to input data and notes in order to finish the task. A traveler's status
controls what actions are allowed and who can access it.

[Read more →](traveler.md)

## Binders

A binder is a collection of works that a user puts together for easy management.
Works can be travelers or other binders. A traveler can be included in multiple
binders — for example, grouped by device, project, or responsible user. When a
traveler is updated or completed, all binders containing it are updated
accordingly.

[Read more →](binder.md)

## API

The traveler application provides a limited RESTful API in addition to the web
interface. The API is protected by basic authentication and currently supports
reading the information of travelers, their collected data, and notes.

[Read more →](api.md)

## FAQ

Frequently asked questions covering common issues with saving, session timeouts,
permissions, data correction, and sharing travelers with other users.

[Read more →](faq.md)

## Contact

Please contact Dong Liu (https://github.com/dongliu) if you have questions and need more support.
