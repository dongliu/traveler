### Ownership, roles, and access control

The traveler application supports **role based** and **attribute based** access
control. When a user requests to access a resource, both the user's roles in the
current session and the resource's access related attributes are considered. The
access is granted if either the role or the attribute allows.

There are three special roles, admin, manager, and reviewer. A user can be
associated with multiple roles. Only an admin can modify a user's roles. Only a
reviewer can review a submitted template to release. An admin or a manager is
capable of reading and writing all resources in the application.

The traveler application has three important entity types: template, traveler,
and binder. Each type has three attributes to control the access, the ownership,
sharing, and public accessibility.

There are three levels of access privileges: no access, read, and write. The
details are listed in the following table.

| access privilege | details | 
|----------|-----------------------------|
| no access | rejected when requesting to access an entity |
| read | view the representation of an entity, but will not be able to modify the entity | 
| write | be able to view and modify the entity |

Every entity has an owner. The **owner** is the user who creates the entity. An
entity’s ownership can be transferred to a different user by its current owner.
The owner, by default, has the privilege to configure attributes of the entity
including the sharing and public accessibility.

The owner user can share an entity with other individual users or groups with
read or write permission. The shared entity will also appear in the _shared
entity_ tab or the _group shared entity_ tab of a user.

The entity owner can configure an entity to be publicly readable or writable.
All the public available entities are listed on the _all public forms_ or _all
public travelers_ pages.
