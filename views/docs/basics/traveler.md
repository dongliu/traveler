### What is a traveler?

A traveler is an electrical document that is designed to support the execution
of a predefined process and to collect user input data and notes in the process.
A typical traveler user case is to implement a work instruction that specifies
all the steps to accomplish a work. It also supports collections of discrepancy
data during QA processes.

A traveler has properties like title, description, deadline, locations, and
tags. The user can add/remove a tag into the tag list. The user can also
associate a traveler to a list of devices. A traveler is **initialized** from a
**released** template. Its state can be changed to **active**, **submitted for
completion**, **completed**, and **frozen**. A traveler can be **archived**.
Only the traveler owner can access the traveler when it is archived. A traveler
owner can [share](#ownership) her/his traveler with other users/groups. A user
can also [transfer](#ownership) the ownership of a traveler to other user.

The process and inside user inputs are defined in a [template](#form). The users
with written permission can input values into an **active** traveler. The input
**history** is kept with the traveler. Each input can also have user notes
attached to it. Optionally, a traveler can contain the history of discrepancies. A traveler
can be considered as the composition of a released form, the input data, and the
notes:

**traveler = template + data + notes [+ discrepancies]**

The [travelers section](#travelers) provides more detailed information about how
to use and manage travelers.
