### Ownership and access control
The traveler application has three types of important entities: forms, travelers, and binders. Every such an entity has a owner. The owner is the user who create the entity at the beginning. The ownership can be transferred to a different user by current owner. The owner has full privileges of an entity. The owner of an entity is responsible to **design**, **develop**, and **deliver** it.  

There are three levels of access control for an entity that its owner can configure. The first level is **public access**. An entity can be publicly no access, readable, or writable. It an entity is publicly readable, then any user who can log into the traveler application will be able to view the entity's details. 

The second level of access control is via **shared groups**. The owner can add an AD (active directory) group into the shared group list with read or write permission. If an entity is configured to the readable by a group named *a.b.c* then all the members of the group will be able to view it when log in. The shared entity will also appear in the *group shared entity* tab of the group members. 

The third level of access control is via **shared users**. The owner can add an AD user into the shared user list with read or write permission. The shared entity will also appear in the *shared entity* tab of the user. 

Whether a user can read or write an entity is decided by the combination of the three levels of rules. The strong permissions override the weak ones. For example, an entity is readable by a group named *a.b.c*, and writable by a group named *a.b.c.d*, then a member of group *a.b.c.d* will have the write permission. 
