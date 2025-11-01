### Traveler status

**Audience: traveler owners and others with write permission**

The allowed access of a traveler changes with its status. The transitions
between statuses, and the allowed access at each status are shown in the
following diagram, where **r** for read and **w** for write.
<img src="../images/traveler-status.png" alt="the statues of a traveler">

The following table lists the status and corresponding allowed access for
traveler data and traveler notes.

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
