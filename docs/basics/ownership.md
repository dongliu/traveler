### Ownership, roles, and access control

The traveler application supports **role/permission based** and **attribute
based** access control. When a user tries to access a resource, both the user's
roles and permissions in the current session and the resource's access related
attributes are considered. The access is granted if either the role or the
attribute allows.

There are three built-in roles, admin, manager, and reviewer, which can be
mapped to predefined permissions. The roles and role-to-permission mapping are
configurable in the traveler application. A user can be associated with multiple
roles, therefore the permissions mapped from those roles.

The traveler application has four important entity types: draft template,
released template, traveler, and binder. Each type has three attributes to
control the access, the ownership, sharing, and public accessibility (if enabled
in the configuration).

There are three levels of access privileges: no access, read, and write. The
details are listed in the following table.

| access privilege | details                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| no access        | rejected when requesting to access an entity                                    |
| read             | view the representation of an entity, but will not be able to modify the entity |
| write            | be able to view and modify the entity                                           |

Every entity has an owner. The initial **owner** is the user who creates the
entity. An entity’s ownership can be transferred to a different user by its
current owner or by an admin user who has the required permission. The owner, by
default, has the privilege to configure attributes of the entity including the
sharing and public accessibility. Ownership transfer is a configurable feature.

#### Configurable features

The owner user can share an entity with other individual users or groups with
read or write permission. The shared entity will also appear in the _shared
entity_ tab or the _group shared entity_ tab of a user. This feature is
controlled by the `shareUsers` option in `ad` configuration.

The entity owner can configure an entity to be publicly readable or writable.
All the public available entities are listed on the _all public forms_ or _all
public travelers_ pages. This feature is controlled by the `shareGroups` option
in `ad` configuration.

The owner can update an entity's public accessibility when the `publicAccess`
option is enabled in `ad` configuration. The default value of accessibility is
set in the `app` configuration file.
