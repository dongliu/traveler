###  Traveler status
During the life cycle of a traveler, it can be in different statuses. The status decides the user's access of traveler artifacts. The transitions between different statuses, and allowed access are shown in the following diagram. 
<img src="../images/traveler-status.png" alt="the statues of a traveler">

The details of the status, artifact, user type, and corresponding allowed access are listed in the following table. 

| status | artifact | user type | allowed access |
|---------| --------|-------- |---------|
| new | data | users with write permission | no data available
| new | data | owner | no data available
| new | notes | users with write permission | read and write
| new | notes | owner | read and write
| active | data | users with write permission | read and write
| active | data | owner | read and write
| active | notes | users with write permission | read and write
| active | notes | owner | read and write
| frozen, submitted for completion, or complete | data | users with write permission | read
| frozen, submitted for completion, or complete | data | owner | read
| frozen, submitted for completion, or complete | notes | users with write permission | read and write
| frozen, submitted for completion, or complete | notes | owner | read and write
| archived | data | users with write permission | no read or write
| archived | data | owner | read only
| archived | notes | users with write permission | no read or write
| archived | notes | owner | read only

<br/>
The details of the allowed actions to trigger status changes and user types are listed in the following table. 

| user type | allowed actions |
|---------| --------|
| users with read permission | no action
| users with write permission | submit
| owner | all actions


</br>
