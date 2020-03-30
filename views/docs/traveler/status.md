### Traveler status

**Audience: traveler owners and others with write permission**

During the life cycle of a traveler, it can be in different statuses. The status decides the user's access of traveler artifacts. The transitions between different statuses, and allowed access are shown in the following diagram, where **r** for read and **w** for write.
<img src="../images/traveler-status.png" alt="the statues of a traveler">

The details of the status, artifact, and corresponding allowed access for users with write permission including the owner are listed in the following table.

| status                                        | artifact | allowed access    |
| --------------------------------------------- | -------- | ----------------- |
| new                                           | data     | no data available |
| new                                           | notes    | read and write    |
| active                                        | data     | read and write    |
| active                                        | notes    | read and write    |
| frozen, submitted for completion, or complete | data     | read only         |
| frozen, submitted for completion, or complete | notes    | read and write    |
| archived                                      | data     | read only         |
| archived                                      | notes    | read only         |

<br/>
The details of the allowed actions to trigger status changes and user types are listed in the following table.

| user type                   | allowed actions |
| --------------------------- | --------------- |
| users with read permission  | no action       |
| users with write permission | submit          |
| owner                       | all actions     |

</br>
