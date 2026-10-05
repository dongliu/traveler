# Travelers and NCRs: how they work together

This guide explains, from the point of view of someone using the system, how a
traveler and a nonconformance report (NCR) are connected. It describes what you
see on screen, what each choice does, and when a traveler can be submitted.

## The two things

- A **traveler** is the work record for a product: a set of inputs that are
  filled in as the work is done.
- An **NCR** is a nonconformance report: a record that something did not meet
  the requirement, what was decided about it, and how it was closed.

An NCR can be raised against a single input on a traveler. When it is, the
input and the NCR stay linked: the input shows the NCR, and the traveler cannot
be submitted until the NCR is closed.

An NCR cannot be linked to a traveler from the NCR form. You raise a
traveler-linked NCR only from the input it concerns, on the traveler itself.
A standalone NCR, raised from the NCR pages, is never linked to a traveler.

## Working through a traveler

Open an active traveler. Each input shows two options:

- **Input** lets you enter or change the value. The input becomes editable,
  and **Initiate NCR** is hidden for that input while you work on it. Save
  stores the value. Reset discards what you typed and returns the input to its
  two options.
- **Initiate NCR** opens the NCR form, already linked to that input. The traveler
  and the input are shown at the top of the form and cannot be changed there.

Choose one or the other for each input:

- If the input can be filled in, choose **Input**.
- If there is a nonconformance against it, choose **Initiate NCR**.

### Once a value is saved

When you save a value, the input is complete. It is locked, and it shows neither
**Input** nor **Initiate NCR**. The saved value stays visible.

Saving nothing does not complete an input. A blank text field, or a single box
that is not ticked, counts as no value. Save then leaves both options on the
input.

## While an NCR is open on an input

As soon as an NCR is raised against an input:

- The input shows **Waiting on an open NCR**.
- Neither **Input** nor **Initiate NCR** is offered. You cannot raise a second
  NCR on the same input while one is open.
- The NCR is listed under the input, with its number and current status. Click
  it to open the NCR.

When the NCR is closed, the input's options come back, as long as the input has
no saved value. If it does have a value, it stays locked.

Other inputs on the traveler are not affected.

## NCR states

An NCR moves through these states, shown as badges next to its link:

| State | What it means |
|---|---|
| Submitted | Raised, waiting for the engineering disposition |
| Dispositioned | Engineering has recorded how the nonconformance is to be handled |
| Approval Requested | Sent to the approvers |
| Returned for Comment | Sent back for more information |
| Final Approval | Approved, waiting to be closed |
| Closed | Finished |

An NCR that is not Closed is an open NCR.

## Closing an NCR that is linked to a traveler

When someone closes an NCR that is linked to a traveler, the closing form asks
them to confirm the traveler sign-off. The NCR cannot be closed without it.

On closing, the system creates a close report: a PDF with the NCR's details,
its disposition, its approvals, and its history of events. The report is
attached to the input the NCR was raised against, next to the NCR's link. Anyone
who can see the traveler can open it from there. A later change to the NCR does
not change a report that has already been made.

## Submitting a traveler for completion

**Submit for completion** is available only when both of these are true:

1. Every NCR linked to the traveler is Closed.
2. Every input on the traveler has a value.

While either is not true, the button is disabled. Below it, the traveler says
how many reasons are holding the submission back. Open **show details** to see
them:

- An input with open NCRs is listed once, with each of its NCRs and a link to it.
- An input with no value and no open NCR is listed once, as having no value yet.
- An open NCR that is not tied to any input is listed on its own.

The reasons are collapsed by default, so a long list does not fill the page.
Each input has only one reason, whatever the number of NCRs against it.

The button applies to everyone. No role can submit a traveler while one of
these conditions is not met. If an input is being edited and not yet saved, the
button is also disabled until it is saved or reset.

When the last reason is cleared, the button becomes available on its own, without
a reload.

## Live updates

You do not need to reload the page to see changes made by others.

- An open active traveler checks its inputs and NCRs every 30 seconds. A
  changed NCR status, a value saved elsewhere, or a newly closed NCR shows up
  within that time, and the submit button is updated with it.
- An open NCR page checks itself every 30 seconds in the same way.
- Typing is never lost. If you are in the middle of entering a value or have a
  dialog open, the page waits until you finish before it updates that part.
- Checking pauses while the browser tab is in the background, and resumes when
  you come back to it.
- A traveler that is no longer active stops refreshing, and its input options are
  removed.

## Traveler statuses that matter here

- **Active**: work is being done. Inputs can be entered, and NCRs can be raised.
- **Submitted for completion**: the traveler has been sent for review. Its inputs
  are no longer open for NCRs.
- **Completed**, **frozen** and **archived**: the traveler is no longer being
  worked. NCRs cannot be raised against it.

A traveler that is sent back for more work becomes active again. It is checked
again the next time it is submitted.

## Quick reference

| What you see | What it means | What to do |
|---|---|---|
| Input and Initiate NCR on an empty input | Nothing has been entered yet | Choose Input to enter a value, or Initiate NCR to raise an NCR |
| The field is editable, with Save and Reset | You have chosen Input and are entering a value | Save, or Reset to discard it |
| Input is locked, no options | A value has been saved | Nothing; the input is complete |
| Waiting on an open NCR, no options | An NCR is open on the input | Open the NCR and carry it through to Closed |
| Submit for completion disabled, reasons collapsed | Something is still open or empty | Open show details and deal with each reason |
| Submit for completion enabled | Every NCR is Closed and every input has a value | Submit |
| Close report under an input | The NCR was closed | Open it for the full record |
