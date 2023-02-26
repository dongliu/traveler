### What is a template?

A template is the documentation for a predefined process. A user can execute the
process mutliple times and collect data during the execution as defined. A
template can contain multiple sequenced sections, and each section can contain
instructions and inputs. The designer defines what a user should do during the
process execuation, and what data should be collected. 

In the traveler application, a template is a standard HTML form. A template
designer can create and update a template in a WYSIWYG (what you see is what you
get) editor. Each template has a life cycle, and can be managed by users with
special roles. Users can only create travelers from the released templates. The
[templates section](#forms) describes the details of how to work with templates.

There are two types of templates --- normal templates and discrepancy templates.
A normal template defines a sequence of actions and data points to collect. A
discrepancy template is for the QA process, in which the data collected in a
normal process is examined and requested for correction. A normal template can
be used by its own, while a discrepancy template has to be used together with a
normal template. 
