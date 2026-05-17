## app (app.json)

### top_bar_urls

The top_bar_urls is a list of `test: href location` that be rended on the top
menu of traveler application. Nothing will be added when it is empty.

### link_target

use `"_self"` to open the hyperlink in the current window. `"_blank"` to open in
a new tab. You can also use other allowed value for the `<a>` html element.

### deployment_name

The name of the deployment that will shown on the top menu.

### upload_dir

The directory for uploaded files.

### log_dir

The directory for access logs.

### body_max_size

The max body size when a JSON request.

### upload_size

The max size in MB for uploaded file.

### alias

A list of `path1: path2` locations that will route the request targeted at
`path1` to `path2`.

### default_form_public_access, default_traveler_public_access, default_binder_public_access

Default public access value when a form/traveler/binder is created.

### released_form_version_mgmt

When enabled, the user can choose to archive previously released templates.

### auto_numbering

Default true. When enabled, the form builder will generate numbers for template
elements automatically. Otherwise, the user can set the numbers manually.

### default_required

Default false. When disabled, the user can set an input to be required or not.
Otherwise, all inputs will be required.

### user_key

Default true. When enabled, a user can choose to set a unique key for an input.
That key will be used when generating report. When disabled, no option to set
the key.

### notification_email_address

The email address where notification is sent from.

### smtp_host, smtp_port

The hostname and port for SMTP service.

## auth (auth.json)

### type

The value can be `ldapWithDnLookup` or `ldap` or `cas`. When using `ldap`,
`adminDn` and `adminPassword` are required in `ad.json`. `ldapWithDnLookup` does
not need that.

### default_roles

A user will have the permissions from the list of default roles.

## ad (ad.json)

### url

Full URL for the LDAP service

### searchBase

The base DN (distinguished name) for an LDAP search

### searchFilter

The search filter when using user id

### nameFilter

The search filter when using name

### memberAttributes

The attributes to be retrieve when search LDAP with the user name. This search
is used to populate the typeahead (auto complete) of users in an organization.

### rawAttributes

The attributes from LDAP that contain a raw files, e.g. a user photo.

### defaultKeys

Each LDAP defines a user with different schema. The traveler application has its
own user model and expected user property. The `defaultKeys` is an object that
helps to populate the missing traveler internal user property from the LDAP user
property. The key is the property name to be populate, and the value is the
property name available from LDAP. E.g. `"uid": "sAMAccountName"` will populate
a `uid` for the user object from `sAMAccountName` in LDAP.

### shareUsers

This is more a UI configuration than a AD/LDAP one. When `shareUsers` is true,
the entities shared with other users are showed on UI.

### shareGroups

This is more a UI configuration than a AD/LDAP one. When `shareGroups` is true,
the entities shared with groups are showed on UI. A group can be an LDAP group,
or a group defined inside the traveler application.

### publicAccess

This is more a UI configuration than a AD/LDAP one. When enabled, the user can
set the public access of each entity.

### transferOwnership

This is more a UI configuration than a AD/LDAP one. When `transferOwnership` is
true, the entities whose ownership was modified are showed separately list on
UI.

## permission (permission.json)

The permission file contains the mapping from a `role` to a **list** of
`permissions`.

### user

`user` is the default role for all the users who can log into the traveler
application. The user role cannot be added or removed from a user. The `user`
value list is the default permissions.

### additional roles

When an additional role is added into the `permission` file, the role is enabled
in the application. The admin can assign enabled roles to a user. The admin
configure a user's permissions by roles. When log in, a user is is assigned the
union of the permissions from all the roles that the user has.
