### Template builder

Template builder is one of the most important components in the traveler
application. The template builder is a what-you-see-is-what-you-get one-page
application that most users will work with. It was designed to be user friendly.
However, the instruction in this section will definitely save time for a first
time user.

#### Choose the right type

Log in the traveler application, and navigate to the <a href="/forms/">Forms</a>
page. Then click on the <a id="new" href="/forms/new" target="_blank" data-toggle="tooltip"
title="create new empty forms" class="btn btn-primary"><i class="fa fa-file-o
fa-lg"></i>&nbsp;New form</a> button.

A new page will load the following page.

<figure align="center">
<img src="../images/template-type.png" alt="new template page" style="width:50%">
<figcaption>
New template
</figcaption>
</figure>

The user needs to set the new template's name, and choose the type. The default
type is [normal](#normal). The [discrepancy](#discrepancy) type is specially for
a recurrent process like QA. Click <button class="btn
btn-primary">Confirm</button> to go to next step. Always start with the normal
type for your first try.

#### Add Inputs

A new template has no inputs inside. The designer of a template is responsible
to add inputs and sections into it, and arrange them in the desired order.

##### Basic inputs

The template builder support 8 basic inputs types:

| input name  | usage                                                                                            | properties                                                     |
| ----------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Checkbox    | specify a boolean value, true or false                                                           | Label, User defined key, Text, Required                        |
| Radio       | choose one out of multiple available options                                                     | Label, User defined key, Text, Required, Radio button value    |
| Text        | a single line text to record                                                                     | Label, User defined key, Placeholder, Required, Help           |
| Figure      | not a user input, a visual instruction for traveler user                                         | Select an image, Image alternate text, Width, Figure caption   |
| Paragraph   | multiple line text to record                                                                     | Label, User defined key, Placeholder, Row Required, Help       |
| Number      | either an integer or a float value                                                               | Label, User defined key, Placeholder, Help, Min, Max, Required |
| Upload file | use upload file                                                                                  | Label, User defined key, Help, Required                        |
| Other types | Text/Number/Date/Date Time/Email/Phone number/Time/URL HTML5 input types with validation support | Label, User defined key, Placeholder, Help, Required           |

Each input is specified by a list of properties. Some property control the input
presentation, and some control its behavior, and some are for internal traveler
application. The details of the input properties are listed in the following
table.

| property name        | usage                                                        | notes                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Label                | appears in front of the input, short description             | default as "label", SHOULD be short and unique in the template                                                                                           |
| User defined key     | does not appear in the template, but used for report and API | MUST be unique within the template; **only** letter, number, and "\_" allowed (Example: MagMeas_1)                                                       |
| Radio button value   | appears behind the radio button                              | the value will be recorded in DB; each radio button value MUST be unique within the radio group                                                          |
| Required             | whether the input is required                                | when an input is required, the value MUST be present to pass template validation; for checkbox, required means it MUST be checked                        |
| Placeholder          | appears inside the input before the user touches             | a short hint to the user                                                                                                                                 |
| Select an image      | upload an image for the figure                               | choose an image file from local file system and then click upload                                                                                        |
| Image alternate text | the text appears in the place when the image is not loaded   | meaningful text for the image                                                                                                                            |
| Width                | the width of image appearing in the template                 | when the image is too large, use this property to resize it. The unit is pixel, and the height will be adjusted accordingly to keep the original aspect. |
| Figure caption       | appears below the image                                      | a long text to describe the image                                                                                                                        |
| Row                  | the number of rows for the text box                          | provide enough space so that the user can input or viw the text without scrolling                                                                        |
| Min                  | minimum allowed value for a number                           | useful for validation                                                                                                                                    |
| Max                  | minimum allowed value for a number                           | useful for validation                                                                                                                                    |
| Help                 | appear below the input                                       | a long hint to the user for the input                                                                                                                    |

#### Save

##### edit

##### duplicate

##### remove

#### Advances control

##### Section

##### Rich instruction

#### Preview and validation

#### Save as
