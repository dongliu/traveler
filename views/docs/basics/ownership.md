### Ownership, roles, and access control

The traveler application impletes **role based** and **attribute based**. When a
user tries to access a resource, both the user's roles in current session and
the resource's access related atributes are considered. The access is granted if
either the role or the attribute allows. 

The default user's role is normal user. An admin user can assign or remove
admin, manager, and reviewer roles to any user. Only admins can modify a user's
roles. Only reviews can get or perform form reviewing tasks. An admin use or a
manager user is capable to read or write all resources in the application. 

The traveler application has three types of important entities: templates,
travelers, and binders. Each entity has three attributes to control the access,
the ownership, sharing, and public accessibility. 

There are three levels of access privileges: no access, read, and write. The details are listed in the following table. 

| access privilege | details | 
|----------|-----------------------------|
| no access | rejected when trying to send a request to a resource |
| read | view the representation of a resource, but will not be able to modify the resource | 
| write | be able to view and modify the resource| 


Every entity has an owner. The **owner** is the user who creates the entity at the
beginning. The ownership can be transferred to a different user by current owner
or the admin. The owner has full privileges of an entity. The
owner, by default, has the privilege to configure attributes of the
entity including the sharing and public accessibility.

The owner user can share an entity with other individual users or groups with
read or write permission. The shared entity will also appear in the _shared
entity_ tab or the _group shared entity_ tab of a user.

The entity owner can configure an entity to be publicly readable or writable. All the public available entities are listed on the _all public forms_ or _all public travelers_ pages. 
