### What is a traveler?

A traveler is an electrical document that supports the execution of a predefined
process in a normal template and to collect user input data and notes in the
process. It also supports collections of discrepancy QA log with a discrepancy
template.

A traveler has properties like title, description, deadline, locations, devices,
and tags. The user can add/remove multiple tags into the tag list. Tags can be
used to group and find travelers. A device is a special type of tag that
represents a physical entity related to the traveler. The user create a new
traveler when **initializing** it from a **released** template. Its state can be
changed to **active**, **submitted for completion**, **completed**, and
**frozen**. A traveler, eigher finished or not, can be **archived** when it
needs no more attentions from users. Only the traveler owner can access the
traveler when it is archived. A traveler owner can [share](#ownership) her/his
traveler with other users/groups. A user can also [transfer](#ownership) the
ownership of a traveler to other user.

The users with written permission to a traveler can input values into an
**active** traveler. The input **history** is kept with the traveler. Each input
can also have user notes attached to it. Optionally, a traveler can contain the
history of discrepancies. A traveler can be considered as the composition of a
released form/template, the input data, the notes, and discrepency logs:

**traveler = template + data + notes [+ discrepancy logs]**

The [travelers section](#travelers) provides more detailed information about how
to create, updated, and manage travelers.
