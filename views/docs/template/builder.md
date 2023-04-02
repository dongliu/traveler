### Template builder

The template builder is a what-you-see-is-what-you-get editor. It is the
starting point to use the traveler application for most users.

#### Choose the right type

Log in the traveler application, and navigate to the <a href="/forms/">Forms</a>
page. Then click on the <a id="new" href="/forms/new" target="_blank"
data-toggle="tooltip" title="create new empty forms" class="btn btn-primary"><i
class="fa fa-file-o fa-lg"></i>&nbsp;New form</a> button.

A new page will load the following page.

<figure align="center">
<img src="../images/template-type.png" alt="new template page" style="width:50%">
<figcaption>
New template
</figcaption>
</figure>

The user needs to set the new template's name, and choose the type. The default
type is [normal](#normal). The [discrepancy](#discrepancy) type is for QA-like
process that is required to check the discrepancy of a work. Click <button
class="btn btn-primary">Confirm</button> to go to next step. Always start with
the normal type for your first try.

#### Template components

A new template has no inputs inside. The user can add new components, update the
attributes of an existing component, duplicate a component, and adjust the
location of a component. 

##### Basic input components

The template builder support 8 basic inputs types:

| input name | usage | properties |
| ----------- | ----------- | ----------- |
| Checkbox | specify a boolean value, true or false | Label, User defined key, Text, Required |
| Radio | choose one out of multiple available options | Label, User defined key, Text, Required, Radio button value |
| Text | a single line text to record  | Label, User defined key, Placeholder, Required, Help  |
| Figure | not a user input, a visual instruction for traveler user | Select an image, Image alternate text, Width, Figure caption |
| Paragraph | multiple line text to record | Label, User defined key, Placeholder, Row Required, Help |
| Number | either an integer or a float value | Label, User defined key, Placeholder, Help, Min, Max, Required |
| Upload file | use upload file | Label, User defined key, Help, Required |
| Other types | Text/Number/Date/Date Time/Email/Phone number/Time/URL HTML5 input types with validation support | Label, User defined key, Placeholder, Help, Required |

<br>
Each input is specified by a list of properties. Some property control the input
presentation, and some control its behavior, and some are for internal traveler
application. The details of the input properties are listed in the following
table.  
<br>

| property name | usage | notes |
| ------- | ------ |  -------- |
| Label | appears in front of the input, short description | default as "label", SHOULD be short and unique in the template |
| User defined key  | does not render in the template, but used for report and API | MUST be unique within the template; **only** letter, number, and "\_" allowed (Example: MagMeas_1) |
| Radio button value | appears behind the radio button | the value will be recorded in DB; each radio button value MUST be unique within the radio group |
| Required | whether the input is required | when an input is required, the value MUST be present to pass template validation; for checkbox, required means it MUST be checked |
| Placeholder  | appears inside the input before the user touches | a short hint to the user |
| Select an image | upload an image for the figure | choose an image file from local file system and then click upload |
| Image alternate text | the text appears in the place when the image is not loaded | meaningful text for the image |
| Width | the width of image appearing in the template | when the image is too large, use this property to resize it. The unit is pixel, and the height will be adjusted accordingly to keep the original aspect. |
| Figure caption | appears below the image | a long text to describe the image |
| Row  | the number of rows for the text box | provide enough space so that the user can input or viw the text without scrolling |
| Min | minimum allowed value for a number | useful for validation |
| Max | minimum allowed value for a number | useful for validation |
| Help | appear below the input | a long hint to the user for the input |


#### Advanced components

Currently, the builder supports two advanced controls, section and rich
instruction. The section is for structure the template and the travelers. When a
template has sections, a floating navigation will be generated on the right side
of the traveler page. With the navigation, the user can jump to a section with a
click. This is helpful when a template is several pages long. 

With rich instruction, a user can add math formulas, web links, images, and
lists to the template. This is useful when the user needs a rich format editor
to compose the paragraph. Note that the image added into the rich instruction
needs to be hosted on a location that the traveler page can access. It is
different from the figure in basic input, which accepts an uploaded image file
from the user and saved on the traveler server storage. 
#### Save changes
Whenever you update the template by adding a new input, or updating an input's
attributes, or adjusting the locations of the inputs, you can save the change to
the server side by clicking the <button class="btn btn-primary">Save</button>
button. 

When the user tries to save a template, the builder checks if there is a
component's editor is still open. If there is, then the user will see an alert
to finish the edit first. The user can either commit the change by click the
<button class="btn btn-primary">Done</button> button, or cancel the change by
click the <a data-toggle="tooltip" title="edit" class="btn btn-info"><i
class="fa fa-edit fa-lg"></i></a> button again. 

#### Update, delete, or duplicate a component

When hovering on an existing template component, the component will be focused
and a set of buttons shows on the top right corner of the component, like <div
class="btn-group"><a data-toggle="tooltip" title="edit" class="btn btn-info"><i
class="fa fa-edit fa-lg"></i></a><a data-toggle="tooltip" title="duplicate"
class="btn btn-info"><i class="fa fa-copy fa-lg"></i></a><a
data-toggle="tooltip" title="remove" class="btn btn-warning"><i class="fa
fa-trash-o fa-lg"></i></a></div>. 

Click the first button to show or hide the attribute panel fot the component.
Click the second to create a new component same to the current component. Click
the third to remove the current component from the template. 

#### Sequence number
Sequence numbers are added automatically to te components. There are three
levels of number, the section is the top level, the second is the rich
instruction, and the third is the basic input. The idea is to organize the
template in a structure like 
```
1 Section name
1.1 instruction for what to do
1.1.1 some data to collect 
```

When new components are added, or the location is adjusted, the numbers are
updated automatically. For the templates created with an older version of the
builder, there might not be numbers. The user can force to generate the numbers
by click the <button class="btn btn-primary">Generate numbering</button> button.

#### Adjust component location

Click the <button class="btn">Adjust location</button> to enter the location
adjustment mode. The user can drag and drop a component to a different place.
The sequence number will be updated every time a component's location is
changed. Click the <button class="btn">Done</button> to exit the location
adjustment mode. Note that the changes will not be saved until clicking the <button class="btn btn-primary">Save</button> button.

#### Import other templates
In order to make the composition of a new template fast, the use can import the
components inside any draft template or released template into the current
builder. After importing, the user can adjust the location or remove components. 

#### Preview and validation
The user can preview the saved template any time when click the <button
class="btn btn-info">Preview</button> button. The preview page renders the
template and the validation logic specified in the builder. The user can see the
validation result when click the button class="btn btn-info">Show
validation</button> button. 
#### Save as a new template
The user can save the template in the builder as a new template. The new
template can be found in the my draft templates list. 