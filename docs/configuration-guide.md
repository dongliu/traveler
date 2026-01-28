
## ad (ad.json)

### shareUsers
When `shareUsers` is true, the entities shared with other users are showed on UI.

### shareGroups
When `shareGroups` is true, the entities shared with groups are showed on UI. A group can be an LDAP group, or a group defined inside the traveler application.

### transferOwnership
When `transferOwnership` is true, the entities whose ownership was modified are showed separately list on UI.


## permission (permission.json)
The permission file contains the mapping from a `role` to a **list** of `permissions`.

### user
`user` is the default role for all the users who can log into the traveler application. The user role cannot be added or removed from a user. The `user` value list is the default permissions.

### additional roles
When an additional role is added into the `permission` file, the role is enabled in the application. The admin can assign enabled roles to a user. The admin configure a user's permissions by roles. When log in, a user is is assigned the union of the permissions from all the roles that the user has.