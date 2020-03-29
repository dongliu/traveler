### Ownership and access control

The access control in the traveler application is both **role based** and also
**attribute based**. With role based access control, some functionalities can be
performed only by user with specific **roles**. E.g. only administrators can
modify user roles. Only managers or administrations can release a form. With
attribute based access control, a traveler entity can be configured to be
readable or writable by various users or user groups.

The traveler application has three types of important entities: templates,
travelers, and binders. Each entity has a owner. The **owner** is the user who
creates the entity at the beginning. The ownership can be transferred to a
different user by current owner. The owner has full privileges of an entity. The
owner of an entity is responsible to **design**, **develop**, and **deliver**
the entity. The owner, by default, has the privilege to configure important
properties of the entity including, most importantly, the access control.

There are three levels of access control for an entity that its owner can
configure. The first level is **public access**. An entity can be inaccessible,
readable, or writable to any **authenticated** user. It an entity is publicly
readable, then any authenticated user will be able to view the entity's details.
The default value of public access for a new entity in the traveler application
is configurable.

The second level of access control is via **shared users**. The owner can add a
user into the shared user list with read or write permission. The shared entity
will also appear in the _shared entity_ tab of the user.

The third level of access control is via **shared groups**. The owner can add a
group into the shared group list with read or write permission. If an entity is
configured to the readable by a group named _a.b.c_ then all the members of the
group will be able to view it when log in. The shared entity will also appear in
the _group shared entity_ tab of the group members.

Whether a user can read or write an entity is decided by the combination of the
three levels of rules. The strong permissions override the weak ones. For
example, an entity is readable by a group named _a.b.c_, and writable by a group
named _a.b.c.d_, then a member of group _a.b.c.d_ will have both read and write
permission. A member of group _a.b.c.e_ will have only read permission.

In practice, the owner can share an entity with write permission to a few
individual uses, and share it with a group with read permission. Or you can
share an entity with read permission with a big group like _a.b.c_, and at the
same time share it with write permission with a small group like _a.b.c.d_.
